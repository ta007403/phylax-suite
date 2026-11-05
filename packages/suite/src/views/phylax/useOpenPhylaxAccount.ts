// PHYLAX Blocks (fork): opens the account page of a saved wallet on one network.

import { useCallback } from 'react';

import { gotoThunk } from '@suite/router';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import type { PhylaxNetwork } from './phylaxWallet';
import { phylaxActions } from './state/phylaxReducer';

export const useOpenPhylaxAccount = () => {
    const { dispatch } = useServices(injectDispatch);

    return useCallback(
        (slot: number, network: PhylaxNetwork) => {
            dispatch(phylaxActions.selectAccount({ slot, network }));
            dispatch(gotoThunk({ routeName: 'phylax-account' }));
        },
        [dispatch],
    );
};
