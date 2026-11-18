import { type TrezorDevice } from '@suite-common/suite-types';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { isPhylaxBlock } from './phylaxBlock';

const phylaxChecks = {
    firmwareHash: { success: false, error: 'phylax-firmware' },
    firmwareRevision: { success: false, error: 'phylax-firmware' },
} as const;

// mockSuiteDevice always reports passed checks
const withChecks = (authenticityChecks: unknown) =>
    ({ ...mockSuiteDevice(), authenticityChecks }) as TrezorDevice;

describe('isPhylaxBlock', () => {
    it('knows the main block', () => {
        expect(isPhylaxBlock({ ...mockSuiteDevice(), phylax: true } as TrezorDevice)).toBe(true);
    });

    it('knows a key block or a PHYLAX bootloader (checks reported as PHYLAX firmware)', () => {
        expect(isPhylaxBlock(withChecks(phylaxChecks))).toBe(true);
        expect(
            isPhylaxBlock(
                withChecks({
                    firmwareHash: null,
                    firmwareRevision: { success: false, error: 'phylax-firmware' },
                }),
            ),
        ).toBe(true);
    });

    it('a stock Trezor is not one', () => {
        expect(isPhylaxBlock(mockSuiteDevice())).toBe(false);
        expect(
            isPhylaxBlock(
                withChecks({
                    firmwareHash: { success: false, error: 'hash-mismatch' },
                    firmwareRevision: { success: true },
                }),
            ),
        ).toBe(false);
        expect(isPhylaxBlock(undefined)).toBe(false);
        expect(
            isPhylaxBlock({
                ...mockSuiteDevice({ type: 'unacquired' }),
                phylax: true,
            } as TrezorDevice),
        ).toBe(false);
    });
});
