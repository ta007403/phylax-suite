import { Transaction, networks } from '@trezor/utxo-lib';

import type { PhylaxUtxo } from './phylaxAccountScan';
import {
    PHYLAX_MAX_INPUTS,
    type PhylaxSendPlan,
    type PhylaxSendRequest,
    RBF_SEQUENCE,
    checkSignedTx,
    estimateVsize,
    getCoinId,
    getOutputScript,
    getPhylaxSignParams,
    getSignedTxid,
    parseBtc,
    planPhylaxSend,
} from './phylaxSend';
import { getPhylaxAddress, getPhylaxWitnessScript } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';

// A Testnet P2WPKH address (BIP84 test vector), and a mainnet one.
const TESTNET_RECIPIENT = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl';
const MAINNET_RECIPIENT = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';

const utxo = (value: number, n: number, confirmations = 3): PhylaxUtxo => ({
    txid: n.toString(16).padStart(64, '0'),
    vout: n % 3,
    value: BigInt(value),
    chain: 0,
    index: n,
    confirmations,
});

/** One recipient paid `amount`, or the maximum. */
const pay = (
    address: string,
    amount: bigint,
    options: { isSendMax?: boolean; feeRate?: number; coinIds?: string[] } = {},
): PhylaxSendRequest => ({
    recipients: [{ address, amount, isSendMax: options.isSendMax ?? false }],
    feeRate: options.feeRate ?? 2,
    coinIds: options.coinIds,
});

const plan = (result: ReturnType<typeof planPhylaxSend>) => {
    if (result.kind !== 'plan') throw new Error(`no plan: ${result.text}`);

    return result.plan;
};

describe('parseBtc', () => {
    it('reads amounts with up to 8 decimals', () => {
        expect(parseBtc('0.0012')).toBe(120_000n);
        expect(parseBtc('1')).toBe(100_000_000n);
        expect(parseBtc(' 2.5 ')).toBe(250_000_000n);
        expect(parseBtc('.5')).toBe(50_000_000n);
        expect(parseBtc('0.00000001')).toBe(1n);
    });

    it('refuses anything else', () => {
        ['', 'abc', '1.123456789', '-1', '1,5', '1.2.3', '.'].forEach(text =>
            expect(parseBtc(text)).toBeUndefined(),
        );
    });
});

describe('estimateVsize', () => {
    it('sizes a 2-of-2 P2WSH spend with the largest signatures', () => {
        // 1 input, a P2WPKH payment and a P2WSH change: about 181 vB on the network
        expect(estimateVsize(1, [22, 34], 2, 2)).toBe(181);
        // every further input adds its outpoint and witness
        expect(estimateVsize(2, [22, 34], 2, 2) - estimateVsize(1, [22, 34], 2, 2)).toBe(97);
    });
});

describe('planPhylaxSend', () => {
    const coins = [utxo(100_000, 1), utxo(50_000, 2), utxo(999_999, 3, 0)];
    const request = pay(TESTNET_RECIPIENT, 60_000n);

    it('pays from the largest confirmed coin, change to the next change address', () => {
        const p = plan(planPhylaxSend(WALLET, 'testnet', coins, 3, request));
        expect(p.inputs.map(input => input.value)).toEqual([100_000n]);
        expect(p.recipients).toEqual([{ address: TESTNET_RECIPIENT, amount: 60_000n }]);
        expect(p.fee).toBe(362n);
        expect(p.change).toEqual({
            chain: 1,
            index: 3,
            address: getPhylaxAddress(WALLET, 'testnet', 1, 3),
            amount: 100_000n - 60_000n - 362n,
        });
    });

    it('never spends unconfirmed coins', () => {
        const result = planPhylaxSend(
            WALLET,
            'testnet',
            coins,
            0,
            pay(TESTNET_RECIPIENT, 500_000n),
        );
        expect(result.kind).toBe('error');
    });

    it('adds coins until the payment and the fee are covered', () => {
        const p = plan(
            planPhylaxSend(WALLET, 'testnet', coins, 0, pay(TESTNET_RECIPIENT, 120_000n)),
        );
        expect(p.inputs).toHaveLength(2);
        expect(p.recipients[0]!.amount + p.fee + (p.change?.amount ?? 0n)).toBe(150_000n);
    });

    it('gives a leftover too small for change to the fee', () => {
        const p = plan(
            planPhylaxSend(WALLET, 'testnet', [utxo(10_000, 1)], 0, pay(TESTNET_RECIPIENT, 9_500n)),
        );
        expect(p.change).toBeUndefined();
        expect(p.fee).toBe(500n);
    });

    it('sends everything confirmed to a send-max recipient', () => {
        const p = plan(
            planPhylaxSend(
                WALLET,
                'testnet',
                coins,
                0,
                pay(TESTNET_RECIPIENT, 0n, { isSendMax: true }),
            ),
        );
        expect(p.inputs).toHaveLength(2);
        expect(p.change).toBeUndefined();
        expect(p.recipients[0]!.amount + p.fee).toBe(150_000n);
    });

    it('pays several recipients, the send-max one gets the rest', () => {
        const p = plan(
            planPhylaxSend(WALLET, 'testnet', coins, 0, {
                recipients: [
                    { address: TESTNET_RECIPIENT, amount: 20_000n, isSendMax: false },
                    { address: TESTNET_RECIPIENT, amount: 0n, isSendMax: true },
                ],
                feeRate: 2,
            }),
        );
        expect(p.recipients[0]!.amount).toBe(20_000n);
        expect(p.recipients[0]!.amount + p.recipients[1]!.amount + p.fee).toBe(150_000n);
        // two payments, no change: the fee covers both outputs
        expect(p.vsize).toBe(estimateVsize(2, [22, 22], 2, 2));
    });

    it('pays several fixed amounts with one change', () => {
        const p = plan(
            planPhylaxSend(WALLET, 'testnet', coins, 4, {
                recipients: [
                    { address: TESTNET_RECIPIENT, amount: 30_000n, isSendMax: false },
                    { address: TESTNET_RECIPIENT, amount: 40_000n, isSendMax: false },
                ],
                feeRate: 1,
            }),
        );
        expect(p.inputs).toHaveLength(1);
        expect(p.change?.amount).toBe(100_000n - 70_000n - p.fee);
    });

    it('says which recipient is wrong, and allows one send-max only', () => {
        const wrong = planPhylaxSend(WALLET, 'testnet', coins, 0, {
            recipients: [
                { address: TESTNET_RECIPIENT, amount: 30_000n, isSendMax: false },
                { address: MAINNET_RECIPIENT, amount: 30_000n, isSendMax: false },
            ],
            feeRate: 1,
        });
        expect(wrong).toEqual({
            kind: 'error',
            text: 'Recipient 2: This is not a Testnet address.',
        });
        const twoMax = planPhylaxSend(WALLET, 'testnet', coins, 0, {
            recipients: [
                { address: TESTNET_RECIPIENT, amount: 0n, isSendMax: true },
                { address: TESTNET_RECIPIENT, amount: 0n, isSendMax: true },
            ],
            feeRate: 1,
        });
        expect(twoMax.kind).toBe('error');
    });

    it('spends exactly the chosen coins (coin control)', () => {
        const chosen = [getCoinId(coins[1]!)];
        const p = plan(
            planPhylaxSend(
                WALLET,
                'testnet',
                coins,
                0,
                pay(TESTNET_RECIPIENT, 10_000n, { coinIds: chosen }),
            ),
        );
        // the 50 000 coin, although the 100 000 one is larger
        expect(p.inputs.map(getCoinId)).toEqual(chosen);
        expect(p.change?.amount).toBe(50_000n - 10_000n - p.fee);

        const short = planPhylaxSend(
            WALLET,
            'testnet',
            coins,
            0,
            pay(TESTNET_RECIPIENT, 60_000n, { coinIds: chosen }),
        );
        expect(short.kind === 'error' && short.text).toContain('chosen coins');
    });

    it('refuses chosen coins that are unconfirmed, or none', () => {
        const unconfirmed = planPhylaxSend(
            WALLET,
            'testnet',
            coins,
            0,
            pay(TESTNET_RECIPIENT, 10_000n, { coinIds: [getCoinId(coins[2]!)] }),
        );
        expect(unconfirmed).toEqual({
            kind: 'error',
            text: 'Unconfirmed coins cannot be spent yet.',
        });
        const none = planPhylaxSend(
            WALLET,
            'testnet',
            coins,
            0,
            pay(TESTNET_RECIPIENT, 10_000n, { coinIds: [] }),
        );
        expect(none).toEqual({ kind: 'error', text: 'Choose at least one coin.' });
    });

    it('takes a custom fee rate, not below 1 sat/vB', () => {
        const custom = plan(
            planPhylaxSend(
                WALLET,
                'testnet',
                coins,
                0,
                pay(TESTNET_RECIPIENT, 60_000n, { feeRate: 1.5 }),
            ),
        );
        expect(custom.fee).toBe(BigInt(Math.ceil(custom.vsize * 1.5)));
        const tooLow = planPhylaxSend(
            WALLET,
            'testnet',
            coins,
            0,
            pay(TESTNET_RECIPIENT, 60_000n, { feeRate: 0.5 }),
        );
        expect(tooLow).toEqual({ kind: 'error', text: 'The fee must be at least 1 sat/vB.' });
    });

    it('refuses an address of the other network', () => {
        const result = planPhylaxSend(WALLET, 'testnet', coins, 0, pay(MAINNET_RECIPIENT, 60_000n));
        expect(result).toEqual({ kind: 'error', text: 'This is not a Testnet address.' });
    });

    it('uses at most the inputs the main block can sign', () => {
        const many = Array.from({ length: PHYLAX_MAX_INPUTS + 4 }, (_, i) => utxo(10_000, i + 1));
        const all = plan(
            planPhylaxSend(
                WALLET,
                'testnet',
                many,
                0,
                pay(TESTNET_RECIPIENT, 0n, { isSendMax: true }),
            ),
        );
        expect(all.inputs).toHaveLength(PHYLAX_MAX_INPUTS);
        const tooMuch = planPhylaxSend(
            WALLET,
            'testnet',
            many,
            0,
            pay(TESTNET_RECIPIENT, 170_000n),
        );
        expect(tooMuch.kind === 'error' && tooMuch.text).toContain('largest coins');
    });
});

describe('getPhylaxSignParams', () => {
    it('puts the wallet multisig on every input and on the change', () => {
        const coins = [utxo(100_000, 5)];
        const p = plan(
            planPhylaxSend(
                WALLET,
                'testnet',
                coins,
                7,
                pay(TESTNET_RECIPIENT, 30_000n, { feeRate: 1 }),
            ),
        );
        const params = getPhylaxSignParams(WALLET, 'testnet', p);
        expect(params.inputs[0]).toMatchObject({
            address_n: "m/48'/1'/0'/2'/0/5",
            prev_hash: coins[0]!.txid,
            amount: '100000',
            script_type: 'SPENDWITNESS',
            // replaceable (RBF)
            sequence: RBF_SEQUENCE,
        });
        expect(params.inputs[0]!.multisig.pubkeys.map(key => key.address_n)).toEqual([
            [0, 5],
            [0, 5],
        ]);
        expect(params.outputs[1]).toMatchObject({
            address_n: "m/48'/1'/0'/2'/1/7",
            script_type: 'PAYTOWITNESS',
        });
        const change = params.outputs[1]!;
        expect('multisig' in change && change.multisig.pubkeys[0]!.address_n).toEqual([1, 7]);
    });
});

describe('checkSignedTx', () => {
    const p: PhylaxSendPlan = plan(
        planPhylaxSend(
            WALLET,
            'testnet',
            [utxo(100_000, 9)],
            2,
            pay(TESTNET_RECIPIENT, 40_000n, { feeRate: 1 }),
        ),
    );

    // DER-shaped placeholder signatures; the device's signatures are checked by the network
    const sig = (fill: number) =>
        Buffer.concat([Buffer.from([0x30, 0x44]), Buffer.alloc(70, fill)]);
    const witnessScript = getPhylaxWitnessScript(WALLET, 'testnet', 0, 9);
    const complete = [Buffer.alloc(0), sig(1), sig(2), witnessScript];

    const signed = (overrides: { amount?: bigint; witness?: Buffer[] } = {}) => {
        const tx = new Transaction({ network: networks.testnet });
        tx.version = 2;
        tx.ins.push({
            hash: Buffer.from(p.inputs[0]!.txid, 'hex').reverse(),
            index: p.inputs[0]!.vout,
            script: Buffer.alloc(0),
            sequence: 0xffffffff,
            witness: overrides.witness ?? complete,
        });
        tx.outs.push({
            script: getOutputScript('testnet', TESTNET_RECIPIENT)!,
            value: (overrides.amount ?? p.recipients[0]!.amount).toString(),
        });
        tx.outs.push({
            script: getOutputScript('testnet', p.change!.address)!,
            value: p.change!.amount.toString(),
        });

        return tx.toHex();
    };

    it('accepts the planned transaction', () => {
        expect(checkSignedTx(WALLET, 'testnet', p, signed())).toBeUndefined();
    });

    it('reads the transaction id (the witness does not change it)', () => {
        const txid = getSignedTxid('testnet', signed());
        expect(txid).toBe(Transaction.fromHex(signed(), { network: networks.testnet }).getId());
        expect(txid).toMatch(/^[0-9a-f]{64}$/);
        const otherSignatures = signed({
            witness: [Buffer.alloc(0), sig(7), sig(8), witnessScript],
        });
        expect(getSignedTxid('testnet', otherSignatures)).toBe(txid);
        expect(getSignedTxid('testnet', 'zz')).toBeUndefined();
    });

    it('refuses other amounts', () => {
        expect(checkSignedTx(WALLET, 'testnet', p, signed({ amount: 39_999n }))).toContain(
            'amounts',
        );
    });

    it('refuses a transaction without signatures', () => {
        expect(checkSignedTx(WALLET, 'testnet', p, signed({ witness: [] }))).toContain(
            'signatures',
        );
    });

    it('refuses a 2-of-2 input signed by one block only (the network rejects it)', () => {
        const oneSignature = [Buffer.alloc(0), sig(1), witnessScript];
        expect(checkSignedTx(WALLET, 'testnet', p, signed({ witness: oneSignature }))).toContain(
            'did not sign',
        );
    });

    it("refuses a witness script that is not the wallet's", () => {
        const otherScript = getPhylaxWitnessScript(WALLET, 'testnet', 0, 10);
        const witness = [Buffer.alloc(0), sig(1), sig(2), otherScript];
        expect(checkSignedTx(WALLET, 'testnet', p, signed({ witness }))).toContain('signatures');
    });

    it('refuses something that is not a transaction', () => {
        expect(checkSignedTx(WALLET, 'testnet', p, 'deadbeef')).toContain('could not be read');
    });
});
