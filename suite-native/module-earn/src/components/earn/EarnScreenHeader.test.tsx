import { type NativeAnalyticsDep } from '@suite-native/analytics';
import { mockNativeAnalytics } from '@suite-native/analytics/mocks';
import { renderWithStoreProvider } from '@suite-native/test-utils-store';
import { mock } from '@trezor/dependency-injection';

import { EarnScreenHeader } from './EarnScreenHeader';
import {
    selectCardanoStakedWithFiveBinariesAccountKey,
    selectStakingListItems,
    selectYieldClaimListItems,
    selectYieldListItems,
} from '../../earnScreenSelectors';
import { useClaimRewardsWithFiat } from '../../hooks/yield/useClaimRewardsWithFiat';
import { useYieldOpportunities } from '../../hooks/yield/useYieldOpportunities';

jest.mock('../../hooks/earn/useMessageSystemEarnDashboard', () => ({
    useMessageSystemEarnDashboard: () => ({ isDisabled: false }),
}));
jest.mock('../../hooks/yield/useYieldOpportunities');
jest.mock('../../hooks/yield/useClaimRewardsWithFiat');
jest.mock('../../earnScreenSelectors', () => ({
    ...jest.requireActual('../../earnScreenSelectors'),
    selectStakingListItems: jest.fn(),
    selectYieldListItems: jest.fn(),
    selectYieldClaimListItems: jest.fn(),
    selectCardanoStakedWithFiveBinariesAccountKey: jest.fn(),
}));

describe('EarnScreenHeader analytics', () => {
    beforeEach(() => {
        jest.mocked(selectStakingListItems).mockReturnValue([]);
        jest.mocked(selectYieldListItems).mockReturnValue([]);
        jest.mocked(selectYieldClaimListItems).mockReturnValue([]);
        jest.mocked(selectCardanoStakedWithFiveBinariesAccountKey).mockReturnValue(null);
        jest.mocked(useYieldOpportunities).mockReturnValue({
            yieldOpportunities: [],
            isLoading: false,
            isError: false,
            refetch: mock(),
        });
        jest.mocked(useClaimRewardsWithFiat).mockReturnValue({
            claimRewardsWithFiat: [],
            isClaimLoading: false,
            isClaimError: false,
        });
    });

    it('reports a ready dashboard even when no positions or rewards render the header', async () => {
        const services: NativeAnalyticsDep = { analytics: mockNativeAnalytics(jest.fn()) };
        const { toJSON } = await renderWithStoreProvider(<EarnScreenHeader />, { services });

        expect(toJSON()).toBeNull();
        expect(services.analytics.report).toHaveBeenCalledTimes(1);
        expect(services.analytics.report).toHaveBeenCalledWith({
            type: 'yield/earn-dashboard-ready',
            payload: {
                hasClaimBanner: false,
                hasActivePosition: false,
                availableVaultCount: 0,
            },
        });
    });

    it.each([
        { isLoading: true, isError: false },
        { isLoading: false, isError: true },
    ])('waits for successful opportunities ($isLoading, $isError)', async status => {
        jest.mocked(useYieldOpportunities).mockReturnValue({
            yieldOpportunities: [],
            refetch: mock(),
            ...status,
        });
        const services: NativeAnalyticsDep = { analytics: mockNativeAnalytics(jest.fn()) };

        await renderWithStoreProvider(<EarnScreenHeader />, { services });

        expect(services.analytics.report).not.toHaveBeenCalled();
    });

    it.each([
        { isClaimLoading: true, isClaimError: false },
        { isClaimLoading: false, isClaimError: true },
    ])('waits for successful rewards ($isClaimLoading, $isClaimError)', async status => {
        jest.mocked(useClaimRewardsWithFiat).mockReturnValue({
            claimRewardsWithFiat: [],
            ...status,
        });
        const services: NativeAnalyticsDep = { analytics: mockNativeAnalytics(jest.fn()) };

        await renderWithStoreProvider(<EarnScreenHeader />, { services });

        expect(services.analytics.report).not.toHaveBeenCalled();
    });
});
