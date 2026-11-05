// PHYLAX Blocks (fork): the main block's view of the stack and its saved wallets (kept up to date
// by PhylaxSync), and runOnDevice for requests that go to the main block.

import { useCallback } from 'react';

import TrezorConnect, { type DeviceUniquePath } from '@trezor/connect';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import { type PhylaxIdentity, getPhylaxIdentity } from './phylaxIdentity';
import { phylaxActions, selectPhylaxStack } from './state/phylaxReducer';
import { refreshPhylaxStackThunk, waitForPhylaxStackRefresh } from './state/phylaxThunks';

export type { PhylaxWalletEntry } from './state/phylaxReducer';

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

export const usePhylaxStack = () => {
    const stack = useSelector(selectPhylaxStack);
    const { dispatch } = useServices(injectDispatch);
    const { devicePath } = stack;

    // Runs a call that waits for the user on the main block, with refreshing paused meanwhile.
    // First asks the device on this path who it is: the call is sent only to the PHYLAX main block
    // of the wallet (walletFingerprints), never to another Trezor connected at the same time.
    // The stack is read again afterwards (a rename, a delete or an unlock changes it).
    const runOnDevice: RunOnDevice = useCallback(
        async (call, walletFingerprints) => {
            if (!devicePath) return { kind: 'not-connected' };
            const target: PhylaxTarget = { device: { path: devicePath as DeviceUniquePath } };
            dispatch(phylaxActions.setPaused(true));
            try {
                await waitForPhylaxStackRefresh();
                const identity = getPhylaxIdentity(
                    await TrezorConnect.phylaxGetBlocks(target),
                    walletFingerprints,
                );
                if (identity.kind === 'wrong-device') return identity;

                return { kind: 'done', value: await call(target, identity.mainFingerprint) };
            } finally {
                dispatch(phylaxActions.setPaused(false));
                dispatch(refreshPhylaxStackThunk());
            }
        },
        [devicePath, dispatch],
    );

    return {
        blocks: stack.blocks,
        wallets: stack.wallets,
        isStoragePresent: stack.isStoragePresent,
        error: stack.error,
        isLoaded: stack.isLoaded,
        isPaused: stack.isPaused,
        runOnDevice,
    };
};
