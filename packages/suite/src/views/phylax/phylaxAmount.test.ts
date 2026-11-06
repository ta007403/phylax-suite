import { getPhylaxAmountFormat } from './phylaxAmount';

describe('PHYLAX amount format', () => {
    it('shows BTC with 8 decimals (tBTC on Testnet)', () => {
        const btc = getPhylaxAmountFormat('mainnet', false);
        expect(btc.format(11_750n)).toBe('0.00011750 BTC');
        expect(btc.parse('0.0001175')).toBe(11_750n);
        expect(getPhylaxAmountFormat('testnet', false).unit).toBe('tBTC');
    });

    it('shows whole satoshis when Bitcoin units is Satoshis', () => {
        const sats = getPhylaxAmountFormat('mainnet', true);
        expect(sats.format(1_234_567n)).toBe('1,234,567 sat');
        expect(sats.formatValue(0n)).toBe('0');
        expect(sats.parse(' 1,234,567 ')).toBe(1_234_567n);
        expect(sats.parse('12.5')).toBeUndefined();
        expect(sats.parse('')).toBeUndefined();
    });
});
