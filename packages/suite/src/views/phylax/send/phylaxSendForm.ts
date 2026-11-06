// PHYLAX Blocks (fork): the Send page's form values and the checks on them (no React).

import type { PhylaxFeeLevel } from './usePhylaxFeeRates';
import { type PhylaxSendRequest, parseBtc } from '../phylaxSend';

export type PhylaxRecipientDraft = {
    id: number;
    address: string;
    amountText: string;
    fiatText: string;
    isSendMax: boolean;
};

export type PhylaxFeeChoice = PhylaxFeeLevel | 'custom';

export const createRecipientDraft = (id: number): PhylaxRecipientDraft => ({
    id,
    address: '',
    amountText: '',
    fiatText: '',
    isSendMax: false,
});

/** "1.5" -> 1.5 sat/vB; undefined if not a positive number with at most 2 decimals. */
export const parseFeeRate = (text: string): number | undefined => {
    const value = text.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
    const rate = Number(value);

    return rate > 0 ? rate : undefined;
};

// Warnings for a custom fee, as in Trezor Suite.
const HIGH_FEE_FACTOR = 2;
const HIGH_FEE_SHARE = 0.1;

export const getCustomFeeWarnings = ({
    feeRate,
    highRate,
    fee,
    amount,
}: {
    feeRate: number;
    highRate: number | undefined;
    fee: bigint | undefined;
    // satoshis paid to the recipients
    amount: bigint | undefined;
}) => {
    const warnings: string[] = [];
    if (highRate !== undefined && feeRate > highRate * HIGH_FEE_FACTOR) {
        warnings.push(
            `This is more than twice the High fee (${highRate} sat/vB): you would pay more than needed.`,
        );
    }
    if (fee !== undefined && amount !== undefined && amount > 0n) {
        if (Number(fee) > Number(amount) * HIGH_FEE_SHARE) {
            warnings.push('The fee is more than 10% of the amount you send.');
        }
    }

    return warnings;
};

/**
 * The plan request from the form, or why there is none yet: undefined while something is still
 * empty, a text when something is invalid.
 */
export const getSendRequest = (
    recipients: PhylaxRecipientDraft[],
    feeRate: number | undefined,
    coinIds: string[] | undefined,
    // the amount as typed, in the unit of Settings › Bitcoin units
    parseAmount: (text: string) => bigint | undefined = parseBtc,
): PhylaxSendRequest | { error: string } | undefined => {
    if (feeRate === undefined) return undefined;
    const parsed = [];
    for (const [index, recipient] of recipients.entries()) {
        if (!recipient.address.trim()) return undefined;
        const prefix = recipients.length > 1 ? `Recipient ${index + 1}: ` : '';
        if (recipient.isSendMax) {
            parsed.push({ address: recipient.address, amount: 0n, isSendMax: true });
            continue;
        }
        if (!recipient.amountText.trim()) return undefined;
        const amount = parseAmount(recipient.amountText);
        if (amount === undefined) return { error: `${prefix}Invalid amount.` };
        parsed.push({ address: recipient.address, amount, isSendMax: false });
    }

    return { recipients: parsed, feeRate, coinIds };
};
