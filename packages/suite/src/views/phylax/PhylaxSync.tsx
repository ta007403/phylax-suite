// PHYLAX Blocks (fork): keeps the PHYLAX store up to date while a PHYLAX main block is selected.
// - The stack: read once when the device is selected; every few seconds only while a PHYLAX page
//   is open (it shows the blocks). Never while a call waits for the user on the main block, and
//   never while Suite itself talks to the device (unlocking, discovery of the main block's own
//   accounts): a second call at the same time fails one of them with "Device call in progress",
//   which made the discovery fail ("Discovery error").
// - The accounts: every saved wallet on every enabled Bitcoin network, scanned once, and again on
//   each new block of that network. Backend lookups only, no device calls.

import { useEffect } from 'react';

import { useDevice } from '@suite/device';
import { selectIsDeviceLocked } from '@suite/locks';
import { selectRouterApp } from '@suite/router';
import { selectIsPhylaxDevice } from '@suite-common/device';
import {
    selectDiscoveryForSelectedDevice,
    selectEnabledNetworks,
    selectHasRunningDiscovery,
} from '@suite-common/wallet-core';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import { PhylaxNetworkSync } from './PhylaxNetworkSync';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork } from './phylaxWallet';
import { phylaxActions, selectPhylaxIsLoaded, selectPhylaxIsPaused } from './state/phylaxReducer';
import { refreshPhylaxStackThunk } from './state/phylaxThunks';

const REFRESH_INTERVAL_MS = 3000;

const NETWORK_BY_SYMBOL: Partial<Record<string, PhylaxNetwork>> = {
    [PHYLAX_COIN_SYMBOLS.mainnet]: 'mainnet',
    [PHYLAX_COIN_SYMBOLS.testnet]: 'testnet',
};

export const PhylaxSync = () => {
    const isPhylaxDevice = useSelector(selectIsPhylaxDevice);
    const isLoaded = useSelector(selectPhylaxIsLoaded);
    const isPaused = useSelector(selectPhylaxIsPaused);
    const routerApp = useSelector(selectRouterApp);
    const enabledNetworks = useSelector(selectEnabledNetworks);
    const isDeviceLocked = useSelector(selectIsDeviceLocked);
    const hasRunningDiscovery = useSelector(selectHasRunningDiscovery);
    const hasDiscovery = useSelector(
        state => selectDiscoveryForSelectedDevice(state) !== undefined,
    );
    const { device } = useDevice();
    const { dispatch } = useServices(injectDispatch);

    const devicePath = isPhylaxDevice ? device?.path : undefined;
    const isPhylaxPageOpen = routerApp === 'phylax';
    // Suite is done with the device: unlocked (it has a state), its discovery created and finished
    const isDeviceFree = !!device?.state && hasDiscovery && !hasRunningDiscovery && !isDeviceLocked;

    useEffect(() => {
        dispatch(phylaxActions.deviceChanged(devicePath));
    }, [dispatch, devicePath]);

    useEffect(() => {
        if (!devicePath || isPaused || !isDeviceFree) return;
        if (!isPhylaxPageOpen) {
            if (!isLoaded) dispatch(refreshPhylaxStackThunk());

            return;
        }

        let isCancelled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const loop = async () => {
            await dispatch(refreshPhylaxStackThunk());
            if (!isCancelled) timeout = setTimeout(loop, REFRESH_INTERVAL_MS);
        };
        loop();

        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [dispatch, devicePath, isPaused, isDeviceFree, isPhylaxPageOpen, isLoaded]);

    if (!devicePath) return null;

    const networks = enabledNetworks
        .map(symbol => NETWORK_BY_SYMBOL[symbol])
        .filter((network): network is PhylaxNetwork => network !== undefined);

    return (
        <>
            {networks.map(network => (
                <PhylaxNetworkSync key={network} network={network} />
            ))}
        </>
    );
};
