// PHYLAX Blocks (fork): reading the stack from the main block, and the account data of each saved
// wallet from Suite's backend.

import { type BlockchainRootState, selectNetworkBlockchainInfo } from '@suite-common/wallet-core';
import TrezorConnect, { type DeviceUniquePath, type PROTO } from '@trezor/connect';
import { createThunk } from '@trezor/redux-utils';

import {
    type PhylaxRootState,
    type PhylaxWalletEntry,
    getPhylaxAccountKey,
    getPhylaxSubscriptionDescriptor,
    phylaxActions,
    selectPhylaxAccountByKey,
    selectPhylaxDevicePath,
    selectPhylaxWallets,
    serializePhylaxAccountData,
} from './phylaxReducer';
import { scanPhylaxAccount } from '../phylaxAccountScan';
import { getPhylaxSubscriptionAccount } from '../phylaxSubscription';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork, getPhylaxNetworkSymbol } from '../phylaxWallet';

const PHYLAX_PREFIX = '@suite/phylax';

// After a send, Blockbook may not list the new transaction yet: look again after this delay
// (new blocks trigger further scans until it confirms).
export const SEND_RECHECK_DELAY_MS = 10_000;

const getWalletVersionKey = (summary: PROTO.PhylaxWalletSummary) =>
    `${summary.slot}:${summary.name}:${summary.threshold}:${summary.fingerprints.join(',')}`;

// The stack refresh running right now, if any: a device request waits for it (one call at a time).
let stackRefreshInFlight: Promise<unknown> | undefined;

export const waitForPhylaxStackRefresh = async () => {
    await stackRefreshInFlight;
};

const readStack = async (devicePath: string, knownWallets: PhylaxWalletEntry[]) => {
    const target = { device: { path: devicePath as DeviceUniquePath } };
    const blocks = await TrezorConnect.phylaxGetBlocks(target);
    if (!blocks.success) return { kind: 'error' as const, error: blocks.error.message };
    const wallets = await TrezorConnect.phylaxGetWallets(target);
    if (!wallets.success) return { kind: 'error' as const, error: wallets.error.message };

    const entries: PhylaxWalletEntry[] = [];
    for (const summary of wallets.payload.wallets) {
        const key = getWalletVersionKey(summary);
        let details = knownWallets.find(
            entry => entry.details && getWalletVersionKey(entry.summary) === key,
        )?.details;
        if (!details) {
            const wallet = await TrezorConnect.phylaxGetWallet({ ...target, slot: summary.slot });
            if (wallet.success) details = wallet.payload;
        }
        entries.push({ summary, details });
    }

    return {
        kind: 'loaded' as const,
        blocks: blocks.payload.blocks,
        wallets: entries,
        isStoragePresent: wallets.payload.storage_present,
    };
};

type RefreshPhylaxStackThunkState = PhylaxRootState;

/** Reads the blocks and the saved wallets from the main block of the selected device. */
export const refreshPhylaxStackThunk = createThunk<
    void,
    void,
    { state: RefreshPhylaxStackThunkState }
>(`${PHYLAX_PREFIX}/refreshStack`, async (_, { dispatch, getState }) => {
    const devicePath = selectPhylaxDevicePath(getState());
    if (!devicePath) return;
    // one device call at a time: a refresh already running will do
    if (stackRefreshInFlight) {
        await stackRefreshInFlight;

        return;
    }

    const running = readStack(devicePath, selectPhylaxWallets(getState()));
    stackRefreshInFlight = running;
    try {
        const result = await running;
        if (result.kind === 'error') {
            dispatch(phylaxActions.stackFailed({ devicePath, error: result.error }));
        } else {
            const { blocks, wallets, isStoragePresent } = result;
            dispatch(phylaxActions.stackLoaded({ devicePath, blocks, wallets, isStoragePresent }));
        }
    } finally {
        if (stackRefreshInFlight === running) stackRefreshInFlight = undefined;
    }
});

type RefreshPhylaxAccountParams = { slot: number; network: PhylaxNetwork };

// Scans running now, by account key; a request during a scan runs one more scan after it.
const accountScans = new Map<string, { isRerunRequested: boolean }>();

type RefreshPhylaxAccountThunkState = PhylaxRootState;

/** Scans one wallet's addresses on one network and keeps the result in the store. */
export const refreshPhylaxAccountThunk = createThunk<
    void,
    RefreshPhylaxAccountParams,
    { state: RefreshPhylaxAccountThunkState }
>(`${PHYLAX_PREFIX}/refreshAccount`, async ({ slot, network }, { dispatch, getState }) => {
    const entry = selectPhylaxWallets(getState()).find(wallet => wallet.summary.slot === slot);
    if (!entry?.details) return;
    const key = getPhylaxAccountKey(entry.summary, network);

    const running = accountScans.get(key);
    if (running) {
        running.isRerunRequested = true;

        return;
    }
    const scan = { isRerunRequested: false };
    accountScans.set(key, scan);
    try {
        do {
            scan.isRerunRequested = false;
            dispatch(phylaxActions.accountRefreshStarted({ key }));
            try {
                const previous = selectPhylaxAccountByKey(getState(), key)?.data;
                const data = await scanPhylaxAccount(
                    entry.details,
                    network,
                    previous?.usedAddresses,
                );
                dispatch(
                    phylaxActions.accountLoaded({
                        key,
                        data: serializePhylaxAccountData(data),
                        time: Date.now(),
                    }),
                );
            } catch (error) {
                dispatch(
                    phylaxActions.accountFailed({
                        key,
                        error: error instanceof Error ? error.message : String(error),
                    }),
                );
            }
        } while (scan.isRerunRequested);
    } finally {
        accountScans.delete(key);
    }
});

type RefreshPhylaxAccountsThunkState = RefreshPhylaxAccountThunkState;

/**
 * Scans the wallets on the network: `missing` those without data yet, `pending` those with a
 * pending transaction (a new block may confirm it), `all` every one.
 */
export const refreshPhylaxAccountsThunk = createThunk<
    void,
    { network: PhylaxNetwork; which: 'missing' | 'pending' | 'all' },
    { state: RefreshPhylaxAccountsThunkState }
>(`${PHYLAX_PREFIX}/refreshAccounts`, async ({ network, which }, { dispatch, getState }) => {
    const wallets = selectPhylaxWallets(getState()).filter(entry => {
        if (!entry.details) return false;
        const account = selectPhylaxAccountByKey(
            getState(),
            getPhylaxAccountKey(entry.summary, network),
        );
        if (which === 'all') return true;
        if (which === 'missing') return account === undefined;

        return !!account?.data?.transactions.some(tx => tx.blockHeight === undefined);
    });
    // one wallet after the other, the backend limits parallel lookups
    for (const entry of wallets) {
        await dispatch(refreshPhylaxAccountThunk({ slot: entry.summary.slot, network }));
    }
});

type RefreshPhylaxAccountAfterSendThunkState = RefreshPhylaxAccountThunkState;

/**
 * After a broadcast: scan now (the spent coins and the new change), and again a little later
 * in case the backend did not list the new transaction yet.
 */
export const refreshPhylaxAccountAfterSendThunk = createThunk<
    void,
    RefreshPhylaxAccountParams,
    { state: RefreshPhylaxAccountAfterSendThunkState }
>(`${PHYLAX_PREFIX}/refreshAccountAfterSend`, async (params, { dispatch }) => {
    await dispatch(refreshPhylaxAccountThunk(params));
    await new Promise(resolve => setTimeout(resolve, SEND_RECHECK_DELAY_MS));
    await dispatch(refreshPhylaxAccountThunk(params));
});

type SubscribePhylaxAccountThunkState = RefreshPhylaxAccountThunkState;

/**
 * Asks Suite's backend to watch the wallet's addresses (the used ones and the next unused ones,
 * from the last scan): it then notifies about a new transaction on them at once.
 */
export const subscribePhylaxAccountThunk = createThunk<
    void,
    RefreshPhylaxAccountParams,
    { state: SubscribePhylaxAccountThunkState }
>(`${PHYLAX_PREFIX}/subscribeAccount`, async ({ slot, network }, { getState }) => {
    const entry = selectPhylaxWallets(getState()).find(wallet => wallet.summary.slot === slot);
    if (!entry?.details) return;
    const key = getPhylaxAccountKey(entry.summary, network);
    const data = selectPhylaxAccountByKey(getState(), key)?.data;
    if (!data) return;

    await TrezorConnect.blockchainSubscribe({
        coin: PHYLAX_COIN_SYMBOLS[network],
        blocks: false,
        accounts: [getPhylaxSubscriptionAccount(entry.details, network, key, data)],
    });
});

type UnsubscribePhylaxAccountThunkState = PhylaxRootState & BlockchainRootState;

/** Stops the backend watching a wallet's addresses (the wallet or the device is gone). */
export const unsubscribePhylaxAccountThunk = createThunk<
    void,
    { key: string; network: PhylaxNetwork },
    { state: UnsubscribePhylaxAccountThunkState }
>(`${PHYLAX_PREFIX}/unsubscribeAccount`, async ({ key, network }, { getState }) => {
    // a disconnected backend watches nothing; asking it would connect it again
    const symbol = getPhylaxNetworkSymbol(network);
    if (!selectNetworkBlockchainInfo(getState(), symbol)?.connected) return;
    await TrezorConnect.blockchainUnsubscribe({
        coin: PHYLAX_COIN_SYMBOLS[network],
        blocks: false,
        accounts: [{ descriptor: getPhylaxSubscriptionDescriptor(key) }],
    });
});
