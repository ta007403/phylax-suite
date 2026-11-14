import {
    createRecipientDraft,
    getCustomFeeWarnings,
    getSendRequest,
    parseFeeRate,
    readScannedPayment,
} from './phylaxSendForm';

describe('PHYLAX send form', () => {
    it('reads a custom fee rate', () => {
        expect(parseFeeRate('3')).toBe(3);
        expect(parseFeeRate(' 1.5 ')).toBe(1.5);
        ['', '0', 'abc', '-2', '1.234', '1,5'].forEach(text =>
            expect(parseFeeRate(text)).toBeUndefined(),
        );
    });

    it('warns about a fee above twice High, or above 10% of the amount', () => {
        expect(
            getCustomFeeWarnings({ feeRate: 10, highRate: 6, fee: 2_000n, amount: 100_000n }),
        ).toEqual([]);
        expect(
            getCustomFeeWarnings({ feeRate: 13, highRate: 6, fee: 2_000n, amount: 100_000n }),
        ).toHaveLength(1);
        expect(
            getCustomFeeWarnings({ feeRate: 5, highRate: 6, fee: 2_000n, amount: 10_000n }),
        ).toEqual(['The fee is more than 10% of the amount you send.']);
    });

    it('waits for empty fields, names the wrong amount, and passes coin control on', () => {
        const draft = { ...createRecipientDraft(1), address: 'tb1q' };
        expect(getSendRequest([draft], 2, undefined)).toBeUndefined();
        expect(
            getSendRequest([{ ...draft, amountText: '1' }], undefined, undefined),
        ).toBeUndefined();
        expect(
            getSendRequest(
                [
                    { ...draft, amountText: '0.1' },
                    { ...draft, amountText: 'x' },
                ],
                2,
                undefined,
            ),
        ).toEqual({ error: 'Recipient 2: Invalid amount.' });
        expect(getSendRequest([{ ...draft, isSendMax: true }], 2, ['aa:0'])).toEqual({
            recipients: [{ address: 'tb1q', amount: 0n, isSendMax: true }],
            feeRate: 2,
            coinIds: ['aa:0'],
        });
    });
});

describe('readScannedPayment (QR code)', () => {
    // BIP 173 test vectors
    const MAINNET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

    it('reads a plain address, also in capitals', () => {
        expect(readScannedPayment(` ${MAINNET} `, 'mainnet')).toEqual({
            success: true,
            address: MAINNET,
            amount: undefined,
        });
        expect(readScannedPayment(MAINNET.toUpperCase(), 'mainnet')).toMatchObject({
            success: true,
            address: MAINNET,
        });
    });

    it('reads a bitcoin: payment request with its amount', () => {
        expect(
            readScannedPayment(`bitcoin:${MAINNET}?amount=0.00012&label=Coffee`, 'mainnet'),
        ).toEqual({ success: true, address: MAINNET, amount: 12000n });
        expect(readScannedPayment(`BITCOIN:${MAINNET.toUpperCase()}?amount=1`, 'mainnet')).toEqual({
            success: true,
            address: MAINNET,
            amount: 100000000n,
        });
        expect(readScannedPayment(`bitcoin:${TESTNET}`, 'testnet')).toEqual({
            success: true,
            address: TESTNET,
            amount: undefined,
        });
    });

    it('refuses other networks, other coins, and text that is no address', () => {
        expect(readScannedPayment(TESTNET, 'mainnet')).toEqual({
            success: false,
            error: 'This QR code has no Bitcoin address.',
        });
        expect(readScannedPayment(`bitcoin:${MAINNET}`, 'testnet')).toEqual({
            success: false,
            error: 'This QR code has no Testnet address.',
        });
        expect(
            readScannedPayment('ethereum:0x0000000000000000000000000000000000000000', 'mainnet'),
        ).toMatchObject({ success: false, error: 'This QR code is not for Bitcoin (on-chain).' });
        expect(readScannedPayment('lightning:lnbc1...', 'mainnet')).toMatchObject({
            success: false,
        });
        expect(readScannedPayment('hello', 'mainnet')).toMatchObject({ success: false });
        expect(readScannedPayment(`bitcoin:${MAINNET}?amount=abc`, 'mainnet')).toMatchObject({
            success: false,
        });
    });
});
