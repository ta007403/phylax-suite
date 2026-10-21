import { render } from '@testing-library/react';

import { mockDesktopAnalytics } from '@suite/analytics/mocks';
import { EarnFlow, EarnProvider } from '@suite-common/suite-types/src/staking';
import { asNetworkSymbol } from '@suite-common/wallet-config';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';
import { ServicesProvider } from '@trezor/dependency-injection';

import { EarnInANutshellModal } from './EarnInANutshellModal';

let mockIsConfirmed = true;
jest.mock('src/hooks/suite', () => ({ useSelector: () => mockIsConfirmed }));
jest.mock('./StakingEarnInANutshellModal', () => ({ StakingEarnInANutshellModal: () => null }));
jest.mock('./UpdateEarnInANutshellModal', () => ({ UpdateEarnInANutshellModal: () => null }));
jest.mock('./YieldEarnInANutshellModal', () => ({ YieldEarnInANutshellModal: () => null }));

describe('EarnInANutshellModal skipped onboarding analytics', () => {
    beforeEach(() => {
        mockIsConfirmed = true;
    });

    it.each([undefined, 'continue', 'close'] as const)(
        'reports an automatic deposit transition only for a flow entry (%s)',
        actionType => {
            const report = jest.fn();
            const dispatch = jest.fn();
            const onCancel = jest.fn();
            const props = {
                flow: EarnFlow.Yield,
                provider: EarnProvider.Morpho,
                account: mockWalletAccount({ symbol: asNetworkSymbol('eth') }),
                analyticsStep: 'earn-dashboard',
                actionType,
                yieldContext: { id: 'test-vault', vaultAddress: '0xvault' },
                onCancel,
            } as const;
            const services = { analytics: mockDesktopAnalytics(report), store: { dispatch } };
            const view = render(
                <ServicesProvider services={services}>
                    <EarnInANutshellModal {...props} />
                </ServicesProvider>,
            );

            if (actionType === 'close') {
                expect(report).not.toHaveBeenCalled();
                expect(dispatch).not.toHaveBeenCalled();
                expect(onCancel).not.toHaveBeenCalled();
            } else {
                expect(report).toHaveBeenCalledTimes(1);
                expect(report).toHaveBeenCalledWith({
                    type: 'yield/navigate',
                    payload: {
                        action: 'continue',
                        from: 'deposit-in-a-nutshell-modal',
                        to: 'deposit-form',
                        networkSymbol: 'eth',
                        vaultId: 'test-vault',
                    },
                });
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(onCancel).toHaveBeenCalledTimes(1);
            }

            view.rerender(
                <ServicesProvider services={services}>
                    <EarnInANutshellModal {...props} />
                </ServicesProvider>,
            );
            expect(report).toHaveBeenCalledTimes(actionType === 'close' ? 0 : 1);
        },
    );

    it('does not report an automatic transition for an unconfirmed opportunity', () => {
        mockIsConfirmed = false;
        const report = jest.fn();
        render(
            <ServicesProvider
                services={{
                    analytics: mockDesktopAnalytics(report),
                    store: { dispatch: jest.fn() },
                }}
            >
                <EarnInANutshellModal
                    flow={EarnFlow.Yield}
                    provider={EarnProvider.Morpho}
                    account={mockWalletAccount({ symbol: asNetworkSymbol('eth') })}
                    analyticsStep="earn-dashboard"
                    yieldContext={{ id: 'test-vault', vaultAddress: '0xvault' }}
                    onCancel={jest.fn()}
                />
            </ServicesProvider>,
        );

        expect(report).not.toHaveBeenCalled();
    });
});
