// PHYLAX Blocks (fork): what stops a PHYLAX wallet from signing right now.

import { getFingerprintHex } from '../phylaxWallet';

/** Why the wallet cannot sign right now (a key block missing or locked), if so. */
export const getPhylaxSignBlocker = (missingFingerprints: number[], lockedCount: number) => {
    if (missingFingerprints.length > 0) {
        return `Attach key block ${missingFingerprints.map(getFingerprintHex).join(', ')} to send.`;
    }
    if (lockedCount === 1) {
        return 'A key block of this wallet is locked. Wake it up, then enter its PIN on its own buttons.';
    }
    if (lockedCount > 1) {
        return 'Key blocks of this wallet are locked. Wake them up, then enter each PIN on that block.';
    }

    return undefined;
};
