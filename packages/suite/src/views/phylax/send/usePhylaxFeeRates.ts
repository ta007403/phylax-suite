// PHYLAX Blocks (fork): fee rate estimates for a PHYLAX send, from the backend ("smart"), else the
// coin's built-in defaults ("preloaded").

import { useEffect, useState } from 'react';

import TrezorConnect from '@trezor/connect';

import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork } from '../phylaxWallet';

export type PhylaxFeeLevel = 'low' | 'normal' | 'high';
export type PhylaxFeeRates = Record<PhylaxFeeLevel, number>;
export type PhylaxFeeRatesState = PhylaxFeeRates | { error: string } | undefined;

const loadFeeRates = async (network: PhylaxNetwork): Promise<PhylaxFeeRates> => {
    const coin = PHYLAX_COIN_SYMBOLS[network];
    let result = await TrezorConnect.blockchainEstimateFee({
        coin,
        request: { feeLevels: 'smart' },
    });
    if (!result.success) {
        result = await TrezorConnect.blockchainEstimateFee({
            coin,
            request: { feeLevels: 'preloaded' },
        });
    }
    if (!result.success) throw new Error(result.error.message);
    const rate = (...labels: string[]) => {
        const level = result.payload.levels.find(l => labels.includes(l.label));

        return level ? Number(level.feePerUnit) : NaN;
    };
    const rates = {
        low: rate('low', 'economy'),
        normal: rate('normal'),
        high: rate('high'),
    };
    if (!(rates.normal > 0)) throw new Error('no fee estimate');

    return {
        low: rates.low > 0 ? rates.low : rates.normal,
        normal: rates.normal,
        high: rates.high > 0 ? rates.high : rates.normal,
    };
};

export const usePhylaxFeeRates = (network: PhylaxNetwork): PhylaxFeeRatesState => {
    const [feeRates, setFeeRates] = useState<PhylaxFeeRatesState>();

    useEffect(() => {
        let isCancelled = false;
        setFeeRates(undefined);
        loadFeeRates(network)
            .then(rates => !isCancelled && setFeeRates(rates))
            .catch((error: Error) => !isCancelled && setFeeRates({ error: error.message }));

        return () => {
            isCancelled = true;
        };
    }, [network]);

    return feeRates;
};
