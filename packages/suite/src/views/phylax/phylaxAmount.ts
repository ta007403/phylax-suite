// PHYLAX Blocks (fork): amounts in the unit chosen in Settings › Bitcoin units, as in the rest of
// Suite: BTC (tBTC on Testnet) with 8 decimals, or whole satoshis.

import { formatBtc, parseBtc } from './phylaxSend';
import { type PhylaxNetwork, getPhylaxUnit } from './phylaxWallet';

export type PhylaxAmountFormat = {
    isSats: boolean;
    // "BTC", "tBTC" or "sat"
    unit: string;
    // the number only, e.g. "0.00011750" or "11,750"
    formatValue: (satoshis: bigint) => string;
    // with the unit, e.g. "0.00011750 BTC" or "11,750 sat"
    format: (satoshis: bigint) => string;
    // satoshis for what the user typed in this unit, or undefined if it is not an amount
    parse: (text: string) => bigint | undefined;
};

const SATS_UNIT = 'sat';

const formatSats = (satoshis: bigint) => satoshis.toLocaleString('en-US');

/** Whole satoshis; thousands separators (commas, spaces) are allowed. */
const parseSats = (text: string) => {
    const value = text.trim().replace(/[,\s]/g, '');

    return /^\d+$/.test(value) ? BigInt(value) : undefined;
};

export const getPhylaxAmountFormat = (
    network: PhylaxNetwork,
    isSats: boolean,
): PhylaxAmountFormat => {
    const unit = isSats ? SATS_UNIT : getPhylaxUnit(network);
    const formatValue = isSats ? formatSats : formatBtc;

    return {
        isSats,
        unit,
        formatValue,
        format: satoshis => `${formatValue(satoshis)} ${unit}`,
        parse: isSats ? parseSats : parseBtc,
    };
};
