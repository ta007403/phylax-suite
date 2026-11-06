import { createMockDispatch } from '@trezor/redux-utils/mocks';

import {
    type PhylaxRootState,
    deserializePhylaxAccountData,
    getPhylaxAccountKey,
    phylaxActions,
    phylaxInitialState,
    phylaxReducer,
    serializePhylaxAccountData,
} from './phylaxReducer';
import {
    SEND_RECHECK_DELAY_MS,
    refreshPhylaxAccountAfterSendThunk,
    refreshPhylaxAccountThunk,
} from './phylaxThunks';
import { type PhylaxAccountData, scanPhylaxAccount } from '../phylaxAccountScan';
import { WALLET } from '../phylaxWallet.fixture';

jest.mock('../phylaxAccountScan', () => ({ scanPhylaxAccount: jest.fn() }));

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

const state: PhylaxRootState = {
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

    it('drops a stack read from a device that is no longer selected', () => {
        const phylax = phylaxReducer(
            state.phylax,
            phylaxActions.stackLoaded({
                devicePath: 'old',
                blocks: [],
                wallets: [],
                isStoragePresent: true,
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

        const done = dispatch(refreshPhylaxAccountAfterSendThunk({ slot: 0, network: 'mainnet' }));
        await jest.advanceTimersByTimeAsync(0);
        expect(scanPhylaxAccount).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(SEND_RECHECK_DELAY_MS);
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
