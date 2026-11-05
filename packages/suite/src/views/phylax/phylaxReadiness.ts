// PHYLAX Blocks (fork): which of a wallet's blocks can sign now, from the stack the main block
// reports.

import type { PROTO } from '@trezor/connect';

import { PHYLAX_MAIN_BLOCK_ADDRESS } from './phylaxIdentity';
import { getFingerprintHex } from './phylaxWallet';

/** Key blocks with a seed that are attached but locked. */
export const getLockedKeyBlocks = (blocks: PROTO.PhylaxBlockInfo[]) =>
    blocks.filter(
        block => block.address !== PHYLAX_MAIN_BLOCK_ADDRESS && block.initialized && block.locked,
    );

export const getMainFingerprint = (blocks: PROTO.PhylaxBlockInfo[]) =>
    blocks.find(block => block.address === PHYLAX_MAIN_BLOCK_ADDRESS)?.fingerprint ?? undefined;

const fingerprintsOf = (list: PROTO.PhylaxBlockInfo[]) =>
    list
        .map(block => block.fingerprint)
        .filter((fingerprint): fingerprint is number => typeof fingerprint === 'number');

/**
 * Blocks that can sign now. Locked ones are handled apart: a locked block reports the fingerprint
 * of its last unlock, or none if it never was unlocked with this firmware.
 */
export const getPresentFingerprints = (blocks: PROTO.PhylaxBlockInfo[]) =>
    fingerprintsOf(blocks.filter(block => !block.locked));

export const getLockedBlockName = (block: PROTO.PhylaxBlockInfo) =>
    typeof block.fingerprint === 'number'
        ? getFingerprintHex(block.fingerprint)
        : `0x${block.address.toString(16)}`;

export type PhylaxReadiness = {
    // every key can sign (the main block counts as ready even when locked: Suite asks its PIN)
    isReady: boolean;
    // a key block is neither attached nor possibly one of the locked ones
    isAttachNeeded: boolean;
    missingFingerprints: number[];
    // locked key blocks that belong (or may belong) to this wallet
    lockedInWallet: PROTO.PhylaxBlockInfo[];
};

export const getPhylaxReadiness = (
    walletFingerprints: number[],
    blocks: PROTO.PhylaxBlockInfo[],
): PhylaxReadiness => {
    const mainFingerprint = getMainFingerprint(blocks);
    const presentFingerprints = getPresentFingerprints(blocks);
    const lockedKeyBlocks = getLockedKeyBlocks(blocks);

    const notReady = walletFingerprints.filter(
        fingerprint =>
            fingerprint !== mainFingerprint && !presentFingerprints.includes(fingerprint),
    );
    // locked blocks of this wallet; one without a fingerprint may be any of the missing keys
    const knownLocked = lockedKeyBlocks.filter(
        block => typeof block.fingerprint === 'number' && notReady.includes(block.fingerprint),
    );
    const unknownLocked = lockedKeyBlocks.filter(block => typeof block.fingerprint !== 'number');
    const missingFingerprints = notReady.filter(
        fingerprint => !knownLocked.some(block => block.fingerprint === fingerprint),
    );

    return {
        isReady: notReady.length === 0,
        isAttachNeeded: missingFingerprints.length > unknownLocked.length,
        missingFingerprints,
        lockedInWallet: [...knownLocked, ...(missingFingerprints.length > 0 ? unknownLocked : [])],
    };
};
