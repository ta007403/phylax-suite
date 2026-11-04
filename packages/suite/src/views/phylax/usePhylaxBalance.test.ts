import TrezorConnect from '@trezor/connect';

import { getPhylaxAddress } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';
import { mapLimited, scanChain } from './usePhylaxBalance';

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
                        params.details === 'tokens' && funded
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
        // 20 unused addresses after #2, and one coin lookup for the funded address
        expect(jest.mocked(TrezorConnect.getAccountInfo)).toHaveBeenCalledTimes(23 + 1);
    });
});
