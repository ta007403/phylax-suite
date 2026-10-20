import { memo } from 'react';

import { gotoThunk } from '@suite/router';
import {
    selectWalletAssetContractAddress,
    selectWalletAssetDisplaySymbol,
    selectWalletAssetSymbol,
    selectWalletAssetTokenSymbol,
} from '@suite-common/assets';
import { type WalletAssetKey } from '@suite-common/wallet-core';
import { Column, Table } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { PriceTicker, TrendTicker } from 'src/components/suite';
import { useSelector } from 'src/hooks/suite';

import { HomeAssetBalance } from './HomeAssetBalance';
import { HomeAssetIdentity } from './HomeAssetIdentity';
import { HOME_ASSET_CELL_PADDING, HOME_ASSET_LINE_GAP } from './homeAssetTableLayout';

type HomeAssetRowProps = {
    assetKey: WalletAssetKey;
    hasBorderTop?: boolean;
    isHidden?: boolean;
    onSelect?: (assetKey: WalletAssetKey) => void;
    /** The asset the row stands for is appended to it, so every row has an id of its own. */
    testIdPrefix?: string;
};

export const HomeAssetRow = memo(function HomeAssetRow({
    assetKey,
    hasBorderTop,
    isHidden,
    onSelect,
    testIdPrefix = '@dashboard/home-asset-item',
}: HomeAssetRowProps) {
    const { dispatch } = useServices(injectDispatch);
    const symbol = useSelector(state => selectWalletAssetSymbol(state, assetKey, isHidden));
    const contractAddress = useSelector(state =>
        selectWalletAssetContractAddress(state, assetKey, isHidden),
    );
    const displaySymbol = useSelector(state =>
        selectWalletAssetDisplaySymbol(state, assetKey, isHidden),
    );
    const tokenSymbol = useSelector(state =>
        selectWalletAssetTokenSymbol(state, assetKey, isHidden),
    );

    if (symbol === undefined) {
        return null;
    }

    const openAssetDetail = () =>
        dispatch(gotoThunk({ routeName: 'suite-asset', params: { symbol, contractAddress } }));

    return (
        <Table.Row
            hasBorderTop={hasBorderTop}
            onClick={onSelect ? () => onSelect(assetKey) : openAssetDetail}
            data-testid={`${testIdPrefix}/${symbol}/${contractAddress ?? 'coin'}`}
        >
            <Table.Cell padding={HOME_ASSET_CELL_PADDING.first}>
                <HomeAssetIdentity
                    symbol={symbol}
                    contractAddress={contractAddress}
                    displaySymbol={displaySymbol}
                    tokenSymbol={tokenSymbol}
                />
            </Table.Cell>

            <Table.Cell align="end">
                <Column alignItems="flex-end" gap={HOME_ASSET_LINE_GAP}>
                    <PriceTicker symbol={symbol} contractAddress={contractAddress} />
                    <TrendTicker symbol={symbol} contractAddress={contractAddress} />
                </Column>
            </Table.Cell>

            <Table.Cell align="end" padding={HOME_ASSET_CELL_PADDING.last}>
                <HomeAssetBalance assetKey={assetKey} isHidden={isHidden} />
            </Table.Cell>
        </Table.Row>
    );
});
