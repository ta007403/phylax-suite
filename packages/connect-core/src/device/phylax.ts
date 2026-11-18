// PHYLAX Snap (fork, not upstream Trezor): recognising PHYLAX blocks (Trezor One boards with
// PHYLAX firmware) so Suite never offers Trezor's firmware or runs Trezor's authenticity checks on
// them. Official Trezor firmware is not signed for the PHYLAX bootloader, which would refuse it as
// unofficial and may erase the block's seed.

import { DeviceModelInternal } from '@trezor/device-utils';

/**
 * Hashes of the PHYLAX bootloaders (as Features.bootloader_hash reports them), one per release;
 * the same list as phylax_bl_hashes.h in the PHYLAX firmware.
 */
export const PHYLAX_BOOTLOADER_HASHES = [
    '95b80f96cf3f713f01711b28b16c4be5fef3a8b4a65412885dc6c87934c13dab',
    '88a0bca0f97f9f6235eb726c5d9ea8db4b7b4dc60ee7bc59630079338bfcaaea',
    '9d6af7cb43ec5d8fc766f7c732ef4bb6bb7e414c634d65199253c3890959c470',
];

export const isPhylaxBootloader = (features?: { bootloader_hash?: string | null } | null) =>
    !!features?.bootloader_hash &&
    PHYLAX_BOOTLOADER_HASHES.includes(features.bootloader_hash.toLowerCase());

export type PhylaxProbe = 'main' | 'key' | 'stock' | 'unknown';

/**
 * What the answer to PhylaxGetBlocks says about the device. Only a definite answer counts: a
 * stock Trezor answers Failure_UnexpectedMessage; a PHYLAX key block the same with "Not a PHYLAX
 * main block". Anything else (busy, a USB hiccup, a timeout) is 'unknown': ask again later.
 */
export const classifyPhylaxProbe = (error?: { code?: string; message?: string }): PhylaxProbe => {
    if (!error) return 'main';
    if (error.message?.includes('Not a PHYLAX main block')) return 'key';
    if (error.code === 'Failure_UnexpectedMessage') return 'stock';

    return 'unknown';
};

type RegularTrezorParams = {
    features?: { bootloader_hash?: string | null; internal_model?: string } | null;
    /** the PHYLAX probe's answer: true main block, false not a main block, undefined not asked */
    phylax?: boolean;
    phylaxKey?: boolean;
};

/**
 * Definitely a regular Trezor, never a PHYLAX block: a model PHYLAX does not use, or a Trezor One
 * whose firmware answered the probe as Trezor firmware does. Only a definite answer counts: a
 * Trezor One not asked yet (busy, in bootloader mode with Trezor's bootloader) is not one.
 */
export const isRegularTrezor = ({ features, phylax, phylaxKey }: RegularTrezorParams) => {
    if (!features?.internal_model || phylax || phylaxKey || isPhylaxBootloader(features)) {
        return false;
    }
    if (features.internal_model !== DeviceModelInternal.T1B1) return true;

    return phylax === false;
};

/**
 * Trezor's "required" firmware (older than the newest release marked required, e.g. Trezor One
 * below 1.12.1) blocks every call. PHYLAX Suite never installs firmware and lets a regular Trezor
 * be used with the firmware its owner chose: "required" becomes "outdated" (a reminder only).
 * Each method's own minimum firmware still applies (FIRMWARE_OLD for that method only).
 */
export const getPhylaxFirmwareStatus = <T extends string>(status: T, regularTrezor: boolean) =>
    regularTrezor && status === 'required' ? ('outdated' as T) : status;
