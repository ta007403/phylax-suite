// PHYLAX Blocks (fork): the account data of every saved wallet on one network. Each multisig scan
// asks Suite's backend about its addresses one by one, so scans are kept few (owner's choice):
// - once, when a wallet has no data yet;
// - on a new block, the wallets with a pending transaction (it may be confirmed now);
// - every FULL_SCAN_BLOCKS blocks (about an hour), every wallet (coins received meanwhile);
// - after a send, and with the Refresh button (usePhylaxAccount);
// - at once when the backend notifies about a new transaction on its addresses
//   (PhylaxWalletSubscription).
// Never while Suite discovers its own accounts: both use the same backend connection.

import { useEffect, useRef } from 'react';

import {
    selectBlockchainHeightBySymbol,
    selectHasRunningDiscovery,
} from '@suite-common/wallet-core';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import { PhylaxWalletSubscription } from './PhylaxWalletSubscription';
import { type PhylaxNetwork, getPhylaxNetworkSymbol } from './phylaxWallet';
import { getPhylaxAccountKey, selectPhylaxWallets } from './state/phylaxReducer';
import { refreshPhylaxAccountsThunk } from './state/phylaxThunks';

export const FULL_SCAN_BLOCKS = 6;

type PhylaxNetworkSyncProps = { network: PhylaxNetwork };

export const PhylaxNetworkSync = ({ network }: PhylaxNetworkSyncProps) => {
    const wallets = useSelector(selectPhylaxWallets);
    const blockHeight = useSelector(state =>
        selectBlockchainHeightBySymbol(state, getPhylaxNetworkSymbol(network)),
    );
    const hasRunningDiscovery = useSelector(selectHasRunningDiscovery);
    const { dispatch } = useServices(injectDispatch);
    const lastBlockHeight = useRef(blockHeight);
    const lastFullScanHeight = useRef(blockHeight);

    // wallets without data yet (a new wallet, or its xpubs just read)
    useEffect(() => {
        if (hasRunningDiscovery) return;
        dispatch(refreshPhylaxAccountsThunk({ network, which: 'missing' }));
    }, [dispatch, network, wallets, hasRunningDiscovery]);

    // a new block
    useEffect(() => {
        if (blockHeight === null || blockHeight === lastBlockHeight.current) return;
        if (hasRunningDiscovery) return;
        lastBlockHeight.current = blockHeight;
        const isFullScanDue =
            lastFullScanHeight.current === null ||
            blockHeight - lastFullScanHeight.current >= FULL_SCAN_BLOCKS;
        if (isFullScanDue) lastFullScanHeight.current = blockHeight;
        dispatch(refreshPhylaxAccountsThunk({ network, which: isFullScanDue ? 'all' : 'pending' }));
    }, [dispatch, network, blockHeight, hasRunningDiscovery]);

    return (
        <>
            {wallets.map(({ summary }) => (
                <PhylaxWalletSubscription
                    key={getPhylaxAccountKey(summary, network)}
                    summary={summary}
                    network={network}
                />
            ))}
        </>
    );
};
