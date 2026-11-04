import { countConnectedDevices, getPhylaxIdentity } from './phylaxIdentity';

const MAIN = 0x25a66c01;
const KEY = 0x2b69c617;
const OTHER = 0x12345678;

const blocks = (mainFingerprint?: number) => ({
    success: true as const,
    payload: {
        blocks: [
            { address: 1, kind: 0, unique_id: 'aa', fingerprint: mainFingerprint },
            { address: 0x10, kind: 1, unique_id: 'bb', fingerprint: KEY },
        ],
    },
});

describe('getPhylaxIdentity', () => {
    it('accepts the main block of the wallet', () => {
        expect(getPhylaxIdentity(blocks(MAIN), [MAIN, KEY])).toEqual({
            kind: 'main-block',
            mainFingerprint: MAIN,
        });
    });

    it('accepts a locked main block (no fingerprint yet)', () => {
        expect(getPhylaxIdentity(blocks(undefined), [MAIN, KEY])).toEqual({
            kind: 'main-block',
            mainFingerprint: undefined,
        });
    });

    it('refuses a device that does not know PHYLAX messages (a plain Trezor)', () => {
        const identity = getPhylaxIdentity(
            { success: false, error: { message: 'Unexpected message' } },
            [MAIN, KEY],
        );
        expect(identity.kind).toBe('wrong-device');
        expect(identity.kind === 'wrong-device' && identity.text).toContain('another Trezor');
    });

    it('refuses an answer without a main block', () => {
        const response = { success: true as const, payload: { blocks: [] } };
        expect(getPhylaxIdentity(response, [MAIN, KEY]).kind).toBe('wrong-device');
    });

    it('refuses a main block that is not part of the wallet', () => {
        const identity = getPhylaxIdentity(blocks(OTHER), [MAIN, KEY]);
        expect(identity.kind === 'wrong-device' && identity.text).toContain('12345678');
    });
});

describe('countConnectedDevices', () => {
    it('counts plugged-in devices once, whatever the number of wallet instances', () => {
        expect(
            countConnectedDevices([
                { connected: true, path: '1' },
                { connected: true, path: '1' },
                { connected: false, path: '2' },
            ]),
        ).toBe(1);
        expect(
            countConnectedDevices([
                { connected: true, path: '1' },
                { connected: true, path: '2' },
            ]),
        ).toBe(2);
    });
});
