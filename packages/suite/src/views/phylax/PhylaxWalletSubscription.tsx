// PHYLAX Blocks (fork): instant incoming payments for one wallet on one network, as Suite does for
// its own accounts. Suite's backend watches the wallet's addresses (subscribed again whenever the
// set changes or the backend reconnects) and notifies about a new transaction on any of them; the
// wallet is then scanned again. Never while Suite discovers its own accounts (same backend
// connection): the scan waits until the discovery is done.

import { useEffect, useRef } from 'react';

import { selectHasRunningDiscovery, selectNetworkBlockchainInfo } from '@suite-common/wallet-core';
import type { PROTO } from '@trezor/connect';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import { type PhylaxNetwork, getPhylaxNetworkSymbol } from './phylaxWallet';
import {
    getPhylaxAccountKey,
    selectPhylaxAccountByKey,
    selectPhylaxNotificationCount,
} from './state/phylaxReducer';
import {
    refreshPhylaxAccountThunk,
    subscribePhylaxAccountThunk,
    unsubscribePhylaxAccountThunk,
} from './state/phylaxThunks';

// One transaction notifies once per own address in it: one scan for all of them.
export const NOTIFICATION_SCAN_DELAY_MS = 1000;

type PhylaxWalletSubscriptionProps = {
    summary: PROTO.PhylaxWalletSummary;
    network: PhylaxNetwork;
};

export const PhylaxWalletSubscription = ({ summary, network }: PhylaxWalletSubscriptionProps) => {
    const key = getPhylaxAccountKey(summary, network);
    const { slot } = summary;
    const isConnected = useSelector(
        state => !!selectNetworkBlockchainInfo(state, getPhylaxNetworkSymbol(network))?.connected,
    );
    const data = useSelector(state => selectPhylaxAccountByKey(state, key)?.data);
    const notificationCount = useSelector(state => selectPhylaxNotificationCount(state, key));
    const hasRunningDiscovery = useSelector(selectHasRunningDiscovery);
    const { dispatch } = useServices(injectDispatch);
    const handledCount = useRef(notificationCount);

    // the watched addresses: they change only when a scan finds a newly used one
    const addressSet = data
        ? `${data.usedAddresses.join(',')}|${data.nextReceiveIndex}|${data.nextChangeIndex}`
        : undefined;

    useEffect(() => {
        if (!isConnected || addressSet === undefined) return;
        dispatch(subscribePhylaxAccountThunk({ slot, network }));
    }, [dispatch, slot, network, isConnected, addressSet]);

    // the wallet, or the device, is gone
    useEffect(
        () => () => {
            dispatch(unsubscribePhylaxAccountThunk({ key, network }));
        },
        [dispatch, key, network],
    );

    useEffect(() => {
        if (notificationCount === handledCount.current || hasRunningDiscovery) return;
        const timeout = setTimeout(() => {
            handledCount.current = notificationCount;
            dispatch(refreshPhylaxAccountThunk({ slot, network }));
        }, NOTIFICATION_SCAN_DELAY_MS);

        return () => clearTimeout(timeout);
    }, [dispatch, slot, network, notificationCount, hasRunningDiscovery]);

    return null;
};
