import { useMemo } from 'react';

import { Translation } from '@suite/intl';
import { selectRouterApp } from '@suite/router';
import { selectIsPhylaxDevice, selectSelectedDevice } from '@suite-common/device';
import { Column, useScrollShadow } from '@trezor/components';

import { useSelector } from 'src/hooks/suite';
import { ReduxAccountSearchProvider } from 'src/hooks/suite/useAccountSearch';
import { useResponsiveContext } from 'src/support/suite/ResponsiveContext';
import { selectDiscoveryOverallStatus } from 'src/utils/wallet/selectDiscoveryOverallStatus';
import { PhylaxAccountsMenu } from 'src/views/phylax/sidebar/PhylaxAccountsMenu';

import { AccountsList } from './AccountsList';
import { AccountsMenuHeader } from './AccountsMenuHeader';
import { AccountsMenuNotice } from './AccountsMenuNotice';

export const AccountsMenu = () => {
    const device = useSelector(selectSelectedDevice);
    const discoveryStatus = useSelector(selectDiscoveryOverallStatus);
    // PHYLAX Blocks (fork): on the PHYLAX pages a main block lists its multisig wallets; everywhere
    // else (dashboard, single-key accounts) its own single-key accounts, as in Trezor Suite
    const isPhylaxDevice = useSelector(selectIsPhylaxDevice);
    const routerApp = useSelector(selectRouterApp);
    const { scrollElementRef, ScrollSentinels, ShadowTop, ShadowBottom, ShadowContainer } =
        useScrollShadow({
            backgroundColor: 'surfaceFillSunken',
        });
    const { isSidebarCollapsed } = useResponsiveContext();

    // Kept referentially stable so that the shadows switching on and off cannot re-render the
    // list itself.
    const scrollSentinels = useMemo(() => <ScrollSentinels />, [ScrollSentinels]);

    const isDiscoveryEmpty = discoveryStatus?.type === 'discovery-empty';

    if (device && isPhylaxDevice && routerApp === 'phylax') {
        return <PhylaxAccountsMenu />;
    }

    if (isDiscoveryEmpty) {
        return null;
    }

    if (!device) {
        if (isSidebarCollapsed) return null;

        return (
            <AccountsMenuNotice>
                <Translation id="TR_ACCOUNT_NO_ACCOUNTS" />
            </AccountsMenuNotice>
        );
    }

    return (
        <ReduxAccountSearchProvider>
            <AccountsMenuHeader />
            <Column minHeight={0}>
                <ShadowContainer>
                    <ShadowTop />
                    <AccountsList
                        scrollElementRef={scrollElementRef}
                        scrollSentinels={scrollSentinels}
                    />
                    <ShadowBottom />
                </ShadowContainer>
            </Column>
        </ReduxAccountSearchProvider>
    );
};
