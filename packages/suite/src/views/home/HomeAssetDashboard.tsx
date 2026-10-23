import { memo } from 'react';

import { Nfts } from '@suite/nfts';
import { Column } from '@trezor/components';

import { PHYLAX_ARE_PROMOTIONS_ENABLED } from 'src/constants/suite/phylax';
import { HomeAssetFeedback } from './HomeAssetFeedback';
import { HomeAssetTable } from './HomeAssetsTable/HomeAssetTable';
import { HomeBalanceCard } from './HomeBalance/HomeBalanceCard';
import { DashboardPromoBanner } from '../dashboard/DashboardPromoBanner/DashboardPromoBanner';

export const HomeAssetDashboard = memo(() => (
    <Column gap={16} data-testid="@dashboard/home-asset">
        <HomeBalanceCard />
        {PHYLAX_ARE_PROMOTIONS_ENABLED && <DashboardPromoBanner />}
        <HomeAssetTable />
        <Nfts />
        <HomeAssetFeedback />
    </Column>
));
