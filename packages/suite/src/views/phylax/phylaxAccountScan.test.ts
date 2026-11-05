import TrezorConnect from '@trezor/connect';

import { aggregateTransactions, mapLimited, scanChain } from './phylaxAccountScan';
import { getPhylaxAddress } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';

jest.mock('@trezor/connect', () => ({
    __esModule: true,
    default: { getAccountInfo: jest.fn() },
}));

describe('PHYLAX balance lookups', () => {
    it('runs at most `limit` lookups at a time and keeps the order', async () => {
        let running = 0;
        let maxRunning = 0;
        const items = Array.from({ length: 23 }, (_, i) => i);
        const results = await mapLimited(items, 4, async item => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise(resolve => setTimeout(resolve, (item % 5) * 2));
            running--;

            return item * 10;
        });

        expect(maxRunning).toBe(4);
        expect(results).toEqual(items.map(i => i * 10));
    });

    it('handles fewer items than the limit, and none', async () => {
        expect(await mapLimited([1, 2], 4, i => Promise.resolve(i + 1))).toEqual([2, 3]);
        expect(await mapLimited([], 4, (i: number) => Promise.resolve(i))).toEqual([]);
    });
});

describe('PHYLAX chain scan', () => {
    // Address #0 holds one coin (1 transaction), #2 was used and emptied (2), the rest are unused.
    const TRANSACTIONS: Record<number, number> = { 0: 1, 2: 2 };
    const addressIndex = new Map(
        Array.from({ length: 40 }, (_, i) => [getPhylaxAddress(WALLET, 'testnet', 0, i), i]),
    );

    beforeEach(() => {
        jest.mocked(TrezorConnect.getAccountInfo).mockImplementation(((params: {
            descriptor: string;
            details: string;
        }) => {
            const index = addressIndex.get(params.descriptor)!;
            const funded = index === 0;

            return Promise.resolve({
                success: true,
                payload: {
                    history: { total: TRANSACTIONS[index] ?? 0, unconfirmed: 0 },
                    balance: funded ? '50000' : '0',
                    availableBalance: funded ? '50000' : '0',
                    utxo:
                        params.details === 'txs' && funded
                            ? [
                                  {
                                      txid: 'aa'.repeat(32),
                                      vout: 1,
                                      amount: '50000',
                                      confirmations: 6,
                                  },
                              ]
                            : undefined,
                },
            });
        }) as unknown as typeof TrezorConnect.getAccountInfo);
    });

    it('finds the balance, the coins and the used addresses, stopping after the gap', async () => {
        const result = await scanChain(WALLET, 'testnet', 0);
        expect(result.balance).toBe(50_000n);
        expect(result.lastUsedIndex).toBe(2);
        expect(result.utxos).toEqual([
            {
                txid: 'aa'.repeat(32),
                vout: 1,
                value: 50_000n,
                chain: 0,
                index: 0,
                confirmations: 6,
            },
        ]);
        expect(result.used.map(u => [u.index, u.transactions, u.balance])).toEqual([
            [0, 1, 50_000n],
            [2, 2, 0n],
        ]);
        // 20 unused addresses after #2, and one detail lookup per used address
        expect(jest.mocked(TrezorConnect.getAccountInfo)).toHaveBeenCalledTimes(23 + 2);
    });
});

describe('PHYLAX transactions', () => {
    const OWN = ['own-receive-0', 'own-receive-1', 'own-change-0'];
    const own = new Set(OWN);
    const io = (address: string, value: number) => ({
        n: 0,
        isAddress: true,
        addresses: [address],
        value: String(value),
    });
    const tx = (
        txid: string,
        vin: ReturnType<typeof io>[],
        vout: ReturnType<typeof io>[],
        blockHeight: number | undefined,
        fee = 0,
    ) =>
        ({
            txid,
            type: 'unknown',
            blockHeight,
            blockTime: blockHeight ? 1_700_000_000 + blockHeight : undefined,
            amount: '0',
            fee: String(fee),
            targets: [],
            tokens: [],
            internalTransfers: [],
            details: { vin, vout, size: 0, totalInput: '0', totalOutput: '0' },
        }) as Parameters<typeof aggregateTransactions>[0][number];

    it("nets each transaction over all of the wallet's addresses, once per txid", () => {
        const receive = tx(
            'aa',
            [io('outside-1', 10_500)],
            [io('own-receive-0', 10_000)],
            100,
            500,
        );
        // the send: the coin of receive #0 to an outside address, change to change #0
        const send = tx(
            'bb',
            [io('own-receive-0', 10_000)],
            [io('outside-2', 6_000), io('own-change-0', 3_700)],
            undefined,
            300,
        );
        const self = tx('cc', [io('own-change-0', 3_700)], [io('own-receive-1', 3_500)], 101, 200);

        // the same transaction comes once from each address it touches
        const result = aggregateTransactions([receive, send, self, send, self], own);

        expect(result.map(t => [t.txid, t.type, t.net, t.fee, t.blockHeight])).toEqual([
            // pending first, then the newest block
            ['bb', 'sent', -6_300n, 300n, undefined],
            ['cc', 'self', -200n, 200n, 101],
            ['aa', 'received', 10_000n, 0n, 100],
        ]);
    });

    it('treats a missing or non-positive block height as pending', () => {
        const result = aggregateTransactions(
            [
                tx('dd', [io('outside-1', 5_000)], [io('own-receive-1', 4_000)], 0),
                tx('ee', [io('outside-1', 5_000)], [io('own-receive-1', 4_000)], -1),
            ],
            own,
        );
        expect(result.map(t => [t.blockHeight, t.blockTime])).toEqual([
            [undefined, undefined],
            [undefined, undefined],
        ]);
    });
});
