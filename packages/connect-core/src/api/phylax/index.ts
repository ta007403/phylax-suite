// PHYLAX Blocks (fork, not upstream Trezor): messages answered by a PHYLAX main block,
// a Trezor One running PHYLAX firmware. A stock Trezor answers Failure_UnexpectedMessage.

import { type PermissionRequest } from '@trezor/connect-common';
import { MessagesSchema as PROTO } from '@trezor/protobuf';
import { Assert } from '@trezor/schema-utils';

import type { MethodMessage } from '../../core/AbstractMethod';
import { AbstractMethod } from '../../core/AbstractMethod';

const PHYLAX_PERMISSIONS: PermissionRequest[] = [{ permission: 'management' }];

export class PhylaxGetBlocks extends AbstractMethod<'phylaxGetBlocks'> {
    constructor(message: MethodMessage<'phylaxGetBlocks'>) {
        super(message, undefined);
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        const response = await cmd.typedCall('PhylaxGetBlocks', 'PhylaxBlocks');

        return response.message;
    }
}

export class PhylaxGetWallets extends AbstractMethod<'phylaxGetWallets'> {
    constructor(message: MethodMessage<'phylaxGetWallets'>) {
        super(message, undefined);
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        const response = await cmd.typedCall('PhylaxGetWallets', 'PhylaxWallets');

        return response.message;
    }
}

export class PhylaxGetWallet extends AbstractMethod<'phylaxGetWallet', PROTO.PhylaxGetWallet> {
    constructor(message: MethodMessage<'phylaxGetWallet'>) {
        const { payload } = message;
        Assert(PROTO.PhylaxGetWallet, payload);
        super(message, { slot: payload.slot });
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        const response = await cmd.typedCall('PhylaxGetWallet', 'PhylaxWallet', this.params);

        return response.message;
    }
}

export class PhylaxSetWalletName extends AbstractMethod<
    'phylaxSetWalletName',
    PROTO.PhylaxSetWalletName
> {
    constructor(message: MethodMessage<'phylaxSetWalletName'>) {
        const { payload } = message;
        Assert(PROTO.PhylaxSetWalletName, payload);
        super(message, { slot: payload.slot, name: payload.name });
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        // the main block shows the old and new name and waits for its buttons
        const response = await cmd.typedCall('PhylaxSetWalletName', 'Success', this.params);

        return response.message;
    }
}

export class PhylaxDeleteWallet extends AbstractMethod<
    'phylaxDeleteWallet',
    PROTO.PhylaxDeleteWallet
> {
    constructor(message: MethodMessage<'phylaxDeleteWallet'>) {
        const { payload } = message;
        Assert(PROTO.PhylaxDeleteWallet, payload);
        super(message, { slot: payload.slot });
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        // the main block asks the user to confirm on its buttons
        const response = await cmd.typedCall('PhylaxDeleteWallet', 'Success', this.params);

        return response.message;
    }
}

export class PhylaxUnlockBlock extends AbstractMethod<
    'phylaxUnlockBlock',
    PROTO.PhylaxUnlockBlock
> {
    constructor(message: MethodMessage<'phylaxUnlockBlock'>) {
        const { payload } = message;
        Assert(PROTO.PhylaxUnlockBlock, payload);
        super(message, { address: payload.address });
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        // answered at once; the user then enters the PIN on the key block's own buttons
        const response = await cmd.typedCall('PhylaxUnlockBlock', 'Success', this.params);

        return response.message;
    }
}

export class PhylaxForgetIgnored extends AbstractMethod<
    'phylaxForgetIgnored',
    PROTO.PhylaxForgetIgnored
> {
    constructor(message: MethodMessage<'phylaxForgetIgnored'>) {
        const { payload } = message;
        Assert(PROTO.PhylaxForgetIgnored, payload);
        super(message, { fingerprints: payload.fingerprints });
        this.useDeviceState = false;
        this.skipFinalReload = true;
    }

    get requiredPermissions() {
        return PHYLAX_PERMISSIONS;
    }

    async run() {
        const cmd = this.getDevice().getCommands();
        const response = await cmd.typedCall('PhylaxForgetIgnored', 'Success', this.params);

        return response.message;
    }
}
