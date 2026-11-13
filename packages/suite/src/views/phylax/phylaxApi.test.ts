import { scanPhylaxAccount } from './phylaxAccountScan';
import {
    PhylaxApiError,
    createPhylaxApiLookup,
    fetchPhylaxApiScan,
    getPhylaxPrefetchAddresses,
} from './phylaxApi';
import { getPhylaxAddress } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';

const API = 'https://phylax-api.example';
const NETWORK = 'testnet';
const receive = (index: number) => getPhylaxAddress(WALLET, NETWORK, 0, index);
const STRANGER = 'tb1qstranger';

/** A fake PHYLAX API: `payments` (receive index -> sats, confirmed at height 90). */
const fakeApi = (payments: Record<number, number>) => {
    const byAddress = new Map(
        Object.entries(payments).map(([index, value]) => [receive(Number(index)), value]),
    );
    const fetchMock = jest.fn((_url: string, init: { body: string }) => {
        const { addresses } = JSON.parse(init.body) as { addresses: string[] };
        const transactions: Record<string, unknown> = {};
        const items = addresses.map(address => {
            const value = byAddress.get(address);
            if (value === undefined) {
                return { address, txCount: 0, unconfirmedTxCount: 0, utxos: [], txids: [] };
            }
            const txid = `tx-${address}`;
            transactions[txid] = {
                txid,
                blockHeight: 90,
                blockTime: 1_700_000_000,
                fee: '500',
                vsize: 150,
                rbf: false,
                vin: [{ txid: 'ff', vout: 0, value: String(value + 500), addresses: [STRANGER] }],
                vout: [{ n: 0, value: String(value), addresses: [address], isAddress: true }],
            };

            return {
                address,
                txCount: 1,
                unconfirmedTxCount: 0,
                utxos: [{ txid, vout: 0, value: String(value), height: 90, confirmations: 11 }],
                txids: [txid],
            };
        });

        return Promise.resolve({
            ok: true,
            json: () =>
                Promise.resolve({
                    network: NETWORK,
                    tipHeight: 100,
                    addresses: items,
                    transactions,
                }),
        } as Response);
    });

    return fetchMock;
};

const scanThroughApi = async (fetchMock: jest.Mock, next = { receive: 0, change: 0 }) => {
    const lookup = createPhylaxApiLookup(API, fetchMock as never);
    await lookup.prefetch(NETWORK, getPhylaxPrefetchAddresses(WALLET, NETWORK, next));

    return scanPhylaxAccount(WALLET, NETWORK, [], lookup);
};

describe('PHYLAX API scan', () => {
    it('scans a wallet with one request', async () => {
        const fetchMock = fakeApi({ 3: 25_000 });
        const data = await scanThroughApi(fetchMock);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(data.balance).toBe(25_000n);
        expect(data.nextReceiveIndex).toBe(4);
        expect(data.nextChangeIndex).toBe(0);
        expect(data.usedReceiveAddresses).toEqual([
            { index: 3, address: receive(3), transactions: 1, balance: 25_000n },
        ]);
        expect(data.utxos).toEqual([
            {
                txid: `tx-${receive(3)}`,
                vout: 0,
                value: 25_000n,
                chain: 0,
                index: 3,
                confirmations: 11,
            },
        ]);
        expect(data.transactions).toMatchObject([
            { type: 'received', net: 25_000n, fee: 0n, blockHeight: 90, rbf: false },
        ]);
    });

    it('asks for the next addresses when a used one is near the end', async () => {
        // #19 and #35 used: the scan looks up to #55, beyond the 40 asked for first
        const fetchMock = fakeApi({ 19: 1_000, 35: 2_000 });
        const data = await scanThroughApi(fetchMock);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(data.balance).toBe(3_000n);
        expect(data.nextReceiveIndex).toBe(36);
    });

    it("prefetches up to the last scan's first unused address plus the gap", async () => {
        // last scan: #22 the last used; now #40 is used too
        const fetchMock = fakeApi({ 5: 1_000, 22: 2_000, 40: 3_000 });
        const data = await scanThroughApi(fetchMock, { receive: 23, change: 0 });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(data.nextReceiveIndex).toBe(41);
    });
});

describe('PHYLAX API requests', () => {
    const answer = (status: number, body: unknown) =>
        jest.fn().mockResolvedValue({
            ok: status === 200,
            status,
            json: () => Promise.resolve(body),
        });

    it('says why a request failed', async () => {
        await expect(
            fetchPhylaxApiScan(API, NETWORK, [receive(0)], answer(503, { detail: 'busy' })),
        ).rejects.toThrow(new PhylaxApiError('HTTP 503: busy'));
        await expect(
            fetchPhylaxApiScan(
                API,
                NETWORK,
                [receive(0)],
                jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
            ),
        ).rejects.toThrow('Failed to fetch');
        // an answer without one of the addresses
        await expect(
            fetchPhylaxApiScan(
                API,
                NETWORK,
                [receive(0)],
                answer(200, { addresses: [], transactions: {} }),
            ),
        ).rejects.toThrow('incomplete answer');
    });

    it('posts to /v1/scan (trailing slash ignored)', async () => {
        const fetchMock = fakeApi({});
        await fetchPhylaxApiScan(`${API}/`, NETWORK, [receive(0)], fetchMock as never);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API}/v1/scan`);
        expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({
            network: NETWORK,
            addresses: [receive(0)],
        });
    });

    it('asks in chunks of at most 400 addresses', async () => {
        const fetchMock = fakeApi({});
        const lookup = createPhylaxApiLookup(API, fetchMock as never);
        const addresses = Array.from({ length: 450 }, (_, index) => receive(index));
        await lookup.prefetch(NETWORK, addresses);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // already known: no request
        await lookup.lookUp(NETWORK, addresses.slice(0, 10), new Set());
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
