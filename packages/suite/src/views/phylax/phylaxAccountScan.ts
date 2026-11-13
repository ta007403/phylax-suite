// PHYLAX Blocks (fork): the account data of a saved PHYLAX wallet, from Suite's own backend
// (Blockbook), address by address on the receive and change chains until GAP_LIMIT unused
// addresses in a row. Blockbook only knows single-key descriptors, so the balance, the coins and
// the transactions of the multisig are put together here from its addresses.

import TrezorConnect, { type PROTO } from '@trezor/connect';

import {
    PHYLAX_COIN_SYMBOLS,
    type PhylaxChain,
    type PhylaxNetwork,
    getPhylaxAddress,
} from './phylaxWallet';

// Unused addresses in a row after which a scan stops, as in Suite and Sparrow.
export const GAP_LIMIT = 20;

/**
 * The highest receive address Next address may show: GAP_LIMIT unused addresses from the first
 * unused one (`firstUnusedIndex`). A payment to an address beyond would not be found by the scan.
 */
export const getLastShownReceiveIndex = (firstUnusedIndex: number) =>
    firstUnusedIndex + GAP_LIMIT - 1;
const CHAINS: PhylaxChain[] = [0, 1];
// Transactions read per used address (newest first).
export const TRANSACTIONS_PER_ADDRESS = 50;

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

/** A receive address that was used (it has transactions), for the address history. */
export type PhylaxUsedAddress = {
    index: number;
    address: string;
    transactions: number;
    // satoshis, including unconfirmed
    balance: bigint;
};

export type PhylaxTransactionType = 'sent' | 'received' | 'self';

/** Where one of the wallet's own addresses sits: chain 0 receive, 1 change. */
export type PhylaxOwnAddress = { chain: PhylaxChain; index: number };

export type PhylaxTxInput = {
    txid: string;
    vout: number;
    // satoshis
    value: bigint;
    address: string;
    // set when the coin is the wallet's
    own?: PhylaxOwnAddress;
};

export type PhylaxTxOutput = {
    // empty for an output without an address (OP_RETURN)
    address: string;
    // satoshis
    value: bigint;
    own?: PhylaxOwnAddress;
};

export type PhylaxPendingDetails = {
    inputs: PhylaxTxInput[];
    outputs: PhylaxTxOutput[];
    // virtual size from the backend, if it tells
    vsize: number | undefined;
};

/** A transaction of the wallet, seen as a whole (all of its addresses together). */
export type PhylaxTransaction = {
    txid: string;
    type: PhylaxTransactionType;
    // satoshis the wallet gained (positive) or lost (negative), fee included
    net: bigint;
    // satoshis
    fee: bigint;
    // undefined while in the mempool
    blockHeight: number | undefined;
    // unix seconds; undefined while in the mempool
    blockTime: number | undefined;
    // the inputs signal replace-by-fee (BIP125)
    rbf: boolean;
    // a pending transaction's inputs and outputs (for Speed up); undefined once confirmed
    pending?: PhylaxPendingDetails;
};

export type PhylaxAccountData = {
    // satoshis, including unconfirmed
    balance: bigint;
    usedAddressCount: number;
    // the first receive address after the last used one
    nextReceiveIndex: number;
    // the first change address after the last used one
    nextChangeIndex: number;
    // every coin on the wallet's addresses, confirmed or not
    utxos: PhylaxUtxo[];
    // used receive addresses, newest first
    usedReceiveAddresses: PhylaxUsedAddress[];
    // newest first, pending ones on top
    transactions: PhylaxTransaction[];
    // every used address (both chains): the next scan asks for their details at once
    usedAddresses: string[];
};

// Lookups at a time, with a pause after each: bursts of lookups (about 45 per wallet) made Trezor's
// backend close the connection ("Websocket closed unexpectedly", "Backend disconnected"), which
// also cut Suite's own accounts off.
const CONCURRENT_LOOKUPS = 2;
const LOOKUP_PAUSE_MS = 100;
const LOOKUP_ATTEMPTS = 3;
// after a failure (e.g. the backend closed the connection): give it time before asking again
const RETRY_DELAYS_MS = [2000, 5000];

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 'basic': history and balance only. 'txs' also returns the coins (UTXOs) and the transactions.
const lookUpAddress = async (
    network: PhylaxNetwork,
    address: string,
    details: 'basic' | 'txs' = 'basic',
) => {
    let lastError = '';
    for (let attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt++) {
        const result = await TrezorConnect.getAccountInfo({
            coin: PHYLAX_COIN_SYMBOLS[network],
            descriptor: address,
            details,
            ...(details === 'txs' ? { pageSize: TRANSACTIONS_PER_ADDRESS } : {}),
        });
        if (result.success) {
            await wait(LOOKUP_PAUSE_MS);

            return result.payload;
        }
        lastError = result.error.message;
        if (attempt < LOOKUP_ATTEMPTS) await wait(RETRY_DELAYS_MS[attempt - 1] ?? 5000);
    }
    throw new Error(lastError);
};

type AddressInfo = Awaited<ReturnType<typeof lookUpAddress>>;

type AddressTransactions = NonNullable<
    Awaited<ReturnType<typeof lookUpAddress>>['history']['transactions']
>;

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

const isPending = (blockHeight: number | undefined) => !blockHeight || blockHeight <= 0;

const sumOwned = (
    items: { addresses?: string[]; value?: string }[],
    ownAddresses: ReadonlyMap<string, PhylaxOwnAddress>,
) =>
    items.reduce(
        (sum, item) =>
            item.addresses?.some(address => ownAddresses.has(address))
                ? sum + BigInt(item.value ?? '0')
                : sum,
        0n,
    );

/**
 * The wallet's transactions from the transactions of its single addresses: one entry per txid,
 * with the net amount over every input and output on any of the wallet's addresses.
 */
export const aggregateTransactions = (
    transactions: AddressTransactions,
    // every scanned address of the wallet and where it sits
    ownAddresses: ReadonlyMap<string, PhylaxOwnAddress>,
): PhylaxTransaction[] => {
    const ownOf = (addresses: string[] | undefined) =>
        addresses?.map(address => ownAddresses.get(address)).find(own => own !== undefined);
    const byTxid = new Map<string, PhylaxTransaction>();
    for (const tx of transactions) {
        if (byTxid.has(tx.txid)) continue;
        const spent = sumOwned(tx.details.vin, ownAddresses);
        const received = sumOwned(tx.details.vout, ownAddresses);
        const isAllOwn =
            tx.details.vin.length > 0 &&
            [...tx.details.vin, ...tx.details.vout].every(item =>
                item.addresses?.some(address => ownAddresses.has(address)),
            );
        let type: PhylaxTransactionType = 'received';
        if (isAllOwn) type = 'self';
        else if (spent > 0n) type = 'sent';
        const pending = isPending(tx.blockHeight);
        byTxid.set(tx.txid, {
            txid: tx.txid,
            type,
            net: received - spent,
            fee: spent > 0n ? BigInt(tx.fee || '0') : 0n,
            blockHeight: pending ? undefined : tx.blockHeight,
            blockTime: pending ? undefined : tx.blockTime,
            rbf: !!tx.rbf,
            pending: pending
                ? {
                      inputs: tx.details.vin.map(input => ({
                          txid: input.txid ?? '',
                          vout: input.vout ?? 0,
                          value: BigInt(input.value ?? '0'),
                          address: input.addresses?.[0] ?? '',
                          own: ownOf(input.addresses),
                      })),
                      outputs: tx.details.vout.map(output => ({
                          address: output.isAddress ? (output.addresses?.[0] ?? '') : '',
                          value: BigInt(output.value ?? '0'),
                          own: ownOf(output.addresses),
                      })),
                      vsize: tx.vsize,
                  }
                : undefined,
        });
    }

    return [...byTxid.values()].sort((a, b) => {
        // pending first, then the newest block first
        const heightA = a.blockHeight ?? Number.MAX_SAFE_INTEGER;
        const heightB = b.blockHeight ?? Number.MAX_SAFE_INTEGER;

        return heightB - heightA;
    });
};

export const scanChain = async (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    // addresses used at the last scan: their details are asked for at once (one lookup each)
    knownUsed: ReadonlySet<string> = new Set(),
) => {
    let usedAddressCount = 0;
    let lastUsedIndex = -1;
    let nextIndex = 0;
    // every scanned address: the wallet's own addresses for the transaction amounts
    const scanned: [string, PhylaxOwnAddress][] = [];
    // every used address with its details lookup, if it was made already
    const usedAt: { address: string; index: number; info?: AddressInfo }[] = [];
    const used: PhylaxUsedAddress[] = [];

    while (nextIndex <= lastUsedIndex + GAP_LIMIT) {
        const from = nextIndex;
        const to = lastUsedIndex + GAP_LIMIT;
        const addresses: string[] = [];
        for (let index = from; index <= to; index++) {
            addresses.push(getPhylaxAddress(wallet, network, chain, index));
        }
        scanned.push(
            ...addresses.map((address, offset): [string, PhylaxOwnAddress] => [
                address,
                { chain, index: from + offset },
            ]),
        );
        nextIndex = to + 1;

        // One request per address: connect's bundled getAccountInfo needs a device for its progress
        // events, and these lookups need none.
        const results = await mapLimited(addresses, CONCURRENT_LOOKUPS, async address => {
            const isKnownUsed = knownUsed.has(address);
            const info = await lookUpAddress(network, address, isKnownUsed ? 'txs' : 'basic');

            return { info, hasDetails: isKnownUsed };
        });

        results.forEach(({ info, hasDetails }, offset) => {
            const isUsed = info.history.total > 0 || info.history.unconfirmed > 0;
            if (!isUsed) return;
            lastUsedIndex = from + offset;
            usedAddressCount++;
            used.push({
                index: from + offset,
                address: addresses[offset]!,
                transactions: info.history.total + info.history.unconfirmed,
                // from its coins, below
                balance: 0n,
            });
            usedAt.push({
                address: addresses[offset]!,
                index: from + offset,
                info: hasDetails ? info : undefined,
            });
        });
    }

    // the coins and the transactions of every used address
    // (newly used addresses only: the others came with their details already)
    const details = await mapLimited(usedAt, CONCURRENT_LOOKUPS, async used => {
        const { address, index } = used;
        const info = used.info ?? (await lookUpAddress(network, address, 'txs'));

        return {
            utxos: (info.utxo ?? []).map((utxo): PhylaxUtxo => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: BigInt(utxo.amount),
                chain,
                index,
                confirmations: utxo.confirmations,
            })),
            transactions: info.history.transactions ?? [],
        };
    });

    // The balances come from the coins (pending ones included, as in Suite), not from Blockbook's
    // balance: right after a payment's notification, Blockbook may list its coin while its balance
    // still says 0, and the coins are what Send spends.
    const utxos = details.flatMap(item => item.utxos);
    for (const utxo of utxos) {
        const address = used.find(item => item.index === utxo.index);
        if (address) address.balance += utxo.value;
    }

    return {
        balance: utxos.reduce((sum, utxo) => sum + utxo.value, 0n),
        usedAddressCount,
        lastUsedIndex,
        utxos,
        transactions: details.flatMap(item => item.transactions),
        scanned,
        used,
    };
};

/** Everything an account page shows: the receive chain, then the change chain. */
export const scanPhylaxAccount = async (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    // the last scan's used addresses: fewer lookups this time
    knownUsed: readonly string[] = [],
): Promise<PhylaxAccountData> => {
    const knownUsedSet = new Set(knownUsed);
    // one chain after the other, not both at once (see CONCURRENT_LOOKUPS)
    const chains = [];
    for (const chain of CHAINS) {
        chains.push(await scanChain(wallet, network, chain, knownUsedSet));
    }
    const ownAddresses = new Map(chains.flatMap(chain => chain.scanned));

    return {
        balance: chains.reduce((sum, chain) => sum + chain.balance, 0n),
        usedAddressCount: chains.reduce((sum, chain) => sum + chain.usedAddressCount, 0),
        // CHAINS[0] is the receive chain, CHAINS[1] the change chain
        nextReceiveIndex: (chains[0]?.lastUsedIndex ?? -1) + 1,
        nextChangeIndex: (chains[1]?.lastUsedIndex ?? -1) + 1,
        utxos: chains.flatMap(chain => chain.utxos),
        usedReceiveAddresses: [...(chains[0]?.used ?? [])].reverse(),
        transactions: aggregateTransactions(
            chains.flatMap(chain => chain.transactions),
            ownAddresses,
        ),
        usedAddresses: chains.flatMap(chain => chain.used.map(used => used.address)),
    };
};
