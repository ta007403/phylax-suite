import type { PhylaxTransaction, PhylaxUtxo } from './phylaxAccountScan';
import { type PhylaxBumpPlan, getOriginalFeeRate, planPhylaxBump } from './phylaxBump';
import { estimateVsize, getCoinId } from './phylaxSend';
import { getPhylaxAddress } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';

const RECIPIENT = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl';
const own = (chain: 0 | 1, index: number) => ({
    address: getPhylaxAddress(WALLET, 'testnet', chain, index),
    own: { chain, index },
});

/** A pending payment: one 100 000 coin (receive #0) to RECIPIENT, change to change #0. */
const pendingTx = (
    outputs: { address: string; value: bigint; own?: { chain: 0 | 1; index: number } }[],
    rbf = true,
): PhylaxTransaction => ({
    txid: 'aa'.repeat(32),
    type: 'sent',
    net: 0n,
    fee: 0n,
    blockHeight: undefined,
    blockTime: undefined,
    rbf,
    pending: {
        inputs: [{ txid: 'bb'.repeat(32), vout: 0, value: 100_000n, ...own(0, 0) }],
        outputs,
        vsize: 180,
    },
});

const withChange = pendingTx([
    { address: RECIPIENT, value: 60_000n },
    { ...own(1, 0), value: 39_640n }, // fee 360 = 2 sat/vB
]);
const coin = (value: number, index: number, confirmations = 3): PhylaxUtxo => ({
    txid: `${index}`.padStart(64, 'c'),
    vout: 0,
    value: BigInt(value),
    chain: 0,
    index,
    confirmations,
});

const plan = (result: ReturnType<typeof planPhylaxBump>): PhylaxBumpPlan => {
    if (result.kind !== 'plan') throw new Error(result.text);

    return result.plan;
};

describe('PHYLAX Speed up', () => {
    it('knows the pending fee rate', () => {
        expect(getOriginalFeeRate(withChange, WALLET)).toBe(2);
    });

    it('takes the extra fee from the change, same coin, same recipient, same change address', () => {
        const p = plan(planPhylaxBump(WALLET, 'testnet', withChange, [], 1, 5));
        expect(p.inputs.map(getCoinId)).toEqual([`${'bb'.repeat(32)}:0`]);
        expect(p.recipients).toEqual([{ address: RECIPIENT, amount: 60_000n }]);
        expect(p.change).toMatchObject({ chain: 1, index: 0, amount: 100_000n - 60_000n - p.fee });
        expect(p.fee).toBe(BigInt(Math.ceil(p.vsize * 5)));
        expect(p).toMatchObject({ addedInputs: 0, originalFee: 360n });
    });

    it('pays at least the old fee plus 1 sat/vB of the new size (BIP125)', () => {
        const p = plan(planPhylaxBump(WALLET, 'testnet', withChange, [], 1, 2.1));
        expect(p.fee).toBe(360n + BigInt(p.vsize));
    });

    it('refuses a rate not above the current one, and a non-replaceable transaction', () => {
        expect(planPhylaxBump(WALLET, 'testnet', withChange, [], 1, 2).kind).toBe('error');
        const final = { ...withChange, rbf: false };
        expect(planPhylaxBump(WALLET, 'testnet', final, [], 1, 5)).toEqual({
            kind: 'error',
            text: 'This transaction cannot be replaced (no RBF signal).',
        });
    });

    it('adds a confirmed coin when the change cannot pay, never an unconfirmed one', () => {
        const tight = pendingTx([
            { address: RECIPIENT, value: 99_000n },
            { ...own(1, 0), value: 640n },
        ]);
        const p = plan(
            planPhylaxBump(WALLET, 'testnet', tight, [coin(5_000, 7, 0), coin(50_000, 8)], 1, 10),
        );
        expect(p.addedInputs).toBe(1);
        expect(p.inputs.map(i => i.index)).toEqual([0, 8]);
        expect(p.recipients[0]!.amount).toBe(99_000n);
        expect(p.change?.index).toBe(0);
    });

    it('lowers the only recipient when there is no change and no other coin (send max)', () => {
        const sendMax = pendingTx([{ address: RECIPIENT, value: 99_700n }]);
        const p = plan(planPhylaxBump(WALLET, 'testnet', sendMax, [], 0, 4));
        const vsize = estimateVsize(1, [22], 2, 2);
        expect(p.change).toBeUndefined();
        expect(p.decreasedRecipient).toEqual({
            index: 0,
            from: 99_700n,
            to: 100_000n - BigInt(Math.ceil(vsize * 4)),
        });
        expect(p.recipients[0]!.amount + p.fee).toBe(100_000n);
    });

    it("refuses coins that are not the wallet's", () => {
        const foreign = {
            ...withChange,
            pending: {
                ...withChange.pending!,
                inputs: [{ ...withChange.pending!.inputs[0]!, own: undefined }],
            },
        };
        expect(planPhylaxBump(WALLET, 'testnet', foreign, [], 1, 5).kind).toBe('error');
    });
});
