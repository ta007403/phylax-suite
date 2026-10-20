import { type ReactNode } from 'react';

import { type WalletAssetKey } from '@suite-common/wallet-core';

import { useSelector } from 'src/hooks/suite';

import { selectRoutedAssetKey } from './selectRoutedAssetKey';

type RoutedAssetProps = {
    children: (assetKey: WalletAssetKey) => ReactNode;
    fallback?: ReactNode;
};

export const RoutedAsset = ({ children, fallback = null }: RoutedAssetProps) => {
    const assetKey = useSelector(selectRoutedAssetKey);

    return assetKey === undefined ? fallback : children(assetKey);
};
