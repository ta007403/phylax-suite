// PHYLAX Snap (fork): sending from a saved PHYLAX wallet (wsh(sortedmulti(n, ...)) n-of-n).
// Pure parts: amounts, transaction size and fee, coin selection, change, the signing request
// for the main block, and the check of the signed transaction against the plan.

import type { PROTO } from '@trezor/connect';
import { Transaction, crypto, networks, address as utxoAddress } from '@trezor/utxo-lib';

import type { PhylaxUtxo } from './phylaxAccountScan';
import {
    type PhylaxChain,
    type PhylaxNetwork,
    getPhylaxAddress,
    getPhylaxAddressPath,
    getPhylaxMultisig,
} from './phylaxWallet';

const UTXO_NETWORKS = { mainnet: networks.bitcoin, testnet: networks.testnet } as const;

/** The main block's limit (PHYLAX_MAX_INPUTS in the firmware's phylax_relay.h). */
export const PHYLAX_MAX_INPUTS = 16;

/** Smallest output the network relays for any address type (P2PKH dust limit). */
export const DUST_LIMIT = 546n;

/** Coins that are not confirmed yet are not spent (owner's choice, also with coin control). */
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

/** Lowest fee rate the network relays. */
export const MIN_FEE_RATE = 1;

/**
 * nSequence of every input: replaceable (BIP125), so the fee can be raised later, as Suite does;
 * also allows a locktime.
 */
export const RBF_SEQUENCE = 0xfffffffd;

/** One coin's id: "txid:vout". */
export const getCoinId = (utxo: { txid: string; vout: number }) => `${utxo.txid}:${utxo.vout}`;

export type PhylaxRecipientRequest = {
    address: string;
    // satoshis; ignored for the send-max recipient
    amount: bigint;
    // gets everything the coins hold after the other recipients and the fee (at most one)
    isSendMax: boolean;
};

export type PhylaxSendRequest = {
    recipients: PhylaxRecipientRequest[];
    // satoshis per virtual byte
    feeRate: number;
    // coin control: spend exactly these coins (getCoinId); undefined picks them automatically
    coinIds?: string[];
};

export type PhylaxSendPlan = {
    inputs: PhylaxUtxo[];
    recipients: { address: string; amount: bigint }[];
    change?: { chain: PhylaxChain; index: number; address: string; amount: bigint };
    fee: bigint;
    vsize: number;
};

export type PhylaxPlanResult =
    { kind: 'plan'; plan: PhylaxSendPlan } | { kind: 'error'; text: string };

const feeFor = (vsize: number, feeRate: number) => BigInt(Math.ceil(vsize * feeRate));

const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

/** "Recipient 2: " when there are several, so an error says which one. */
const recipientPrefix = (index: number, count: number) =>
    count > 1 ? `Recipient ${index + 1}: ` : '';

/**
 * Plans a payment to one or more recipients:
 * - coins: the ones chosen (coin control, all of them are spent) or else the confirmed coins,
 *   largest first, at most PHYLAX_MAX_INPUTS;
 * - a send-max recipient gets what is left after the others and the fee (no change);
 * - otherwise change goes to the wallet's change address `changeIndex` when it is worth an output,
 *   else to the fee.
 */
export const planPhylaxSend = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    utxos: PhylaxUtxo[],
    changeIndex: number,
    request: PhylaxSendRequest,
): PhylaxPlanResult => {
    const { recipients, feeRate, coinIds } = request;
    if (recipients.length === 0) return { kind: 'error', text: 'Add a recipient.' };
    if (recipients.filter(recipient => recipient.isSendMax).length > 1) {
        return { kind: 'error', text: 'Only one recipient can get the maximum.' };
    }
    const scripts: Buffer[] = [];
    for (const [index, recipient] of recipients.entries()) {
        const script = getOutputScript(network, recipient.address);
        if (!script) {
            return {
                kind: 'error',
                text: `${recipientPrefix(index, recipients.length)}This is not a ${network === 'mainnet' ? 'Bitcoin' : 'Testnet'} address.`,
            };
        }
        if (!recipient.isSendMax && recipient.amount < DUST_LIMIT) {
            return {
                kind: 'error',
                text: `${recipientPrefix(index, recipients.length)}The amount must be at least ${formatBtc(DUST_LIMIT)}.`,
            };
        }
        scripts.push(script);
    }
    if (!(feeRate >= MIN_FEE_RATE)) {
        return { kind: 'error', text: `The fee must be at least ${MIN_FEE_RATE} sat/vB.` };
    }

    const m = wallet.threshold;
    const n = wallet.keys.length;
    const recipientScriptLengths = scripts.map(script => script.length);
    const fixed = sum(recipients.filter(r => !r.isSendMax).map(r => r.amount));
    const maxIndex = recipients.findIndex(recipient => recipient.isSendMax);
    const toRecipients = (maxAmount: bigint) =>
        recipients.map((recipient, index) => ({
            address: recipient.address.trim(),
            amount: index === maxIndex ? maxAmount : recipient.amount,
        }));
    const changeAddress = getPhylaxAddress(wallet, network, 1, changeIndex);

    /** The plan for exactly these coins, or undefined if they do not cover it. */
    const planFor = (inputs: PhylaxUtxo[]): PhylaxSendPlan | undefined => {
        const total = sum(inputs.map(utxo => utxo.value));
        const withoutChange = estimateVsize(inputs.length, recipientScriptLengths, m, n);
        if (maxIndex >= 0) {
            const fee = feeFor(withoutChange, feeRate);
            const maxAmount = total - fixed - fee;
            if (maxAmount < DUST_LIMIT) return undefined;

            return { inputs, recipients: toRecipients(maxAmount), fee, vsize: withoutChange };
        }
        const withChange = estimateVsize(
            inputs.length,
            [...recipientScriptLengths, P2WSH_SCRIPT_LENGTH],
            m,
            n,
        );
        const changeAmount = total - fixed - feeFor(withChange, feeRate);
        if (changeAmount >= DUST_LIMIT) {
            return {
                inputs,
                recipients: toRecipients(0n),
                change: {
                    chain: 1,
                    index: changeIndex,
                    address: changeAddress,
                    amount: changeAmount,
                },
                fee: feeFor(withChange, feeRate),
                vsize: withChange,
            };
        }
        if (total - fixed >= feeFor(withoutChange, feeRate)) {
            // what is left is too small for a change output: it goes to the fee
            return {
                inputs,
                recipients: toRecipients(0n),
                fee: total - fixed,
                vsize: withoutChange,
            };
        }

        return undefined;
    };

    if (coinIds) {
        const chosen = utxos.filter(utxo => coinIds.includes(getCoinId(utxo)));
        if (chosen.length === 0) return { kind: 'error', text: 'Choose at least one coin.' };
        if (chosen.some(utxo => utxo.confirmations < MIN_CONFIRMATIONS)) {
            return { kind: 'error', text: 'Unconfirmed coins cannot be spent yet.' };
        }
        if (chosen.length > PHYLAX_MAX_INPUTS) {
            return {
                kind: 'error',
                text: `Choose at most ${PHYLAX_MAX_INPUTS} coins, the most the main block signs at once.`,
            };
        }
        const chosenPlan = planFor(chosen);
        if (chosenPlan) return { kind: 'plan', plan: chosenPlan };

        return {
            kind: 'error',
            text: `The chosen coins (${formatBtc(sum(chosen.map(utxo => utxo.value)))}) do not cover the amount and the fee.`,
        };
    }

    const spendable = utxos
        .filter(utxo => utxo.confirmations >= MIN_CONFIRMATIONS)
        // largest first
        .sort((a, b) => Number(b.value - a.value));
    if (spendable.length === 0) {
        return { kind: 'error', text: 'No confirmed coins to send yet.' };
    }
    const usable = spendable.slice(0, PHYLAX_MAX_INPUTS);

    if (maxIndex >= 0) {
        const maxPlan = planFor(usable);
        if (maxPlan) return { kind: 'plan', plan: maxPlan };

        return { kind: 'error', text: 'The coins do not cover the other amounts and the fee.' };
    }
    for (let count = 1; count <= usable.length; count++) {
        const autoPlan = planFor(usable.slice(0, count));
        if (autoPlan) return { kind: 'plan', plan: autoPlan };
    }

    const available = sum(usable.map(utxo => utxo.value));

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
        sequence: RBF_SEQUENCE,
        multisig: getPhylaxMultisig(wallet, network, utxo.chain, utxo.index),
    })),
    outputs: [
        ...plan.recipients.map(recipient => ({
            address: recipient.address,
            amount: recipient.amount.toString(),
            script_type: 'PAYTOADDRESS' as const,
        })),
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
        ...plan.recipients.map(recipient => ({
            script: getOutputScript(network, recipient.address),
            amount: recipient.amount,
        })),
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
    // each planned output matches its own output of the transaction
    const unmatched = [...tx.outs];
    const matches = expected.every(want => {
        const at = unmatched.findIndex(
            out =>
                want.script !== undefined &&
                Buffer.compare(out.script, want.script) === 0 &&
                BigInt(out.value) === want.amount,
        );
        if (at < 0) return false;
        unmatched.splice(at, 1);

        return true;
    });
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
