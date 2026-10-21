import { act, renderHook } from '@suite-common/test-utils';
import { type FeeInfo } from '@suite-common/wallet-types';
import { getConvertedOrDefaultFeeInfo } from '@suite-common/wallet-utils';

import { useEvmTxSimulationFeesForm } from './useEvmTxSimulationFeesForm';

jest.mock('src/hooks/suite', () => ({ useSelector: () => undefined }));
jest.mock('src/hooks/wallet/form/useFees', () => ({
    useFees: () => ({ changeFeeLevel: jest.fn() }),
}));
jest.mock('src/hooks/wallet/form/useComposedLevelsPlaceholder', () => ({
    useComposedLevelsPlaceholder: () => ({}),
}));
jest.mock('@suite-common/wallet-utils', () => ({
    ...jest.requireActual('@suite-common/wallet-utils'),
    getConvertedOrDefaultFeeInfo: jest.fn(),
}));

describe('useEvmTxSimulationFeesForm selection', () => {
    it.each(['legacy', 'eip1559'] as const)(
        'preserves the chosen fee label alongside %s gas values',
        type => {
            const feeInfo: FeeInfo = {
                blockHeight: 0,
                blockTime: 12,
                minFee: 0,
                maxFee: 100,
                minPriorityFee: 0,
                levels: (['low', 'normal', 'high'] as const).map(label => ({
                    label,
                    blocks: 1,
                    feePerUnit: '1',
                    ...(type === 'eip1559'
                        ? {
                              maxFeePerGas: '1',
                              maxPriorityFeePerGas: '0.1',
                              baseFeePerGas: '0.5',
                          }
                        : {}),
                })),
            };
            jest.mocked(getConvertedOrDefaultFeeInfo).mockReturnValue(feeInfo);
            const { result } = renderHook(() =>
                useEvmTxSimulationFeesForm({
                    accountBalance: '1000000000000000000',
                    defaultGasLimit: '21000',
                }),
            );

            for (const label of ['low', 'normal', 'high', 'custom'] as const) {
                act(() => result.current.form.setValue('selectedFee', label));

                expect(result.current.getSelectedFee()).toMatchObject({
                    type,
                    label,
                    gasLimit: '0x5208',
                });
            }
        },
    );
});
