import type { SuiteSettingsRootState } from '@suite/settings';
import TrezorConnect from '@trezor/connect';
import { createMockDispatch } from '@trezor/redux-utils/mocks';

import {
    type PhylaxRootState,
    type PhylaxState,
    deserializePhylaxAccountData,
    getPhylaxAccountKey,
    phylaxActions,
    phylaxInitialState,
    phylaxReducer,
    serializePhylaxAccountData,
} from './phylaxReducer';
import {
    RECHECK_DELAY_MS,
    refreshPhylaxAccountAndRecheckThunk,
    refreshPhylaxAccountThunk,
    subscribePhylaxAccountThunk,
    unsubscribePhylaxAccountThunk,
} from './phylaxThunks';
import { type PhylaxAccountData, scanPhylaxAccount } from '../phylaxAccountScan';
import { WALLET } from '../phylaxWallet.fixture';

// no built-in PHYLAX API in the tests: never a real network request
jest.mock('src/constants/suite/phylax', () => ({
    ...jest.requireActual('src/constants/suite/phylax'),
    PHYLAX_API_DEFAULT_URL: '',
}));
jest.mock('../phylaxAccountScan', () => ({
    ...jest.requireActual('../phylaxAccountScan'),
    scanPhylaxAccount: jest.fn(),
}));

const SUMMARY = {
    slot: WALLET.slot,
    name: WALLET.name,
    threshold: WALLET.threshold,
    complete: true,
    fingerprints: WALLET.keys.map(key => key.fingerprint),
};

const DATA: PhylaxAccountData = {
    balance: 3_700n,
    usedAddressCount: 2,
    nextReceiveIndex: 1,
    nextChangeIndex: 1,
    usedAddresses: ['bc1q'],
    utxos: [{ txid: 'bb', vout: 1, value: 3_700n, chain: 1, index: 0, confirmations: 0 }],
    usedReceiveAddresses: [{ index: 0, address: 'bc1q', transactions: 2, balance: 0n }],
    transactions: [
        {
            txid: 'bb',
            type: 'sent',
            net: -6_300n,
            fee: 300n,
            blockHeight: undefined,
            blockTime: undefined,
            rbf: true,
            pending: {
                inputs: [
                    {
                        txid: 'aa',
                        vout: 0,
                        value: 10_000n,
                        address: 'bc1q',
                        own: { chain: 0, index: 0 },
                    },
                ],
                outputs: [
                    { address: 'bc1qoutside', value: 6_000n },
                    { address: 'bc1qchange', value: 3_700n, own: { chain: 1, index: 0 } },
                ],
                vsize: 180,
            },
        },
    ],
};

const state: PhylaxRootState & SuiteSettingsRootState = {
    suiteSettings: { debug: {} } as unknown as SuiteSettingsRootState['suiteSettings'],
    phylax: {
        ...phylaxInitialState,
        devicePath: '1',
        isLoaded: true,
        wallets: [{ summary: SUMMARY, details: WALLET }],
    },
};
const KEY = getPhylaxAccountKey(SUMMARY, 'mainnet');

const setUp = () => {
    const getState = () => state;
    const { actions, dispatch } = createMockDispatch({ getState, extra: {} });

    return { actions, dispatch, getState };
};

const loadedTypes = (actions: unknown[]) =>
    actions.filter(action => phylaxActions.accountLoaded.match(action as never));

describe('PHYLAX account store', () => {
    it('keeps amounts as strings and gives them back as bigint', () => {
        const stored = serializePhylaxAccountData(DATA);
        expect(stored.balance).toBe('3700');
        expect(stored.transactions[0]?.net).toBe('-6300');
        expect(stored.transactions[0]?.pending?.outputs[1]?.value).toBe('3700');
        expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
        expect(deserializePhylaxAccountData(stored)).toEqual(DATA);
    });

    it('keeps the last data while a refresh runs, and forgets everything for another device', () => {
        let phylax = phylaxReducer(
            state.phylax,
            phylaxActions.accountLoaded({
                key: KEY,
                data: serializePhylaxAccountData(DATA),
                time: 1,
            }),
        );
        phylax = phylaxReducer(phylax, phylaxActions.accountRefreshStarted({ key: KEY }));
        expect(phylax.accounts[KEY]).toMatchObject({ isRefreshing: true, updatedAt: 1 });
        expect(phylax.accounts[KEY]?.data?.balance).toBe('3700');

        phylax = phylaxReducer(phylax, phylaxActions.accountFailed({ key: KEY, error: 'offline' }));
        expect(phylax.accounts[KEY]).toMatchObject({ isRefreshing: false, error: 'offline' });
        expect(phylax.accounts[KEY]?.data?.balance).toBe('3700');

        phylax = phylaxReducer(phylax, phylaxActions.deviceChanged('2'));
        expect(phylax).toEqual({ ...phylaxInitialState, devicePath: '2' });
    });

    it('keeps the "Never" combinations the main block reports', () => {
        const phylax = phylaxReducer(
            state.phylax,
            phylaxActions.stackLoaded({
                devicePath: '1',
                blocks: [],
                wallets: [],
                isStoragePresent: true,
                ignored: [[1, 2]],
            }),
        );
        expect(phylax.ignored).toEqual([[1, 2]]);
    });

    it('drops a stack read from a device that is no longer selected', () => {
        const phylax = phylaxReducer(
            state.phylax,
            phylaxActions.stackLoaded({
                devicePath: 'old',
                blocks: [],
                wallets: [],
                isStoragePresent: true,
                ignored: [],
            }),
        );
        expect(phylax.wallets).toHaveLength(1);
    });
});

describe('PHYLAX account refresh', () => {
    beforeEach(() => {
        jest.mocked(scanPhylaxAccount).mockReset();
        jest.useRealTimers();
    });

    it('scans once more when asked again during a scan', async () => {
        let finishFirst: (data: PhylaxAccountData) => void = () => {};
        jest.mocked(scanPhylaxAccount)
            .mockImplementationOnce(() => new Promise(resolve => (finishFirst = resolve)))
            .mockResolvedValueOnce(DATA);
        const { actions, dispatch } = setUp();

        const first = dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        expect(scanPhylaxAccount).toHaveBeenCalledTimes(1);

        finishFirst(DATA);
        await first;
        expect(scanPhylaxAccount).toHaveBeenCalledTimes(2);
        expect(loadedTypes(actions)).toHaveLength(2);
    });

    it('after a send, scans right away and again after the delay', async () => {
        jest.useFakeTimers({ legacyFakeTimers: false });
        jest.mocked(scanPhylaxAccount).mockResolvedValue(DATA);
        const { actions, dispatch } = setUp();

        const done = dispatch(refreshPhylaxAccountAndRecheckThunk({ slot: 0, network: 'mainnet' }));
        await jest.advanceTimersByTimeAsync(0);
        expect(scanPhylaxAccount).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(RECHECK_DELAY_MS);
        await done;
        expect(scanPhylaxAccount).toHaveBeenCalledTimes(2);
        expect(loadedTypes(actions)).toHaveLength(2);
    });

    it('reports a failed scan', async () => {
        jest.mocked(scanPhylaxAccount).mockRejectedValue(new Error('Websocket closed'));
        const { actions, dispatch } = setUp();

        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'testnet' }));

        expect(actions).toContainEqual(
            phylaxActions.accountFailed({
                key: getPhylaxAccountKey(SUMMARY, 'testnet'),
                error: 'Websocket closed',
            }),
        );
    });
});

describe('PHYLAX backend subscription', () => {
    const subscribeState = (connected: boolean, withData: boolean) => ({
        phylax: {
            ...state.phylax,
            accounts: withData
                ? { [KEY]: { data: serializePhylaxAccountData(DATA), isRefreshing: false } }
                : {},
        },
        wallet: { blockchain: { btc: { connected } } },
    });

    beforeEach(() => {
        jest.spyOn(TrezorConnect, 'blockchainSubscribe').mockResolvedValue({
            success: true,
            payload: { subscribed: true },
        });
        jest.spyOn(TrezorConnect, 'blockchainUnsubscribe').mockResolvedValue({
            success: true,
            payload: { subscribed: false },
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it('subscribes the scanned addresses, nothing before the first scan', async () => {
        let current = subscribeState(true, false);
        const { dispatch } = createMockDispatch({ getState: () => current as never, extra: {} });

        await dispatch(subscribePhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        expect(TrezorConnect.blockchainSubscribe).not.toHaveBeenCalled();

        current = subscribeState(true, true);
        await dispatch(subscribePhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        const [params] = jest.mocked(TrezorConnect.blockchainSubscribe).mock.calls[0]!;
        expect(params).toMatchObject({ coin: 'btc', blocks: false });
        expect(params.accounts?.[0]?.descriptor).toBe(`phylax:${KEY}`);
        expect(params.accounts?.[0]?.addresses?.used.map(a => a.address)).toEqual(['bc1q']);
    });

    it('unsubscribes only from a connected backend (it would connect it again)', async () => {
        let current = subscribeState(false, true);
        const { dispatch } = createMockDispatch({ getState: () => current as never, extra: {} });

        await dispatch(unsubscribePhylaxAccountThunk({ key: KEY, network: 'mainnet' }));
        expect(TrezorConnect.blockchainUnsubscribe).not.toHaveBeenCalled();

        current = subscribeState(true, true);
        await dispatch(unsubscribePhylaxAccountThunk({ key: KEY, network: 'mainnet' }));
        expect(TrezorConnect.blockchainUnsubscribe).toHaveBeenCalledWith({
            coin: 'btc',
            blocks: false,
            accounts: [{ descriptor: `phylax:${KEY}` }],
        });
    });
});

describe('PHYLAX API scans', () => {
    const API = 'http://127.0.0.1:8095';
    let fetchMock: jest.Mock;

    // a store whose PHYLAX state follows the dispatched actions
    const setUpWithApi = () => {
        const base: typeof state = {
            ...state,
            suiteSettings: {
                ...state.suiteSettings,
                debug: { ...state.suiteSettings.debug, phylaxApiUrl: API },
            },
        };
        let { phylax } = base;
        const getState = (): typeof state => ({ ...base, phylax });
        const { actions, dispatch } = createMockDispatch({ getState, extra: {} });
        const sync = () => {
            phylax = actions.reduce<PhylaxState>(
                (current, action) => phylaxReducer(current, action as never),
                base.phylax,
            );
        };

        return { actions, dispatch, sync, getState };
    };

    const apiStatus = (actions: unknown[]) =>
        actions
            .filter(action => phylaxActions.apiStatusChanged.match(action as never))
            .map(action => (action as ReturnType<typeof phylaxActions.apiStatusChanged>).payload);

    beforeEach(() => {
        jest.mocked(scanPhylaxAccount).mockReset().mockResolvedValue(DATA);
        fetchMock = jest.fn();
        global.fetch = fetchMock as never;
    });

    it('scans through the API when it answers', async () => {
        // every asked address unused
        fetchMock.mockImplementation((_url: string, init: { body: string }) => {
            const { addresses } = JSON.parse(init.body) as { addresses: string[] };

            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        network: 'mainnet',
                        tipHeight: 1,
                        transactions: {},
                        addresses: addresses.map(address => ({
                            address,
                            txCount: 0,
                            unconfirmedTxCount: 0,
                            utxos: [],
                            txids: [],
                        })),
                    }),
            });
        });
        const { actions, dispatch } = setUpWithApi();
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));

        // one request: twice GAP_LIMIT addresses on each chain
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API}/v1/scan`);
        expect(JSON.parse(init.body).addresses).toHaveLength(80);
        // the scan got the API lookup
        expect(jest.mocked(scanPhylaxAccount).mock.calls[0]?.[3]).toBeDefined();
        expect(apiStatus(actions)).toEqual([
            { network: 'mainnet', status: { status: 'ok', url: API } },
        ]);
    });

    it("falls back to the coin's backend, and tries the API again only after a while", async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
        const { actions, dispatch, sync } = setUpWithApi();
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));

        // the backend scan (no lookup given), and the data is kept
        expect(jest.mocked(scanPhylaxAccount)).toHaveBeenCalledTimes(1);
        expect(jest.mocked(scanPhylaxAccount).mock.calls[0]?.[3]).toBeUndefined();
        expect(loadedTypes(actions)).toHaveLength(1);
        const [fallback] = apiStatus(actions);
        expect(fallback?.status).toMatchObject({
            status: 'fallback',
            url: API,
            error: 'Failed to fetch',
        });

        // within the pause: no request to the API
        sync();
        fetchMock.mockClear();
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        expect(fetchMock).not.toHaveBeenCalled();

        // after it: tried again
        const now = Date.now();
        const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60_000);
        sync();
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'mainnet' }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('uses no API for testnet unless set in Settings', async () => {
        const { dispatch } = setUp();
        await dispatch(refreshPhylaxAccountThunk({ slot: 0, network: 'testnet' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(jest.mocked(scanPhylaxAccount).mock.calls[0]?.[3]).toBeUndefined();
    });
});
