import { type Dispatch, type UnknownAction } from '@reduxjs/toolkit';
import { type ThunkDispatch } from 'redux-thunk';

import {
    type BlockchainRootState,
    type ResolveSolanaStakingContextState,
    type SignPreparedSolanaStakingTransactionThunkState,
    WALLET_SDK_SOURCE,
    composeSolanaStakingTransaction,
    getSolanaStakingUserAgent,
    isEarnSigningCancelled,
    prepareSolanaStakingSignContext,
    selectBlockchainUrlBySymbol,
    signPreparedSolanaStakingTransactionThunk,
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
    reportStakeSignFailure,
} from './stakeSignUtils';

type ComposeTransactionThunkState = BlockchainRootState & SelectedAccountRootState;

export const composeTransactionThunk =
    (formValues: StakeFormState, formState: ComposeActionContext) =>
    async (_: Dispatch<UnknownAction>, getState: () => ComposeTransactionThunkState) => {
        const selectedAccount = selectFullSelectedAccount(getState());

        if (selectedAccount.status !== 'loaded') return;

        const { account } = selectedAccount;
        if (account.networkType !== 'solana') return;

        const blockchainUrl = selectBlockchainUrlBySymbol(getState(), account.symbol);
        if (!blockchainUrl) return;

        return await composeSolanaStakingTransaction({
            formValues,
            composeContext: formState,
            blockchainUrl,
            userAgent: getSolanaStakingUserAgent(),
        });
    };

type SignTransactionThunkState = ResolveSolanaStakingContextState &
    SelectedAccountRootState &
    SignPreparedSolanaStakingTransactionThunkState;

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
        if (account.networkType !== 'solana') return;

        const prepared = await prepareSolanaStakingSignContext(getState(), {
            accountKey: account.key,
            stakeType: formValues.stakeType,
            precomposedTransaction: transactionInfo,
            source: WALLET_SDK_SOURCE,
        });

        if (!prepared.ok) {
            return reportStakeSignFailure(dispatch, prepared.error.message);
        }

        const signed = await dispatch(
            signPreparedSolanaStakingTransactionThunk({ context: prepared.context }),
        );

        if (signPreparedSolanaStakingTransactionThunk.rejected.match(signed)) {
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
