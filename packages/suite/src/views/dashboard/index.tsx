import { ContextMessage } from '@suite/message-system';
import { Context, ExperimentId, ExperimentWrapper } from '@suite-common/message-system';
import { Column } from '@trezor/components';

import { PHYLAX_ARE_PROMOTIONS_ENABLED } from 'src/constants/suite/phylax';
import { OutOfQuotaBanner } from 'src/components/suite/banners/SuiteBanners/OutOfQuotaBanner';
import { PageHeader } from 'src/components/suite/layouts/SuiteLayout';
import { useLayout } from 'src/hooks/suite';

import { AssetsView } from './AssetsView/AssetsView';
import { DashboardFooter } from './DashboardFooter';
import { DashboardPromoBanner } from './DashboardPromoBanner/DashboardPromoBanner';
import { OnboardingFeedbackBanner } from './OnboardingFeedbackBanner/OnboardingFeedbackBanner';
import { PortfolioCard } from './PortfolioCard/PortfolioCard';
import { useNotificationForDisconnectedDevice } from './useNotificationForDisconnectedDevice';
import { HomeAssetDashboard } from '../home/HomeAssetDashboard';

/**
 * What Home says regardless of which Home the user got.
 *
 * TODO: which of the old dashboard's parts belong in the new one is not settled. The quota banner
 * and the message system's dashboard notices are here because a user in the experiment should not
 * stop hearing about either, but `OnboardingFeedbackBanner` — and anything added here later — has
 * not been decided on, so it still shows only in the dashboard as it was.
 */
const DashboardNotices = () => (
    <>
        <OutOfQuotaBanner />
        <ContextMessage context={Context.getGeneral('dashboard')} />
    </>
);

const DashboardAsItWas = () => (
    <Column gap={48} data-testid="@dashboard/index">
        <Column gap={24}>
            <DashboardNotices />
            <PortfolioCard />
            <OnboardingFeedbackBanner />
        </Column>
        {PHYLAX_ARE_PROMOTIONS_ENABLED && <DashboardPromoBanner />}
        <AssetsView />
    </Column>
);

export const Dashboard = () => {
    // PHYLAX Blocks (fork): the footer only holds promotions (referral, desktop and mobile apps)
    useLayout(
        'Home',
        <PageHeader />,
        PHYLAX_ARE_PROMOTIONS_ENABLED ? <DashboardFooter /> : undefined,
    );
    useNotificationForDisconnectedDevice();

    return (
        <ExperimentWrapper
            id={ExperimentId.assetFirstHomeTable}
            components={[
                { variant: 'A', element: <DashboardAsItWas /> },
                {
                    variant: 'B',
                    element: (
                        <Column gap={24} data-testid="@dashboard/index">
                            <DashboardNotices />
                            <HomeAssetDashboard />
                        </Column>
                    ),
                },
            ]}
        />
    );
};
