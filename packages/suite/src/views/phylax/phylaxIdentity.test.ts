import { countConnectedDevices, getPhylaxIdentity, getSavedWalletProblem } from './phylaxIdentity';

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

describe('getSavedWalletProblem', () => {
    const KEY_2 = 0x31da3384;
    const KEY_3 = 0xe5989437;
    // the hardware case: a 3-of-3 of the key blocks only, saved on the main block in slot 4
    const keysOnly = [KEY, KEY_2, KEY_3];
    const saved = {
        success: true as const,
        payload: {
            storage_present: true,
            ignored: [],
            wallets: [
                { slot: 3, name: '3-of-3 #1', threshold: 3, fingerprints: [MAIN, KEY, KEY_3] },
                { slot: 4, name: '3-of-3 #2', threshold: 3, fingerprints: keysOnly },
            ],
        },
    };

    it('lets the main block holding the wallet rename or delete it, also without its own key', () => {
        expect(getPhylaxIdentity(blocks(MAIN), keysOnly).kind).toBe('wrong-device');
        expect(getSavedWalletProblem(saved, 4, [KEY_3, KEY, KEY_2])).toBeUndefined();
    });

    it('refuses a main block that does not hold the wallet in that slot', () => {
        expect(getSavedWalletProblem(saved, 3, keysOnly)).toMatch(/does not hold this wallet/);
        expect(getSavedWalletProblem(saved, 5, keysOnly)).toMatch(/does not hold this wallet/);
        expect(getSavedWalletProblem(saved, 4, [KEY, KEY_2])).toMatch(/does not hold this wallet/);
        expect(
            getSavedWalletProblem(
                { success: false, error: { message: 'Unknown message' } },
                4,
                keysOnly,
            ),
        ).toMatch(/did not answer as a PHYLAX main block/);
    });
});
