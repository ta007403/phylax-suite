import { selectSelectedDevice } from '@suite-common/device';
import { type NetworkSymbol } from '@suite-common/wallet-config';
import {
    type WalletAssetKey,
    getWalletAssetKey,
    selectDeviceAssetAccounts,
} from '@suite-common/wallet-core';
import { type TokenAddress } from '@suite-common/wallet-types';
import { createWeakMapSelector } from '@trezor/redux-utils';
import { BigNumber } from '@trezor/utils';

import { type HomeAssetTableState } from './homeAssetTableSelectors';

export type AssetDetailState = HomeAssetTableState;

const createMemoizedSelector = createWeakMapSelector.withTypes<AssetDetailState>();

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
