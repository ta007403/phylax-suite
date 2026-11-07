// PHYLAX Blocks (fork): the addresses of a PHYLAX wallet that Suite's backend watches for it, as for
// Suite's own accounts (blockchainSubscribe): the used ones and the next GAP_LIMIT unused ones on
// the receive and the change chain. The backend then tells about a new transaction on any of them
// at once (a notification), instead of PHYLAX asking address by address.

import type TrezorConnect from '@trezor/connect';
import type { PROTO } from '@trezor/connect';

import { GAP_LIMIT, type PhylaxAccountData } from './phylaxAccountScan';
import { type PhylaxChain, type PhylaxNetwork, getPhylaxAddress } from './phylaxWallet';
import { getPhylaxSubscriptionDescriptor } from './state/phylaxReducer';

export type PhylaxSubscriptionAccount = NonNullable<
    Parameters<typeof TrezorConnect.blockchainSubscribe>[0]['accounts']
>[number];

const toAddress = (address: string) => ({
    address,
    path: '',
    transfers: 0,
    balance: '0',
    sent: '0',
    received: '0',
});

const nextUnused = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    firstUnused: number,
) =>
    Array.from({ length: GAP_LIMIT }, (_, offset) =>
        toAddress(getPhylaxAddress(wallet, network, chain, firstUnused + offset)),
    );

export const getPhylaxSubscriptionAccount = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    accountKey: string,
    data: Pick<PhylaxAccountData, 'usedAddresses' | 'nextReceiveIndex' | 'nextChangeIndex'>,
): PhylaxSubscriptionAccount => ({
    descriptor: getPhylaxSubscriptionDescriptor(accountKey),
    addresses: {
        used: data.usedAddresses.map(toAddress),
        unused: nextUnused(wallet, network, 0, data.nextReceiveIndex),
        change: nextUnused(wallet, network, 1, data.nextChangeIndex),
    },
});
