// PHYLAX Snap (fork): make sure a request goes to the PHYLAX main block of the wallet, and not to
// another Trezor connected at the same time (a plain Trezor One looks the same on USB).

import type { PROTO } from '@trezor/connect';

import { getFingerprintHex } from './phylaxWallet';

export const PHYLAX_MAIN_BLOCK_ADDRESS = 1;

export type PhylaxIdentity =
    | { kind: 'main-block'; mainFingerprint: number | undefined }
    | { kind: 'wrong-device'; text: string };

type BlocksResponse =
    { success: true; payload: PROTO.PhylaxBlocks } | { success: false; error: { message: string } };

const ANOTHER_TREZOR_HINT =
    'If another Trezor is connected, unplug it, or choose the PHYLAX main block in the device menu at the top left.';

/**
 * Checks the answer to PhylaxGetBlocks sent right before a request:
 * - no answer: not a PHYLAX main block (a plain Trezor does not know the message);
 * - the main block's seed fingerprint is known and not one of the wallet's: another main block.
 * A locked main block reports no fingerprint; the key check after unlocking covers that case.
 */
export const getPhylaxIdentity = (
    response: BlocksResponse,
    walletFingerprints: number[],
): PhylaxIdentity => {
    if (!response.success) {
        return {
            kind: 'wrong-device',
            text: `The selected device did not answer as a PHYLAX main block (${response.error.message}). Nothing was sent. ${ANOTHER_TREZOR_HINT}`,
        };
    }
    const main = response.payload.blocks.find(block => block.address === PHYLAX_MAIN_BLOCK_ADDRESS);
    if (!main) {
        return {
            kind: 'wrong-device',
            text: `The selected device did not report itself as a PHYLAX main block. Nothing was sent. ${ANOTHER_TREZOR_HINT}`,
        };
    }
    const mainFingerprint = main.fingerprint ?? undefined;
    if (mainFingerprint !== undefined && !walletFingerprints.includes(mainFingerprint)) {
        return {
            kind: 'wrong-device',
            text: `The connected main block (${getFingerprintHex(mainFingerprint)}) is not part of this wallet. Nothing was sent.`,
        };
    }

    return { kind: 'main-block', mainFingerprint };
};

/** Number of different Trezor-type devices plugged in (wallet instances of one device count once). */
export const countConnectedDevices = (devices: { connected: boolean; path?: string }[]) =>
    new Set(devices.filter(device => device.connected).map(device => device.path)).size;
