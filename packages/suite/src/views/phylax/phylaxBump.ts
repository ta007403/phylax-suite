// PHYLAX Blocks (fork): Speed up (replace-by-fee) for a pending payment of a PHYLAX wallet.
// The new transaction is a plain payment (owner's choice): the same coins and the same recipients
// with a higher fee, signed like any other send. The network replaces the pending one with it
// (BIP125): it pays a higher fee rate, and at least the old fee plus 1 sat/vB of its own size.
// The extra fee comes, as in Suite, from the change; else from another confirmed coin of the
// wallet; else (one recipient, no change, e.g. send max) from the recipient's amount.

import type { PROTO } from '@trezor/connect';

import type { PhylaxTransaction, PhylaxUtxo } from './phylaxAccountScan';
import {
    DUST_LIMIT,
    MIN_CONFIRMATIONS,
    P2WSH_SCRIPT_LENGTH,
    PHYLAX_MAX_INPUTS,
    type PhylaxSendPlan,
    estimateVsize,
    formatBtc,
    getCoinId,
    getOutputScript,
} from './phylaxSend';
import { type PhylaxNetwork, getPhylaxAddress } from './phylaxWallet';

// BIP125 rule 4: the replacement pays for its own size at the minimum relay fee rate.
const MIN_RELAY_FEE_RATE = 1;

export type PhylaxBumpPlan = PhylaxSendPlan & {
    originalFee: bigint;
    originalFeeRate: number;
    // coins added to the pending transaction's coins
    addedInputs: number;
    // the recipient whose amount pays the extra fee (no change, no other coin)
    decreasedRecipient?: { index: number; from: bigint; to: bigint };
};

export type PhylaxBumpResult =
    { kind: 'plan'; plan: PhylaxBumpPlan } | { kind: 'error'; text: string };

const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

/** The fee rate of a pending transaction, in sat/vB. */
export const getOriginalFeeRate = (tx: PhylaxTransaction, wallet: PROTO.PhylaxWallet) => {
    if (!tx.pending) return undefined;
    const fee =
        sum(tx.pending.inputs.map(i => i.value)) - sum(tx.pending.outputs.map(o => o.value));
    const vsize =
        tx.pending.vsize ??
        estimateVsize(
            tx.pending.inputs.length,
            tx.pending.outputs.map(() => P2WSH_SCRIPT_LENGTH),
            wallet.threshold,
            wallet.keys.length,
        );

    return Number(fee) / vsize;
};

export const planPhylaxBump = (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    tx: PhylaxTransaction,
    utxos: PhylaxUtxo[],
    nextChangeIndex: number,
    feeRate: number,
    formatAmount: (satoshis: bigint) => string = satoshis => `${formatBtc(satoshis)} BTC`,
): PhylaxBumpResult => {
    const { pending } = tx;
    if (!pending) return { kind: 'error', text: 'This transaction is already confirmed.' };
    if (!tx.rbf) {
        return { kind: 'error', text: 'This transaction cannot be replaced (no RBF signal).' };
    }
    if (pending.inputs.some(input => !input.own)) {
        return { kind: 'error', text: 'Only payments of this wallet alone can be sped up.' };
    }
    if (pending.outputs.some(output => !output.address)) {
        return { kind: 'error', text: 'A transaction with a data output cannot be sped up here.' };
    }

    const originalInputs: PhylaxUtxo[] = pending.inputs.map(input => ({
        txid: input.txid,
        vout: input.vout,
        value: input.value,
        chain: input.own!.chain,
        index: input.own!.index,
        confirmations: 0,
    }));
    const changeAt = pending.outputs.findIndex(output => output.own?.chain === 1);
    const originalChange = changeAt >= 0 ? pending.outputs[changeAt] : undefined;
    const recipients = pending.outputs
        .filter((_, index) => index !== changeAt)
        .map(output => ({ address: output.address, amount: output.value }));
    if (recipients.length === 0) {
        return { kind: 'error', text: 'This transaction pays nobody outside the wallet.' };
    }

    const originalFee =
        sum(originalInputs.map(i => i.value)) - sum(pending.outputs.map(o => o.value));
    const originalFeeRate = getOriginalFeeRate(tx, wallet) ?? 0;
    if (!(feeRate > originalFeeRate)) {
        return {
            kind: 'error',
            text: `The new fee rate must be higher than the current ${originalFeeRate.toFixed(2)} sat/vB.`,
        };
    }

    const m = wallet.threshold;
    const n = wallet.keys.length;
    const recipientScriptLengths = recipients.map(
        recipient => getOutputScript(network, recipient.address)?.length ?? P2WSH_SCRIPT_LENGTH,
    );
    const recipientTotal = sum(recipients.map(r => r.amount));
    // at the chosen rate, and never less than the old fee plus the minimum relay fee (BIP125)
    const feeAt = (vsize: number) => {
        const atRate = BigInt(Math.ceil(vsize * feeRate));
        const minimum = originalFee + BigInt(Math.ceil(vsize * MIN_RELAY_FEE_RATE));

        return atRate > minimum ? atRate : minimum;
    };
    const change = originalChange?.own
        ? { chain: 1 as const, index: originalChange.own.index, address: originalChange.address }
        : {
              chain: 1 as const,
              index: nextChangeIndex,
              address: getPhylaxAddress(wallet, network, 1, nextChangeIndex),
          };
    const base = { originalFee, originalFeeRate };

    const planFor = (inputs: PhylaxUtxo[]): PhylaxBumpPlan | undefined => {
        const total = sum(inputs.map(i => i.value));
        const addedInputs = inputs.length - originalInputs.length;
        const withChange = estimateVsize(
            inputs.length,
            [...recipientScriptLengths, P2WSH_SCRIPT_LENGTH],
            m,
            n,
        );
        const changeAmount = total - recipientTotal - feeAt(withChange);
        if (changeAmount >= DUST_LIMIT) {
            return {
                ...base,
                inputs,
                recipients,
                change: { ...change, amount: changeAmount },
                fee: feeAt(withChange),
                vsize: withChange,
                addedInputs,
            };
        }
        const withoutChange = estimateVsize(inputs.length, recipientScriptLengths, m, n);
        if (total - recipientTotal >= feeAt(withoutChange)) {
            // what is left is too small for a change output: it goes to the fee
            return {
                ...base,
                inputs,
                recipients,
                fee: total - recipientTotal,
                vsize: withoutChange,
                addedInputs,
            };
        }

        return undefined;
    };

    // 1. the extra fee from the change (or the leftover)
    const fromChange = planFor(originalInputs);
    if (fromChange) return { kind: 'plan', plan: fromChange };

    // 2. another confirmed coin, largest first
    const originalIds = originalInputs.map(getCoinId);
    const extra = utxos
        .filter(
            utxo =>
                utxo.confirmations >= MIN_CONFIRMATIONS && !originalIds.includes(getCoinId(utxo)),
        )
        .sort((a, b) => Number(b.value - a.value));
    for (
        let count = 1;
        count <= extra.length && originalInputs.length + count <= PHYLAX_MAX_INPUTS;
        count++
    ) {
        const withCoins = planFor([...originalInputs, ...extra.slice(0, count)]);
        if (withCoins) return { kind: 'plan', plan: withCoins };
    }

    // 3. one recipient and no change (e.g. send max): the recipient gets less
    if (recipients.length === 1 && !originalChange) {
        const vsize = estimateVsize(originalInputs.length, recipientScriptLengths, m, n);
        const fee = feeAt(vsize);
        const total = sum(originalInputs.map(i => i.value));
        const amount = total - fee;
        if (amount >= DUST_LIMIT) {
            return {
                kind: 'plan',
                plan: {
                    ...base,
                    inputs: originalInputs,
                    recipients: [{ ...recipients[0]!, amount }],
                    fee,
                    vsize,
                    addedInputs: 0,
                    decreasedRecipient: { index: 0, from: recipients[0]!.amount, to: amount },
                },
            };
        }
    }

    return {
        kind: 'error',
        text: `Not enough coins to pay the higher fee (the fee alone would be at least ${formatAmount(feeAt(estimateVsize(originalInputs.length, recipientScriptLengths, m, n)))}).`,
    };
};
