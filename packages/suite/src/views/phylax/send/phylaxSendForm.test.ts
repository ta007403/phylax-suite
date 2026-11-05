import {
    createRecipientDraft,
    getCustomFeeWarnings,
    getSendRequest,
    parseFeeRate,
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
