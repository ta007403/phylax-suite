// PHYLAX Blocks (fork): the Send page's form values and the checks on them (no React).

import { asNetworkSymbol } from '@suite-common/networks';
import { parseTransferUri } from '@suite-common/transfer-uri';

import type { PhylaxFeeLevel } from './usePhylaxFeeRates';
import { type PhylaxSendRequest, getOutputScript, parseBtc } from '../phylaxSend';
import type { PhylaxNetwork } from '../phylaxWallet';

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

export type PhylaxScannedPayment =
    { success: true; address: string; amount?: bigint } | { success: false; error: string };

// QR codes often hold bech32 addresses in capitals (a smaller QR code)
const BECH32_CAPITALS = /^(BC|TB|BCRT)1[02-9AC-HJ-NP-Z]+$/;

/**
 * What a scanned QR code pays: a plain address, or a "bitcoin:" payment request (BIP 21) with
 * its address and, if it has one, its amount. Only an address of this network is accepted.
 */
export const readScannedPayment = (text: string, network: PhylaxNetwork): PhylaxScannedPayment => {
    const value = text.trim();
    let address = value;
    let amount: bigint | undefined;
    if (/^bitcoin:/i.test(value)) {
        const uri = parseTransferUri(value, protocol =>
            protocol === 'bitcoin' ? asNetworkSymbol('btc') : null,
        );
        if (!uri.success || !('address' in uri.payload)) {
            return { success: false, error: 'This QR code is not a Bitcoin payment request.' };
        }
        address = uri.payload.address;
        // the shared parser leaves out an amount it cannot read: say so instead
        const rawAmount = new URLSearchParams(value.split('?')[1] ?? '').get('amount');
        if (rawAmount !== null) {
            amount = parseBtc(rawAmount);
            if (amount === undefined || amount <= 0n) {
                return { success: false, error: 'The amount in this QR code is not valid.' };
            }
        }
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        return { success: false, error: 'This QR code is not for Bitcoin (on-chain).' };
    }
    if (BECH32_CAPITALS.test(address)) address = address.toLowerCase();
    if (!getOutputScript(network, address)) {
        return {
            success: false,
            error:
                network === 'mainnet'
                    ? 'This QR code has no Bitcoin address.'
                    : 'This QR code has no Testnet address.',
        };
    }

    return { success: true, address, amount };
};
