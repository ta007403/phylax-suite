// PHYLAX Blocks (fork): the account data of one saved wallet on one network, from the PHYLAX store.

import { useCallback, useEffect, useMemo } from 'react';

import type { PROTO } from '@trezor/connect';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { useSelector } from 'src/hooks/suite';

import type { PhylaxAccountData } from './phylaxAccountScan';
import type { PhylaxNetwork } from './phylaxWallet';
import {
    deserializePhylaxAccountData,
    getPhylaxAccountKey,
    selectPhylaxAccountByKey,
} from './state/phylaxReducer';
import {
    refreshPhylaxAccountAndRecheckThunk,
    refreshPhylaxAccountThunk,
} from './state/phylaxThunks';

export type PhylaxAccount =
    | { status: 'loading' }
    | { status: 'error'; error: string; refresh: () => void }
    | {
          status: 'loaded';
          data: PhylaxAccountData;
          isRefreshing: boolean;
          // the last refresh failed; data is from the scan before
          error: string | undefined;
          updatedAt: number | undefined;
          refresh: () => void;
          refreshAfterSend: () => void;
      };

export const usePhylaxAccount = (
    summary: PROTO.PhylaxWalletSummary,
    // undefined until the xpubs are read: nothing to scan yet
    hasDetails: boolean,
    network: PhylaxNetwork,
): PhylaxAccount => {
    const key = getPhylaxAccountKey(summary, network);
    const account = useSelector(state => selectPhylaxAccountByKey(state, key));
    const { dispatch } = useServices(injectDispatch);
    const { slot } = summary;

    // A network not enabled in Suite has no background scans: the page asks for one.
    const isMissing = account === undefined;
    useEffect(() => {
        if (hasDetails && isMissing) dispatch(refreshPhylaxAccountThunk({ slot, network }));
    }, [dispatch, hasDetails, isMissing, slot, network]);

    const refresh = useCallback(() => {
        dispatch(refreshPhylaxAccountThunk({ slot, network }));
    }, [dispatch, slot, network]);
    const refreshAfterSend = useCallback(() => {
        dispatch(refreshPhylaxAccountAndRecheckThunk({ slot, network }));
    }, [dispatch, slot, network]);

    const storedData = account?.data;
    const data = useMemo(
        () => (storedData ? deserializePhylaxAccountData(storedData) : undefined),
        [storedData],
    );

    if (data) {
        return {
            status: 'loaded',
            data,
            isRefreshing: account?.isRefreshing ?? false,
            error: account?.error,
            updatedAt: account?.updatedAt,
            refresh,
            refreshAfterSend,
        };
    }
    if (account?.error) return { status: 'error', error: account.error, refresh };

    return { status: 'loading' };
};
