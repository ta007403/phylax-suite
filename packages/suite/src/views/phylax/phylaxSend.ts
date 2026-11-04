// PHYLAX Snap (fork): sending from a saved PHYLAX wallet (wsh(sortedmulti(n, ...)) n-of-n).
// Pure parts: amounts, transaction size and fee, coin selection, change, the signing request
// for the main block, and the check of the signed transaction against the plan.

import type { PROTO } from '@trezor/connect';
import { Transaction, crypto, networks, address as utxoAddress } from '@trezor/utxo-lib';

import {
    type PhylaxChain,
    type PhylaxNetwork,
    getPhylaxAddress,
    getPhylaxAddressPath,
    getPhylaxMultisig,
} from './phylaxWallet';
import type { PhylaxUtxo } from './usePhylaxBalance';

const UTXO_NETWORKS = { mainnet: networks.bitcoin, testnet: networks.testnet } as const;

/** The main block's limit (PHYLAX_MAX_INPUTS in the firmware's phylax_relay.h). */
export const PHYLAX_MAX_INPUTS = 16;

/** Smallest output the network relays for any address type (P2PKH dust limit). */
export const DUST_LIMIT = 546n;

/** Coins that are not confirmed yet are not spent (v1). */
export const MIN_CONFIRMATIONS = 1;

const SATS_PER_BTC = 100_000_000n;

/** "0.0012" -> 120000n. undefined if not a valid amount with at most 8 decimals. */
export const parseBtc = (text: string): bigint | undefined => {
    const value = text.trim();
    const match = /^(\d+)(?:\.(\d{0,8}))?$/.exec(value) ?? /^\.(\d{1,8})$/.exec(value);
    if (!match) return undefined;
    if (value.startsWith('.')) return BigInt((match[1] ?? '').padEnd(8, '0'));
    const whole = BigInt(match[1]!);
    const fraction = BigInt((match[2] ?? '').padEnd(8, '0'));

    return whole * SATS_PER_BTC + fraction;
};

export const formatBtc = (satoshis: bigint) => {
    const whole = satoshis / SATS_PER_BTC;
    const fraction = (satoshis % SATS_PER_BTC).toString().padStart(8, '0');

    return `${whole}.${fraction}`;
};

const varIntSize = (n: number) => {
    if (n < 0xfd) return 1;

    return n <= 0xffff ? 3 : 5;
};

/** The output script of an address, or undefined if it is not an address of this network. */
export const getOutputScript = (network: PhylaxNetwork, address: string) => {
    try {
        return utxoAddress.toOutputScript(address.trim(), UTXO_NETWORKS[network]);
    } catch {
        return undefined;
    }
};

const outputSize = (scriptLength: number) => 8 + varIntSize(scriptLength) + scriptLength;

/** P2WSH output script: OP_0 <32 bytes>. */
const P2WSH_SCRIPT_LENGTH = 34;

/**
 * Virtual size of a transaction spending `inputCount` P2WSH m-of-n inputs to outputs with these
 * script lengths, with the largest signatures (72 bytes + sighash), so the fee is never short.
 */
export const estimateVsize = (
    inputCount: number,
    outputScriptLengths: number[],
    m: number,
    n: number,
) => {
    const witnessScriptLength = 3 + 34 * n; // OP_m <33-byte key> x n OP_n OP_CHECKMULTISIG
    const inputWitness =
        varIntSize(m + 2) + // number of witness items: empty, m signatures, witness script
        1 + // empty item (CHECKMULTISIG's extra pop)
        m * (1 + 73) +
        varIntSize(witnessScriptLength) +
        witnessScriptLength;
    const inputBase = 32 + 4 + 1 + 4; // outpoint, empty scriptSig, sequence
    const base =
        4 + // version
        varIntSize(inputCount) +
        inputCount * inputBase +
        varIntSize(outputScriptLengths.length) +
        outputScriptLengths.reduce((sum, length) => sum + outputSize(length), 0) +
        4; // locktime
    const witness = 2 + inputCount * inputWitness; // marker + flag
    const weight = 4 * base + witness;

    return Math.ceil(weight / 4);
};

export type PhylaxSendRequest = {
    address: string;
    // satoshis; ignored with sendAll
    amount: bigint;
    sendAll: boolean;
    // satoshis per virtual byte
    feeRate: number;
};

export type PhylaxSendPlan = {
    inputs: PhylaxUtxo[];
    recipient: { address: string; amount: bigint };
    change?: { chain: PhylaxChain; index: number; address: string; amount: bigint };
    fee: bigint;
    vsize: number;
};

export type PhylaxPlanResult =
    { kind: 'plan'; plan: PhylaxSendPlan } | { kind: 'error'; text: string };

const feeFor = (vsize: number, feeRate: number) => BigInt(Math.ceil(vsize * feeRate));

/**
 * Picks the coins (largest first, at most PHYLAX_MAX_INPUTS) for one payment, with change to the
 * wallet's change address `changeIndex` when it is worth an output, otherwise to the fee.
 */
export const planPhylaxSend = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    utxos: PhylaxUtxo[],
    changeIndex: number,
    request: PhylaxSendRequest,
): PhylaxPlanResult => {
    const recipientScript = getOutputScript(network, request.address);
    if (!recipientScript) {
        return {
            kind: 'error',
            text: `This is not a ${network === 'mainnet' ? 'Bitcoin' : 'Testnet'} address.`,
        };
    }
    if (!(request.feeRate > 0)) return { kind: 'error', text: 'No fee rate.' };

    const m = wallet.threshold;
    const n = wallet.keys.length;
    const spendable = utxos
        .filter(utxo => utxo.confirmations >= MIN_CONFIRMATIONS)
        // largest first
        .sort((a, b) => Number(b.value - a.value));
    if (spendable.length === 0) {
        return { kind: 'error', text: 'No confirmed coins to send yet.' };
    }
    const changeAddress = getPhylaxAddress(wallet, network, 1, changeIndex);
    const recipient = { address: request.address.trim() };

    if (request.sendAll) {
        const inputs = spendable.slice(0, PHYLAX_MAX_INPUTS);
        const total = inputs.reduce((sum, utxo) => sum + utxo.value, 0n);
        const vsize = estimateVsize(inputs.length, [recipientScript.length], m, n);
        const fee = feeFor(vsize, request.feeRate);
        const amount = total - fee;
        if (amount < DUST_LIMIT) {
            return { kind: 'error', text: 'The coins do not cover the fee.' };
        }

        return {
            kind: 'plan',
            plan: { inputs, recipient: { ...recipient, amount }, fee, vsize },
        };
    }

    if (request.amount < DUST_LIMIT) {
        return { kind: 'error', text: `The amount must be at least ${formatBtc(DUST_LIMIT)}.` };
    }
    let total = 0n;
    for (let count = 1; count <= Math.min(spendable.length, PHYLAX_MAX_INPUTS); count++) {
        total += spendable[count - 1]!.value;
        const inputs = spendable.slice(0, count);
        const withChange = estimateVsize(
            count,
            [recipientScript.length, P2WSH_SCRIPT_LENGTH],
            m,
            n,
        );
        const changeAmount = total - request.amount - feeFor(withChange, request.feeRate);
        if (changeAmount >= DUST_LIMIT) {
            return {
                kind: 'plan',
                plan: {
                    inputs,
                    recipient: { ...recipient, amount: request.amount },
                    change: {
                        chain: 1,
                        index: changeIndex,
                        address: changeAddress,
                        amount: changeAmount,
                    },
                    fee: feeFor(withChange, request.feeRate),
                    vsize: withChange,
                },
            };
        }
        const withoutChange = estimateVsize(count, [recipientScript.length], m, n);
        if (total - request.amount >= feeFor(withoutChange, request.feeRate)) {
            // what is left is too small for a change output: it goes to the fee
            return {
                kind: 'plan',
                plan: {
                    inputs,
                    recipient: { ...recipient, amount: request.amount },
                    fee: total - request.amount,
                    vsize: withoutChange,
                },
            };
        }
    }

    const available = spendable
        .slice(0, PHYLAX_MAX_INPUTS)
        .reduce((sum, utxo) => sum + utxo.value, 0n);

    return {
        kind: 'error',
        text:
            spendable.length > PHYLAX_MAX_INPUTS
                ? `Not enough in the ${PHYLAX_MAX_INPUTS} largest coins (${formatBtc(available)}), the most the main block signs at once.`
                : `Not enough coins: ${formatBtc(available)} available, plus the fee.`,
    };
};

/** The SignTx request for the main block: the wallet's multisig on every input and the change. */
export const getPhylaxSignParams = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    plan: PhylaxSendPlan,
) => ({
    inputs: plan.inputs.map(utxo => ({
        address_n: getPhylaxAddressPath(network, utxo.chain, utxo.index),
        prev_hash: utxo.txid,
        prev_index: utxo.vout,
        amount: utxo.value.toString(),
        script_type: 'SPENDWITNESS' as const,
        multisig: getPhylaxMultisig(wallet, network, utxo.chain, utxo.index),
    })),
    outputs: [
        {
            address: plan.recipient.address,
            amount: plan.recipient.amount.toString(),
            script_type: 'PAYTOADDRESS' as const,
        },
        ...(plan.change
            ? [
                  {
                      address_n: getPhylaxAddressPath(
                          network,
                          plan.change.chain,
                          plan.change.index,
                      ),
                      amount: plan.change.amount.toString(),
                      script_type: 'PAYTOWITNESS' as const,
                      multisig: getPhylaxMultisig(
                          wallet,
                          network,
                          plan.change.chain,
                          plan.change.index,
                      ),
                  },
              ]
            : []),
    ],
});

/**
 * Checks the signed transaction from the main block against the plan before it is broadcast:
 * exactly the planned coins, and exactly the planned outputs (recipient, and change to the
 * wallet's own change address). Returns an error text, or undefined if it matches.
 */
export const checkSignedTx = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    plan: PhylaxSendPlan,
    serializedTx: string,
): string | undefined => {
    let tx: Transaction;
    try {
        tx = Transaction.fromHex(serializedTx, { network: UTXO_NETWORKS[network] });
    } catch {
        return 'The signed transaction could not be read.';
    }

    const outpoints = tx.ins.map(
        input => `${Buffer.from(input.hash).reverse().toString('hex')}:${input.index}`,
    );
    const planned = plan.inputs.map(utxo => `${utxo.txid}:${utxo.vout}`);
    if (outpoints.length !== planned.length || planned.some(p => !outpoints.includes(p))) {
        return 'The signed transaction spends other coins than planned.';
    }

    const expected = [
        { script: getOutputScript(network, plan.recipient.address), amount: plan.recipient.amount },
        ...(plan.change
            ? [
                  {
                      script: getOutputScript(network, plan.change.address),
                      amount: plan.change.amount,
                  },
              ]
            : []),
    ];
    if (tx.outs.length !== expected.length) {
        return 'The signed transaction has other outputs than planned.';
    }
    const matches = expected.every(want =>
        tx.outs.some(
            out =>
                want.script !== undefined &&
                Buffer.compare(out.script, want.script) === 0 &&
                BigInt(out.value) === want.amount,
        ),
    );
    if (!matches) return 'The signed transaction pays other addresses or amounts than planned.';
    // Every input: [empty, m signatures, witness script], and the script must be the wallet's own
    // for that input's address. A missing signature is what the network rejects with "Operation
    // not valid with the current stack size".
    const m = wallet.threshold;
    const isComplete = plan.inputs.every(utxo => {
        const input = tx.ins.find(
            i =>
                Buffer.from(i.hash).reverse().toString('hex') === utxo.txid &&
                i.index === utxo.vout,
        );
        if (input?.witness.length !== m + 2 || input.witness[0]!.length !== 0) return false;
        const signatures = input.witness.slice(1, m + 1);
        if (signatures.some(sig => sig.length < 9 || sig[0] !== 0x30)) return false;
        const witnessScript = input.witness[m + 1]!;
        const expected = getOutputScript(
            network,
            getPhylaxAddress(wallet, network, utxo.chain, utxo.index),
        );
        const actual = Buffer.concat([Buffer.from([0x00, 0x20]), crypto.sha256(witnessScript)]);

        return expected !== undefined && Buffer.compare(actual, expected) === 0;
    });
    if (!isComplete) {
        return 'The signed transaction is missing signatures (a block did not sign).';
    }

    return undefined;
};
