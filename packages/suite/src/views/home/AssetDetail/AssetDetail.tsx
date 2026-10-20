import { useMemo } from 'react';

import { useTranslation } from '@suite/intl';
import { selectWalletAssetName } from '@suite-common/assets';
import { Column } from '@trezor/components';

import { PageHeader } from 'src/components/suite/layouts/SuiteLayout';
import { useDiscovery, useLayout, useSelector } from 'src/hooks/suite';
import { type AppState } from 'src/types/suite';

import { AssetDetailBalance, AssetDetailBalanceSkeleton } from './AssetDetailBalance';
import { AssetNotExists } from './AssetNotExists';
import { RoutedAsset } from './RoutedAsset';
import { selectRoutedAssetKey } from './selectRoutedAssetKey';

const selectRoutedAssetName = (state: AppState) => {
    const assetKey = selectRoutedAssetKey(state);

    return assetKey === undefined ? undefined : selectWalletAssetName(state, assetKey);
};

const AssetDetailFallback = () => {
    const { isDiscoveryRunning } = useDiscovery();

    return isDiscoveryRunning ? <AssetDetailBalanceSkeleton /> : <AssetNotExists />;
};

export const AssetDetail = () => {
    const { translationString } = useTranslation();
    const name = useSelector(selectRoutedAssetName);
    const pageHeader = useMemo(() => <PageHeader />, []);

    useLayout(name ?? translationString('TR_ASSET'), pageHeader);

    return (
        <RoutedAsset fallback={<AssetDetailFallback />}>
            {assetKey => (
                <Column gap={16} alignItems="stretch" data-testid="@asset-detail">
                    <AssetDetailBalance assetKey={assetKey} />
                </Column>
            )}
        </RoutedAsset>
    );
};
