// PHYLAX Blocks (fork): the main block's view of the stack and its saved wallets, refreshed
// while the PHYLAX page is open.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDevice } from '@suite/device';
import TrezorConnect, { type DeviceUniquePath, type PROTO } from '@trezor/connect';

const REFRESH_INTERVAL_MS = 3000;

/** Which device a PHYLAX call goes to: the connected main block. */
export type PhylaxTarget = { device: { path: DeviceUniquePath } };

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

const getWalletVersionKey = (summary: PROTO.PhylaxWalletSummary) =>
    `${summary.slot}:${summary.name}:${summary.threshold}:${summary.fingerprints.join(',')}`;

export const usePhylaxStack = () => {
    const { device } = useDevice();
    const [state, setState] = useState<PhylaxStackState>({
        blocks: [],
        wallets: [],
        isStoragePresent: false,
        isLoaded: false,
    });
    // While the user confirms a rename or delete on the main block, the device is busy with that
    // call: refreshing would fail with "call in progress".
    const [isPaused, setIsPaused] = useState(false);
    const detailsCache = useRef(new Map<string, PROTO.PhylaxWallet>());

    const devicePath = device?.path;

    const refresh = useCallback(async () => {
        if (!devicePath) return;
        const target: PhylaxTarget = { device: { path: devicePath } };

        const blocks = await TrezorConnect.phylaxGetBlocks(target);
        if (!blocks.success) {
            setState(previous => ({ ...previous, error: blocks.error.message, isLoaded: true }));

            return;
        }
        const wallets = await TrezorConnect.phylaxGetWallets(target);
        if (!wallets.success) {
            setState(previous => ({ ...previous, error: wallets.error.message, isLoaded: true }));

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

        setState({
            blocks: blocks.payload.blocks,
            wallets: entries,
            isStoragePresent: wallets.payload.storage_present,
            isLoaded: true,
        });
    }, [devicePath]);

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
    const runOnDevice = useCallback(
        async <T>(call: (target: PhylaxTarget) => Promise<T>) => {
            if (!devicePath) return undefined;
            setIsPaused(true);
            try {
                return await call({ device: { path: devicePath } });
            } finally {
                setIsPaused(false);
            }
        },
        [devicePath],
    );

    return { ...state, isPaused, runOnDevice };
};
