// PHYLAX Blocks (fork): the PHYLAX API (phylax-api, run by the PHYLAX operator next to a Fulcrum
// server): one request answers for many addresses at once, with their coins and transactions,
// instead of one request per address to Suite's backend. Only addresses are sent (derived here),
// never the wallet's xpubs. If it cannot be reached, the scan falls back to Suite's backend.

import { GAP_LIMIT, type PhylaxAddressInfo, type PhylaxAddressLookup } from './phylaxAccountScan';
import { type PhylaxChain, type PhylaxNetwork, getPhylaxAddress } from './phylaxWallet';

// addresses in one request (the API's default limit is 400)
export const PHYLAX_API_MAX_ADDRESSES = 400;
export const PHYLAX_API_TIMEOUT_MS = 30_000;
// after a failure, scans use Suite's backend for this long before the API is tried again
export const PHYLAX_API_RETRY_AFTER_MS = 5 * 60_000;

type ApiIo = {
    txid?: string | null;
    vout?: number | null;
    n?: number;
    value: string | null;
    addresses: string[];
    isAddress?: boolean;
};

type ApiTransaction = {
    txid: string;
    blockHeight: number | null;
    blockTime: number | null;
    fee: string | null;
    vsize: number;
    rbf: boolean;
    vin: ApiIo[];
    vout: ApiIo[];
};

type ApiAddress = {
    address: string;
    txCount: number;
    unconfirmedTxCount: number;
    utxos: {
        txid: string;
        vout: number;
        value: string;
        height: number | null;
        confirmations: number;
    }[];
    // newest first
    txids: string[];
};

export type PhylaxApiScanResponse = {
    network: string;
    tipHeight: number;
    addresses: ApiAddress[];
    transactions: Record<string, ApiTransaction>;
};

export class PhylaxApiError extends Error {}

type Fetch = typeof fetch;

/** POST /v1/scan. PhylaxApiError if it fails in any way (network, status, malformed answer). */
export const fetchPhylaxApiScan = async (
    baseUrl: string,
    network: PhylaxNetwork,
    addresses: string[],
    fetchFn: Fetch = fetch,
): Promise<PhylaxApiScanResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHYLAX_API_TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/v1/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ network, addresses }),
            signal: controller.signal,
        });
    } catch (error) {
        if (controller.signal.aborted) throw new PhylaxApiError('no answer in time');
        throw new PhylaxApiError(error instanceof Error ? error.message : String(error));
    } finally {
        clearTimeout(timeout);
    }
    if (!response.ok) {
        let detail = '';
        try {
            const body = (await response.json()) as { detail?: unknown };
            if (typeof body.detail === 'string') detail = `: ${body.detail}`;
        } catch {
            // no JSON body
        }
        throw new PhylaxApiError(`HTTP ${response.status}${detail}`);
    }
    const body = (await response.json()) as PhylaxApiScanResponse;
    const answered = new Set(body.addresses?.map(item => item.address));
    if (!body.transactions || addresses.some(address => !answered.has(address))) {
        throw new PhylaxApiError('incomplete answer');
    }

    return body;
};

const toAddressInfo = (item: ApiAddress, body: PhylaxApiScanResponse): PhylaxAddressInfo => ({
    history: {
        total: item.txCount - item.unconfirmedTxCount,
        unconfirmed: item.unconfirmedTxCount,
        transactions: item.txids.map(txid => {
            const tx = body.transactions[txid];
            if (!tx) throw new PhylaxApiError('incomplete answer');

            return {
                txid: tx.txid,
                blockHeight: tx.blockHeight ?? undefined,
                blockTime: tx.blockTime ?? undefined,
                fee: tx.fee ?? '0',
                rbf: tx.rbf,
                vsize: tx.vsize,
                details: {
                    vin: tx.vin.map(input => ({
                        txid: input.txid ?? undefined,
                        vout: input.vout ?? undefined,
                        value: input.value ?? undefined,
                        addresses: input.addresses,
                    })),
                    vout: tx.vout.map(output => ({
                        value: output.value ?? undefined,
                        addresses: output.addresses,
                        isAddress: output.isAddress,
                    })),
                },
            };
        }),
    },
    utxo: item.utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        amount: utxo.value,
        confirmations: utxo.confirmations,
    })),
});

/**
 * Looks addresses up through the PHYLAX API, with every answer's details at once. `prefetch`
 * asks for many addresses in as few requests as possible; the scan's lookups are then answered
 * from those answers (another request only for addresses beyond them).
 */
export const createPhylaxApiLookup = (baseUrl: string, fetchFn: Fetch = fetch) => {
    const answers = new Map<string, PhylaxAddressInfo>();

    const fetchMissing = async (network: PhylaxNetwork, addresses: string[]) => {
        const missing = [...new Set(addresses.filter(address => !answers.has(address)))];
        for (let start = 0; start < missing.length; start += PHYLAX_API_MAX_ADDRESSES) {
            const chunk = missing.slice(start, start + PHYLAX_API_MAX_ADDRESSES);
            const body = await fetchPhylaxApiScan(baseUrl, network, chunk, fetchFn);
            for (const item of body.addresses) answers.set(item.address, toAddressInfo(item, body));
        }
    };

    const lookup: PhylaxAddressLookup & {
        prefetch: (network: PhylaxNetwork, addresses: string[]) => Promise<void>;
    } = {
        prefetch: fetchMissing,
        lookUp: async (network, addresses) => {
            await fetchMissing(network, addresses);

            return addresses.map(address => ({ info: answers.get(address)!, hasDetails: true }));
        },
        details: async (network, address) => {
            await fetchMissing(network, [address]);

            return answers.get(address)!;
        },
    };

    return lookup;
};

/**
 * The addresses one scan will most likely ask about: on each chain, every address up to the
 * last scan's first unused one plus twice GAP_LIMIT (room for addresses used since). Asked for
 * in one request, so a scan usually needs no other.
 */
export const getPhylaxPrefetchAddresses = (
    wallet: Parameters<typeof getPhylaxAddress>[0],
    network: PhylaxNetwork,
    next: { receive: number; change: number },
) => {
    const chainAddresses = (chain: PhylaxChain, firstUnused: number) =>
        Array.from({ length: firstUnused + 2 * GAP_LIMIT }, (_, index) =>
            getPhylaxAddress(wallet, network, chain, index),
        );

    return [...chainAddresses(0, next.receive), ...chainAddresses(1, next.change)];
};
