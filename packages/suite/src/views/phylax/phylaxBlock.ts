// PHYLAX Blocks (fork): recognising a PHYLAX block (main or key block) in Suite.

import { type TrezorDevice } from '@suite-common/suite-types';

type CheckResult = { success: true } | { success: false; error: string } | null | undefined;

const isPhylaxCheck = (result: CheckResult) =>
    result?.success === false && result.error === 'phylax-firmware';

/**
 * A PHYLAX main block, key block or a board with a PHYLAX bootloader. Connect marks the main
 * block with `phylax`; for every PHYLAX block it reports the authenticity checks as
 * 'phylax-firmware' (they cannot apply to PHYLAX builds).
 */
export const isPhylaxBlock = (device: TrezorDevice | undefined) =>
    device?.type === 'acquired' &&
    (device.phylax === true ||
        isPhylaxCheck(device.authenticityChecks?.firmwareHash) ||
        isPhylaxCheck(device.authenticityChecks?.firmwareRevision));
