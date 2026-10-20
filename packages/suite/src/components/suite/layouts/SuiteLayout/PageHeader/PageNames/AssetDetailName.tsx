import { Translation } from '@suite/intl';
import { gotoThunk } from '@suite/router';
import {
    selectWalletAssetContractAddress,
    selectWalletAssetDisplaySymbol,
    selectWalletAssetName,
    selectWalletAssetSymbol,
} from '@suite-common/assets';
import { useFormatters } from '@suite-common/formatters';
import { type WalletAssetKey } from '@suite-common/wallet-core';
import { Column, IconButton, Row, Text } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { CaretLeftIcon } from '@trezor/icons';
import { TokenIcon } from '@trezor/product-components';
import { injectDispatch } from '@trezor/redux-utils';

import { TokenUrlBlur } from 'src/components/suite/TokenUrlBlur';
import { useSelector } from 'src/hooks/suite';

export const AssetDetailBackButton = () => {
    const { dispatch } = useServices(injectDispatch);

    return (
        <IconButton
            icon={CaretLeftIcon}
            intent="neutral"
            priority="secondary"
            size="large"
            onClick={() => dispatch(gotoThunk({ routeName: 'suite-index' }))}
            data-testid="@asset-detail/back"
            tooltip={{ content: <Translation id="TR_BACK" /> }}
        />
    );
};

type AssetDetailNameProps = {
    assetKey: WalletAssetKey;
};

export const AssetDetailName = ({ assetKey }: AssetDetailNameProps) => {
    const { NetworkNameFormatter } = useFormatters();
    const symbol = useSelector(state => selectWalletAssetSymbol(state, assetKey));
    const contractAddress = useSelector(state => selectWalletAssetContractAddress(state, assetKey));
    const displaySymbol = useSelector(state => selectWalletAssetDisplaySymbol(state, assetKey));
    const name = useSelector(state => selectWalletAssetName(state, assetKey));

    return (
        <Row alignItems="center" gap={16}>
            <AssetDetailBackButton />
            {symbol !== undefined && name !== undefined && (
                <Row gap={12}>
                    <TokenIcon
                        symbol={symbol}
                        contractAddress={contractAddress}
                        size={32}
                        showNetworkIcon
                        placeholder={displaySymbol ?? ''}
                    />
                    <Column alignItems="flex-start">
                        <Text typographyStyle="body-md-strong" ellipsisLineCount={1}>
                            <TokenUrlBlur text={name} />
                        </Text>
                        <Text typographyStyle="body-sm" intent="neutral" priority="secondary">
                            <NetworkNameFormatter value={symbol} />
                        </Text>
                    </Column>
                </Row>
            )}
        </Row>
    );
};
