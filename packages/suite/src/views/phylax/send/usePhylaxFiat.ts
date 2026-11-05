// PHYLAX Blocks (fork): Suite's current exchange rate in the user's currency (Settings), for the
// amounts of a PHYLAX send. None for Testnet.

import { useCallback, useMemo } from 'react';

import { selectBaseCurrency, selectFiatRatesByFiatRateKey } from '@suite-common/wallet-core';
import { getFiatRateKey } from '@suite-common/wallet-utils';

import { useSelector } from 'src/hooks/suite';

import { type PhylaxNetwork, getPhylaxNetworkSymbol } from '../phylaxWallet';

const SATS_PER_BTC = 100_000_000;

export type PhylaxFiat = {
    // fiat per BTC; undefined when Suite has no rate (Testnet, offline)
    rate: number | undefined;
    currency: string;
    format: (satoshis: bigint) => string;
    toFiatText: (satoshis: bigint) => string;
    // satoshis for a fiat amount, or undefined if not a number
    fromFiatText: (text: string) => bigint | undefined;
};

export const usePhylaxFiat = (network: PhylaxNetwork): PhylaxFiat => {
    const baseCurrency = useSelector(selectBaseCurrency);
    const symbol = getPhylaxNetworkSymbol(network);
    const rate = useSelector(
        state => selectFiatRatesByFiatRateKey(state, getFiatRateKey(symbol, baseCurrency))?.rate,
    );
    const currency = baseCurrency.toUpperCase();
    const formatter = useMemo(
        () =>
            new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
            }),
        [currency],
    );

    const toFiat = useCallback(
        (satoshis: bigint) => (rate ? (Number(satoshis) / SATS_PER_BTC) * rate : undefined),
        [rate],
    );

    return {
        rate,
        currency,
        format: satoshis => {
            const value = toFiat(satoshis);

            return value === undefined ? '' : formatter.format(value);
        },
        toFiatText: satoshis => {
            const value = toFiat(satoshis);

            return value === undefined ? '' : value.toFixed(2);
        },
        fromFiatText: text => {
            const value = Number(text.trim());
            if (!rate || !text.trim() || !Number.isFinite(value) || value < 0) return undefined;

            return BigInt(Math.round((value / rate) * SATS_PER_BTC));
        },
    };
};
