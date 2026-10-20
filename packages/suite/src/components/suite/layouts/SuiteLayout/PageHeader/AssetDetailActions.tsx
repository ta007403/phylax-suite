import { useDevice } from '@suite/device';
import { Translation } from '@suite/intl';
import { selectWalletAssetContractAddress } from '@suite-common/assets';
import { type WalletAssetKey } from '@suite-common/wallet-core';
import { ButtonGroup, Dropdown, type DropdownMenuItemProps, Row } from '@trezor/components';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, PlusIcon } from '@trezor/icons';

import { HeaderActionButton } from 'src/components/suite/layouts/SuiteLayout/PageHeader/HeaderActionButton';
import { useSelector } from 'src/hooks/suite';

type AssetDetailActionsProps = {
    assetKey: WalletAssetKey;
};

export const AssetDetailActions = ({ assetKey }: AssetDetailActionsProps) => {
    const { device } = useDevice();
    const isDeviceConnected = device?.connected && device?.available;
    const isToken = useSelector(
        state => selectWalletAssetContractAddress(state, assetKey) !== undefined,
    );

    const moreItems: DropdownMenuItemProps[] = [
        {
            label: <Translation id="TR_WALLETCONNECT" />,
            'data-testid': '@asset-detail/menu/walletconnect',
        },
        {
            label: <Translation id="TR_HIDE_TOKEN" />,
            isHidden: !isToken,
            'data-testid': '@asset-detail/menu/hide-token',
        },
        {
            label: <Translation id="TR_VIEW_IN_EXPLORER" />,
            'data-testid': '@asset-detail/menu/explorer',
        },
        {
            label: <Translation id="TR_CONTRACT_ADDRESS" />,
            isHidden: !isToken,
            'data-testid': '@asset-detail/menu/contract-address',
        },
    ];

    return (
        <Row gap={12} alignItems="center">
            <Dropdown
                placement={{ position: 'bottom', alignment: 'start' }}
                data-testid="@asset-detail/menu/more"
                tooltip={{ content: <Translation id="TR_SHOW_MORE" />, placement: 'left' }}
                items={moreItems}
            />
            <ButtonGroup intent="neutral" priority="secondary">
                <HeaderActionButton icon={PlusIcon} data-testid="@asset-detail/menu/buy">
                    <Translation id="TR_NAV_BUY" />
                </HeaderActionButton>
                <HeaderActionButton icon={MinusIcon} data-testid="@asset-detail/menu/sell">
                    <Translation id="TR_NAV_SELL" />
                </HeaderActionButton>
            </ButtonGroup>
            <ButtonGroup
                intent={isDeviceConnected ? 'brand' : 'neutral'}
                priority={isDeviceConnected ? 'primary' : 'secondary'}
            >
                <HeaderActionButton icon={ArrowDownIcon} data-testid="@asset-detail/menu/receive">
                    <Translation id="TR_NAV_RECEIVE" />
                </HeaderActionButton>
                <HeaderActionButton icon={ArrowUpIcon} data-testid="@asset-detail/menu/send">
                    <Translation id="TR_NAV_SEND" />
                </HeaderActionButton>
            </ButtonGroup>
        </Row>
    );
};
