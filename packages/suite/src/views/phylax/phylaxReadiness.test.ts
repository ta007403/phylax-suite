import { PROTO } from '@trezor/connect';

import { getPhylaxReadiness } from './phylaxReadiness';

const MAIN = 0x5c9e228d;
const KEY = 0x73c5da0a;

const block = (
    address: number,
    fingerprint: number | undefined,
    locked = false,
): PROTO.PhylaxBlockInfo => ({
    address,
    kind:
        address === 1
            ? PROTO.PhylaxBlockKind.PHYLAX_BLOCK_MAIN
            : PROTO.PhylaxBlockKind.PHYLAX_BLOCK_KEY,
    unique_id: `block-${address}`,
    fingerprint,
    initialized: true,
    locked,
    major_version: 1,
    minor_version: 12,
    patch_version: 1,
});

describe('PHYLAX wallet readiness', () => {
    it('is ready with every key block attached and unlocked; a locked main block counts', () => {
        expect(getPhylaxReadiness([MAIN, KEY], [block(1, MAIN, true), block(0x10, KEY)])).toEqual({
            isReady: true,
            isAttachNeeded: false,
            missingFingerprints: [],
            lockedInWallet: [],
        });
    });

    it('names a locked key block, also one that reports no fingerprint', () => {
        const known = getPhylaxReadiness([MAIN, KEY], [block(1, MAIN), block(0x10, KEY, true)]);
        expect(known).toMatchObject({ isReady: false, isAttachNeeded: false });
        expect(known.lockedInWallet.map(b => b.address)).toEqual([0x10]);

        const unknown = getPhylaxReadiness(
            [MAIN, KEY],
            [block(1, MAIN), block(0x11, undefined, true)],
        );
        expect(unknown).toMatchObject({ isAttachNeeded: false, missingFingerprints: [KEY] });
        expect(unknown.lockedInWallet.map(b => b.address)).toEqual([0x11]);
    });

    it('asks to attach a key block that is not there', () => {
        expect(getPhylaxReadiness([MAIN, KEY], [block(1, MAIN)])).toMatchObject({
            isReady: false,
            isAttachNeeded: true,
            missingFingerprints: [KEY],
        });
    });
});
