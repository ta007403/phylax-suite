// PHYLAX Blocks (fork): descriptors and addresses of a saved PHYLAX wallet.
// A PHYLAX wallet is wsh(sortedmulti(n, ...)) n-of-n, one BIP48 P2WSH account key
// (m/48'/coin'/0'/2') per block, as returned by PhylaxGetWallet.

import type { PROTO } from '@trezor/connect';
import { addDescriptorChecksum, bip32, networks, payments } from '@trezor/utxo-lib';
import type { BIP32Interface } from '@trezor/utxo-lib';

export type PhylaxNetwork = 'mainnet' | 'testnet';

/** Receive (0) or change (1) chain of a BIP48 account. */
export type PhylaxChain = 0 | 1;

const UTXO_NETWORKS = {
    mainnet: networks.bitcoin,
    testnet: networks.testnet,
} as const;

const COIN_TYPES: Record<PhylaxNetwork, number> = {
    mainnet: 0,
    testnet: 1,
};

/** Suite's coin symbols for the networks a PHYLAX wallet keeps keys for. */
export const PHYLAX_COIN_SYMBOLS: Record<PhylaxNetwork, 'btc' | 'test'> = {
    mainnet: 'btc',
    testnet: 'test',
};

export const getFingerprintHex = (fingerprint: number) =>
    (fingerprint >>> 0).toString(16).padStart(8, '0');

const getAccountNode = (key: PROTO.PhylaxWalletKey, network: PhylaxNetwork): BIP32Interface => {
    const hdNode = network === 'mainnet' ? key.mainnet : key.testnet;
    const node = bip32.fromPublicKey(
        Buffer.from(hdNode.public_key, 'hex'),
        Buffer.from(hdNode.chain_code, 'hex'),
        UTXO_NETWORKS[network],
    );
    // bip32.fromPublicKey makes a depth-0 node; the account key sits at depth 4 with its own
    // parent fingerprint and child number, which the serialized xpub must carry (same as
    // pubNode2bjsNode in @trezor/connect-core).
    // @ts-expect-error: private fields of BIP32Interface
    node.__DEPTH = hdNode.depth;
    // @ts-expect-error: private fields of BIP32Interface
    node.__INDEX = hdNode.child_num;
    // @ts-expect-error: private fields of BIP32Interface
    node.__PARENT_FINGERPRINT = hdNode.fingerprint;

    return node;
};

/**
 * The wallet's output descriptor with both chains (BIP389 `<0;1>`) and its BIP380 checksum,
 * e.g. for importing the wallet into Sparrow.
 */
export const getPhylaxDescriptor = (wallet: PROTO.PhylaxWallet, network: PhylaxNetwork) => {
    const coinType = COIN_TYPES[network];
    const keys = wallet.keys
        .map(key => {
            const origin = `${getFingerprintHex(key.fingerprint)}/48h/${coinType}h/0h/2h`;

            return `[${origin}]${getAccountNode(key, network).toBase58()}/<0;1>/*`;
        })
        .join(',');

    return addDescriptorChecksum(`wsh(sortedmulti(${wallet.threshold},${keys}))`);
};

/** The wallet's address at `chain/index`. */
export const getPhylaxAddress = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    index: number,
) => {
    const utxoNetwork = UTXO_NETWORKS[network];
    const pubkeys = wallet.keys
        .map(key => getAccountNode(key, network).derive(chain).derive(index).publicKey)
        .sort(Buffer.compare);
    const { address } = payments.p2wsh({
        redeem: payments.p2ms({ m: wallet.threshold, pubkeys, network: utxoNetwork }),
        network: utxoNetwork,
    });
    if (!address) {
        throw new Error('PHYLAX: could not derive a wallet address');
    }

    return address;
};
