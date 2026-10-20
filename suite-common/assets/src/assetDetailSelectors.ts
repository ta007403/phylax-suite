import { shallowEqual } from 'react-redux';

import { selectSelectedDevice } from '@suite-common/device';
import { type NetworkSymbol } from '@suite-common/wallet-config';
import {
    type TransactionsRootState,
    type WalletAssetKey,
    getWalletAssetKey,
    selectDeviceAssetAccounts,
    selectTransactions,
} from '@suite-common/wallet-core';
import {
    type AccountKey,
    type TokenAddress,
    type WalletAccountTransaction,
} from '@suite-common/wallet-types';
import { sortByBlockHeight } from '@suite-common/wallet-utils';
import { createWeakMapSelector, returnStableArrayIfEmpty } from '@trezor/redux-utils';
import { BigNumber } from '@trezor/utils';

import {
    type HomeAssetTableState,
    selectWalletAssetContractAddress,
} from './homeAssetTableSelectors';

export type AssetDetailState = HomeAssetTableState & TransactionsRootState;

const createMemoizedSelector = createWeakMapSelector.withTypes<AssetDetailState>();

const NO_ACCOUNT_KEYS: readonly AccountKey[] = [];

export const selectAssetDetailKey = (
    state: AssetDetailState,
    symbol: NetworkSymbol,
    contractAddress?: TokenAddress,
): WalletAssetKey | undefined => {
    const deviceState = selectSelectedDevice(state)?.state?.staticSessionId;

    return deviceState === undefined
        ? undefined
        : getWalletAssetKey({ deviceState, symbol, contractAddress });
};

const selectHoldingAccountCountByAssetKey = createMemoizedSelector(
    [selectDeviceAssetAccounts],
    (assetAccounts): ReadonlyMap<WalletAssetKey, number> =>
        assetAccounts
            .filter(({ cryptoBalance }) => new BigNumber(cryptoBalance).gt(0))
            .reduce(
                (counts, { assetKey }) => counts.set(assetKey, (counts.get(assetKey) ?? 0) + 1),
                new Map<WalletAssetKey, number>(),
            ),
);

export const selectWalletAssetHoldingAccountCount = (
    state: AssetDetailState,
    assetKey: WalletAssetKey,
) => selectHoldingAccountCountByAssetKey(state).get(assetKey) ?? 0;

const selectAccountKeysByAssetKey = createMemoizedSelector(
    [selectDeviceAssetAccounts],
    (assetAccounts): ReadonlyMap<WalletAssetKey, readonly AccountKey[]> =>
        assetAccounts.reduce((byAssetKey, { assetKey, accountKey }) => {
            const keys = byAssetKey.get(assetKey);

            if (keys === undefined) {
                byAssetKey.set(assetKey, [accountKey]);
            } else {
                keys.push(accountKey);
            }

            return byAssetKey;
        }, new Map<WalletAssetKey, AccountKey[]>()),
);

export const selectWalletAssetAccountKeys = (state: AssetDetailState, assetKey: WalletAssetKey) =>
    selectAccountKeysByAssetKey(state).get(assetKey) ?? NO_ACCOUNT_KEYS;

const isTransferOf = (transaction: WalletAccountTransaction, contractAddress: TokenAddress) =>
    transaction.tokens.some(
        token => token.contract.toLowerCase() === contractAddress.toLowerCase(),
    );

export const selectWalletAssetTransactions = createMemoizedSelector(
    [
        selectWalletAssetAccountKeys,
        selectTransactions,
        (state: AssetDetailState, assetKey: WalletAssetKey) =>
            selectWalletAssetContractAddress(state, assetKey),
    ],
    (accountKeys, transactionsByAccount, contractAddress): readonly WalletAccountTransaction[] =>
        returnStableArrayIfEmpty(
            accountKeys
                .flatMap(accountKey =>
                    (transactionsByAccount[accountKey] ?? []).filter(
                        (transaction): transaction is WalletAccountTransaction =>
                            !!transaction &&
                            (contractAddress === undefined ||
                                isTransferOf(transaction, contractAddress)),
                    ),
                )
                .sort(sortByBlockHeight),
        ),
    { memoizeOptions: { resultEqualityCheck: shallowEqual } },
);
