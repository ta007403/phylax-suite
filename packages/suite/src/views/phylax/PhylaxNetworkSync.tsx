// PHYLAX Blocks (fork): the account data of every saved wallet on one network: scanned once, and
// again on each new block of that network (confirmations, coins received or spent elsewhere).

import { useEffect, useRef } from 'react';

import { selectBlockchainHeightBySymbol } from '@suite-common/wallet-core';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork } from './phylaxWallet';
import { selectPhylaxWallets } from './state/phylaxReducer';
import { refreshPhylaxAccountsThunk } from './state/phylaxThunks';

type PhylaxNetworkSyncProps = { network: PhylaxNetwork };

export const PhylaxNetworkSync = ({ network }: PhylaxNetworkSyncProps) => {
    const wallets = useSelector(selectPhylaxWallets);
    const blockHeight = useSelector(state =>
        selectBlockchainHeightBySymbol(state, PHYLAX_COIN_SYMBOLS[network]),
    );
    const { dispatch } = useServices(injectDispatch);
    const lastBlockHeight = useRef(blockHeight);

    // wallets without data yet (a new wallet, or its xpubs just read)
    useEffect(() => {
        dispatch(refreshPhylaxAccountsThunk({ network }));
    }, [dispatch, network, wallets]);

    // a new block: every wallet again
    useEffect(() => {
        if (blockHeight === null || blockHeight === lastBlockHeight.current) return;
        lastBlockHeight.current = blockHeight;
        dispatch(refreshPhylaxAccountsThunk({ network, isForced: true }));
    }, [dispatch, network, blockHeight]);

    return null;
};
