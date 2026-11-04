// PHYLAX Blocks (fork): the main block's view of the stack and its saved wallets, refreshed
// while the PHYLAX page is open.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDevice } from '@suite/device';
import TrezorConnect, { type DeviceUniquePath, type PROTO } from '@trezor/connect';

import { type PhylaxIdentity, getPhylaxIdentity } from './phylaxIdentity';

const REFRESH_INTERVAL_MS = 3000;

/** Which device a PHYLAX call goes to: the connected main block. */
export type PhylaxTarget = { device: { path: DeviceUniquePath } };

/** Result of runOnDevice: the call only runs once the device answered as the wallet's main block. */
export type PhylaxRunResult<T> =
    | { kind: 'not-connected' }
    | Extract<PhylaxIdentity, { kind: 'wrong-device' }>
    | { kind: 'done'; value: T };

export type RunOnDevice = <T>(
    call: (target: PhylaxTarget, mainFingerprint: number | undefined) => Promise<T>,
    // the wallet the call is for; omitted for the stack itself (any PHYLAX main block)
    walletFingerprints?: number[],
) => Promise<PhylaxRunResult<T>>;

export type PhylaxWalletEntry = {
    summary: PROTO.PhylaxWalletSummary;
    // With the xpubs; fetched once per wallet version (slot, name, fingerprints).
    details?: PROTO.PhylaxWallet;
};

type PhylaxStackState = {
    blocks: PROTO.PhylaxBlockInfo[];
    wallets: PhylaxWalletEntry[];
    // Every block's copy of the saved wallets has been read by the main block.
    isStoragePresent: boolean;
    error?: string;
    isLoaded: boolean;
};

const INITIAL_STATE: PhylaxStackState = {
    blocks: [],
    wallets: [],
    isStoragePresent: false,
    isLoaded: false,
};

const getWalletVersionKey = (summary: PROTO.PhylaxWalletSummary) =>
    `${summary.slot}:${summary.name}:${summary.threshold}:${summary.fingerprints.join(',')}`;

export const usePhylaxStack = () => {
    const { device } = useDevice();
    const [state, setState] = useState<PhylaxStackState>(INITIAL_STATE);
    // While the user confirms a rename or delete on the main block, the device is busy with that
    // call: refreshing would fail with "call in progress".
    const [isPaused, setIsPaused] = useState(false);
    const detailsCache = useRef(new Map<string, PROTO.PhylaxWallet>());

    const devicePath = device?.path;
    // The path the page currently works with; answers for an older path are dropped.
    const currentPath = useRef(devicePath);
    // The refresh running right now, if any: a request waits for it (one call at a time).
    const refreshInFlight = useRef<Promise<void> | undefined>(undefined);

    // Another device selected: forget everything read from the previous one, so nothing it
    // showed can be used with the new device.
    useEffect(() => {
        currentPath.current = devicePath;
        detailsCache.current.clear();
        setState(INITIAL_STATE);
    }, [devicePath]);

    const readStack = useCallback(async () => {
        if (!devicePath) return;
        const target: PhylaxTarget = { device: { path: devicePath } };
        const setStateForPath = (update: Parameters<typeof setState>[0]) => {
            if (currentPath.current === devicePath) setState(update);
        };

        const blocks = await TrezorConnect.phylaxGetBlocks(target);
        if (!blocks.success) {
            setStateForPath(previous => ({
                ...previous,
                error: blocks.error.message,
                isLoaded: true,
            }));

            return;
        }
        const wallets = await TrezorConnect.phylaxGetWallets(target);
        if (!wallets.success) {
            setStateForPath(previous => ({
                ...previous,
                error: wallets.error.message,
                isLoaded: true,
            }));

            return;
        }

        const entries: PhylaxWalletEntry[] = [];
        for (const summary of wallets.payload.wallets) {
            const key = getWalletVersionKey(summary);
            let details = detailsCache.current.get(key);
            if (!details) {
                const wallet = await TrezorConnect.phylaxGetWallet({
                    ...target,
                    slot: summary.slot,
                });
                if (wallet.success) {
                    details = wallet.payload;
                    detailsCache.current.set(key, details);
                }
            }
            entries.push({ summary, details });
        }

        setStateForPath({
            blocks: blocks.payload.blocks,
            wallets: entries,
            isStoragePresent: wallets.payload.storage_present,
            isLoaded: true,
        });
    }, [devicePath]);

    const refresh = useCallback(async () => {
        const running = readStack();
        refreshInFlight.current = running;
        try {
            await running;
        } finally {
            if (refreshInFlight.current === running) refreshInFlight.current = undefined;
        }
    }, [readStack]);

    useEffect(() => {
        if (isPaused || !devicePath) return;

        let isCancelled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const loop = async () => {
            await refresh();
            if (!isCancelled) {
                timeout = setTimeout(loop, REFRESH_INTERVAL_MS);
            }
        };
        loop();

        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [isPaused, devicePath, refresh]);

    // Runs a call that waits for the user on the main block, with refreshing paused meanwhile.
    // First asks the device on this path who it is: the call is sent only to the PHYLAX main block
    // of the wallet (walletFingerprints), never to another Trezor connected at the same time.
    const runOnDevice: RunOnDevice = useCallback(
        async (call, walletFingerprints) => {
            if (!devicePath) return { kind: 'not-connected' };
            const target: PhylaxTarget = { device: { path: devicePath } };
            setIsPaused(true);
            try {
                await refreshInFlight.current;
                const identity = getPhylaxIdentity(
                    await TrezorConnect.phylaxGetBlocks(target),
                    walletFingerprints,
                );
                if (identity.kind === 'wrong-device') return identity;

                return { kind: 'done', value: await call(target, identity.mainFingerprint) };
            } finally {
                setIsPaused(false);
            }
        },
        [devicePath],
    );

    return { ...state, isPaused, runOnDevice };
};
