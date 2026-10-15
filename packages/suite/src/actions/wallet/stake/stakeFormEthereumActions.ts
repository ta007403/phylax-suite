import { type UnknownAction } from '@reduxjs/toolkit';
import { type ThunkDispatch } from 'redux-thunk';

import {
    type SignPreparedEthereumStakingTransactionThunkState,
    WALLET_SDK_SOURCE,
    composeEthereumStakingTransaction,
    isEarnSigningCancelled,
    prepareEthereumStakingContext,
    signPreparedEthereumStakingTransactionThunk,
} from '@suite-common/wallet-core';
import {
    type ComposeActionContext,
    type PrecomposedTransactionFinal,
    type StakeFormState,
} from '@suite-common/wallet-types';
import { type SelectedAccountRootState, selectFullSelectedAccount } from '@suite/account';

import { events } from '@suite/analytics';
import {
    type StakeSignResult,
    type StakeSignThunkDeps,
    handleStakeSignRejection,
    isBaseStakeType,
    reportStakeSignFailure,
} from './stakeSignUtils';

export const composeTransaction =
    (formValues: StakeFormState, formState: ComposeActionContext) => () =>
        composeEthereumStakingTransaction({
            formValues,
            composeContext: formState,
            source: WALLET_SDK_SOURCE,
        });

type SignTransactionThunkState = SelectedAccountRootState &
    SignPreparedEthereumStakingTransactionThunkState;

type SignTransactionThunkDeps = StakeSignThunkDeps;

export const signTransactionThunk =
    (formValues: StakeFormState, transactionInfo: PrecomposedTransactionFinal) =>
    async (
        dispatch: ThunkDispatch<SignTransactionThunkState, SignTransactionThunkDeps, UnknownAction>,
        getState: () => SignTransactionThunkState,
        extra: SignTransactionThunkDeps,
    ): Promise<StakeSignResult> => {
        const selectedAccount = selectFullSelectedAccount(getState());
        if (selectedAccount.status !== 'loaded' || transactionInfo?.type !== 'final') return;

        const { account } = selectedAccount;
        const { stakeType } = formValues;
        if (account.networkType !== 'ethereum' || !isBaseStakeType(stakeType)) return;

        const prepared = prepareEthereumStakingContext(getState(), {
            accountKey: account.key,
            stakeType,
            precomposedTransaction: transactionInfo,
            formValues,
            source: WALLET_SDK_SOURCE,
        });

        if (!prepared.ok) {
            return reportStakeSignFailure(dispatch, prepared.error.message);
        }

        const signed = await dispatch(
            signPreparedEthereumStakingTransactionThunk({ context: prepared.context }),
        );

        if (signPreparedEthereumStakingTransactionThunk.rejected.match(signed)) {
            if (isEarnSigningCancelled(signed.error)) {
                extra.services.analytics.report({
                    type: events.transactionCancelEvent.name,
                    payload: {
                        txType: 'stake',
                        networkSymbol: account.symbol,
                        stage: 'signing',
                    },
                });
            }

            return handleStakeSignRejection({ dispatch, error: signed.payload });
        }

        return signed.payload.serializedTx;
    };
