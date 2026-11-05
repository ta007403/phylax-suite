// PHYLAX Blocks (fork): descriptors and addresses of a saved PHYLAX wallet.
// A PHYLAX wallet is wsh(sortedmulti(n, ...)) n-of-n, one BIP48 P2WSH account key
// (m/48'/coin'/0'/2') per block, as returned by PhylaxGetWallet.

import type { PROTO } from '@trezor/connect';
import { addDescriptorChecksum, bip32, crypto, networks, payments } from '@trezor/utxo-lib';
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

/** The unit shown with amounts. */
export const getPhylaxUnit = (network: PhylaxNetwork) => (network === 'mainnet' ? 'BTC' : 'tBTC');

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

/** One key's account xpub (m/48'/coin'/0'/2') and its key origin, as in the descriptor. */
export const getPhylaxKeyXpub = (key: PROTO.PhylaxWalletKey, network: PhylaxNetwork) => ({
    origin: `${getFingerprintHex(key.fingerprint)}/48h/${COIN_TYPES[network]}h/0h/2h`,
    xpub: getAccountNode(key, network).toBase58(),
});

/**
 * The wallet's output descriptor with both chains (BIP389 `<0;1>`) and its BIP380 checksum,
 * e.g. for importing the wallet into Sparrow.
 */
export const getPhylaxDescriptor = (wallet: PROTO.PhylaxWallet, network: PhylaxNetwork) => {
    const keys = wallet.keys
        .map(key => {
            const { origin, xpub } = getPhylaxKeyXpub(key, network);

            return `[${origin}]${xpub}/<0;1>/*`;
        })
        .join(',');

    return addDescriptorChecksum(`wsh(sortedmulti(${wallet.threshold},${keys}))`);
};

const getPhylaxRedeem = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    index: number,
) => {
    const pubkeys = wallet.keys
        .map(key => getAccountNode(key, network).derive(chain).derive(index).publicKey)
        .sort(Buffer.compare);

    return payments.p2ms({ m: wallet.threshold, pubkeys, network: UTXO_NETWORKS[network] });
};

/** The witness script (sortedmulti) of the wallet's address at `chain/index`. */
export const getPhylaxWitnessScript = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    index: number,
) => {
    const { output } = getPhylaxRedeem(wallet, network, chain, index);
    if (!output) {
        throw new Error('PHYLAX: could not build the witness script');
    }

    return output;
};

/** The wallet's address at `chain/index`. */
export const getPhylaxAddress = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    index: number,
) => {
    const { address } = payments.p2wsh({
        redeem: getPhylaxRedeem(wallet, network, chain, index),
        network: UTXO_NETWORKS[network],
    });
    if (!address) {
        throw new Error('PHYLAX: could not derive a wallet address');
    }

    return address;
};

/** BIP32 path of this block's own key for the wallet's address at `chain/index`. */
export const getPhylaxAddressPath = (network: PhylaxNetwork, chain: PhylaxChain, index: number) =>
    `m/48'/${COIN_TYPES[network]}'/0'/2'/${chain}/${index}`;

// Only the fields of a public node. A node decoded from the device carries `private_key: null`
// (Connect turns missing optional fields into null), which cannot be encoded back into a request.
const getPublicNode = (node: PROTO.HDNodeType): PROTO.HDNodeType => ({
    depth: node.depth,
    fingerprint: node.fingerprint,
    child_num: node.child_num,
    chain_code: node.chain_code,
    public_key: node.public_key,
});

// MultisigPubkeysOrder.LEXICOGRAPHIC: the device sorts the keys itself (sortedmulti, BIP67).
const PUBKEYS_ORDER_LEXICOGRAPHIC = 1;

/**
 * The wallet as a multisig for GetAddress / SignTx on the main block: every block's saved
 * account key, n-of-n, sorted on the device like the descriptor's sortedmulti.
 */
export const getPhylaxMultisig = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
    index: number,
): PROTO.MultisigRedeemScriptType => ({
    pubkeys: wallet.keys.map(key => ({
        node: getPublicNode(network === 'mainnet' ? key.mainnet : key.testnet),
        address_n: [chain, index],
    })),
    signatures: wallet.keys.map(() => ''),
    m: wallet.threshold,
    pubkeys_order: PUBKEYS_ORDER_LEXICOGRAPHIC,
});

/** BIP32 path of a block's account key for the wallet (the xpub saved in the wallet). */
export const getPhylaxAccountPath = (network: PhylaxNetwork) =>
    `m/48'/${COIN_TYPES[network]}'/0'/2'`;

/** The account key the wallet saved for the block with this seed fingerprint. */
export const getPhylaxKeyNode = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    fingerprint: number | undefined,
) => {
    const key = wallet.keys.find(k => k.fingerprint === fingerprint);
    if (!key) return undefined;

    return network === 'mainnet' ? key.mainnet : key.testnet;
};

/** Short id of a public key for messages (first 4 bytes of HASH160), not the key itself. */
export const getPublicKeyId = (publicKeyHex: string) =>
    crypto.hash160(Buffer.from(publicKeyHex, 'hex')).subarray(0, 4).toString('hex');
