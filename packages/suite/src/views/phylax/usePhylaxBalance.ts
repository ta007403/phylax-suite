// PHYLAX Blocks (fork): balance of a saved PHYLAX wallet, from Suite's own backend (Blockbook),
// address by address on the receive and change chains until GAP_LIMIT unused addresses in a row.

import { useEffect, useState } from 'react';

import TrezorConnect, { type PROTO } from '@trezor/connect';

import {
    PHYLAX_COIN_SYMBOLS,
    type PhylaxChain,
    type PhylaxNetwork,
    getPhylaxAddress,
} from './phylaxWallet';

const GAP_LIMIT = 20;
const CHAINS: PhylaxChain[] = [0, 1];

/** A coin of the wallet: an unspent output on one of its addresses. */
export type PhylaxUtxo = {
    txid: string;
    vout: number;
    // satoshis
    value: bigint;
    chain: PhylaxChain;
    index: number;
    confirmations: number;
};

export type PhylaxBalance =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | {
          status: 'loaded';
          // satoshis, including unconfirmed
          balance: bigint;
          usedAddressCount: number;
          // the first receive address after the last used one
          nextReceiveIndex: number;
          // the first change address after the last used one
          nextChangeIndex: number;
          // every coin on the wallet's addresses, confirmed or not
          utxos: PhylaxUtxo[];
      };

// Lookups at a time: one burst per address (about 40 for a new wallet) made the backend close
// the connection ("Websocket closed unexpectedly").
const CONCURRENT_LOOKUPS = 4;
const LOOKUP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 'basic': history and balance only. 'tokens' (any other level) also returns the coins (UTXOs).
const lookUpAddress = async (
    network: PhylaxNetwork,
    address: string,
    details: 'basic' | 'tokens' = 'basic',
) => {
    let lastError = '';
    for (let attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt++) {
        const result = await TrezorConnect.getAccountInfo({
            coin: PHYLAX_COIN_SYMBOLS[network],
            descriptor: address,
            details,
        });
        if (result.success) return result.payload;
        lastError = result.error.message;
        if (attempt < LOOKUP_ATTEMPTS) await wait(RETRY_DELAY_MS * attempt);
    }
    throw new Error(lastError);
};

/** fn over items, at most `limit` at a time, results in order. */
export const mapLimited = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
    const results: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]!);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

    return results;
};

const scanChain = async (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
) => {
    let balance = 0n;
    let usedAddressCount = 0;
    let lastUsedIndex = -1;
    let nextIndex = 0;
    // addresses holding something (confirmed or not): their coins are read afterwards
    const funded: { address: string; index: number }[] = [];

    while (nextIndex <= lastUsedIndex + GAP_LIMIT) {
        const from = nextIndex;
        const to = lastUsedIndex + GAP_LIMIT;
        const addresses: string[] = [];
        for (let index = from; index <= to; index++) {
            addresses.push(getPhylaxAddress(wallet, network, chain, index));
        }
        nextIndex = to + 1;

        // One request per address: connect's bundled getAccountInfo needs a device for its progress
        // events, and these lookups need none.
        const results = await mapLimited(addresses, CONCURRENT_LOOKUPS, address =>
            lookUpAddress(network, address),
        );

        results.forEach((info, offset) => {
            const isUsed = info.history.total > 0 || info.history.unconfirmed > 0;
            if (!isUsed) return;
            lastUsedIndex = from + offset;
            usedAddressCount++;
            // Blockbook: confirmed balance plus the pending (unconfirmed) change
            balance += BigInt(info.availableBalance);
            if (BigInt(info.balance) > 0n || BigInt(info.availableBalance) > 0n) {
                funded.push({ address: addresses[offset]!, index: from + offset });
            }
        });
    }

    const coins = await mapLimited(funded, CONCURRENT_LOOKUPS, async ({ address, index }) => {
        const info = await lookUpAddress(network, address, 'tokens');

        return (info.utxo ?? []).map((utxo): PhylaxUtxo => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: BigInt(utxo.amount),
            chain,
            index,
            confirmations: utxo.confirmations,
        }));
    });

    return { balance, usedAddressCount, lastUsedIndex, utxos: coins.flat() };
};

export const usePhylaxBalance = (
    wallet: PROTO.PhylaxWallet | undefined,
    network: PhylaxNetwork,
    // change it to scan again (after a send)
    refreshToken = 0,
): PhylaxBalance => {
    const [state, setState] = useState<PhylaxBalance>({ status: 'loading' });

    useEffect(() => {
        if (!wallet) return;
        let isCancelled = false;
        setState({ status: 'loading' });

        // the receive chain, then the change chain (not both at once, see CONCURRENT_LOOKUPS)
        (async () => {
            const chains = [];
            for (const chain of CHAINS) {
                chains.push(await scanChain(wallet, network, chain));
            }

            return chains;
        })()
            .then(chains => {
                if (isCancelled) return;
                setState({
                    status: 'loaded',
                    balance: chains.reduce((sum, chain) => sum + chain.balance, 0n),
                    usedAddressCount: chains.reduce(
                        (sum, chain) => sum + chain.usedAddressCount,
                        0,
                    ),
                    // CHAINS[0] is the receive chain, CHAINS[1] the change chain
                    nextReceiveIndex: (chains[0]?.lastUsedIndex ?? -1) + 1,
                    nextChangeIndex: (chains[1]?.lastUsedIndex ?? -1) + 1,
                    utxos: chains.flatMap(chain => chain.utxos),
                });
            })
            .catch((error: Error) => {
                if (isCancelled) return;
                setState({ status: 'error', error: error.message });
            });

        return () => {
            isCancelled = true;
        };
    }, [wallet, network, refreshToken]);

    return state;
};
