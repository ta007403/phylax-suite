import { type TrezorDevice } from '@suite-common/suite-types';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { type AppState } from 'src/types/suite';

import { getPrerequisiteName } from './prerequisites';

const router = { app: 'wallet' } as AppState['router'];

// PHYLAX Blocks (fork): PHYLAX Suite does not use a regular Trezor, in any mode
describe('getPrerequisiteName (PHYLAX)', () => {
    it('shows "use Trezor Suite" for a regular Trezor, whatever its firmware or mode', () => {
        const devices = [
            mockSuiteDevice({ firmware: 'required' }),
            mockSuiteDevice({ firmware: 'outdated' }),
            mockSuiteDevice({ firmware: 'valid' }),
            mockSuiteDevice({ mode: 'bootloader' }),
            mockSuiteDevice({ mode: 'initialize' }),
        ];
        devices.forEach(device => {
            expect(
                getPrerequisiteName({
                    router,
                    device: { ...device, regularTrezor: true } as TrezorDevice,
                }),
            ).toBe('phylax-regular-trezor');
        });
    });

    it('leaves PHYLAX blocks and undecided devices to the usual checks', () => {
        expect(getPrerequisiteName({ router, device: mockSuiteDevice() })).toBe(null);
        expect(
            getPrerequisiteName({
                router,
                device: {
                    ...mockSuiteDevice(),
                    phylax: true,
                    regularTrezor: false,
                } as TrezorDevice,
            }),
        ).toBe(null);
        expect(
            getPrerequisiteName({ router, device: mockSuiteDevice({ firmware: 'required' }) }),
        ).toBe('firmware-required');
    });
});
