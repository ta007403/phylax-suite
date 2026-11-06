// PHYLAX Blocks (fork): the connected main block's stack and saved wallets, and the account data of
// each wallet, shared by the sidebar, the PHYLAX Snap page and the account pages. In memory only.

import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { PROTO } from '@trezor/connect';

import type {
    PhylaxAccountData,
    PhylaxPendingDetails,
    PhylaxTransaction,
    PhylaxTxInput,
    PhylaxTxOutput,
} from '../phylaxAccountScan';
import type { PhylaxNetwork } from '../phylaxWallet';

export type PhylaxWalletEntry = {
    summary: PROTO.PhylaxWalletSummary;
    // With the xpubs; fetched once per wallet version (slot, name, fingerprints).
    details?: PROTO.PhylaxWallet;
};

/** Account data as kept in the store: amounts as decimal strings of satoshis (no bigint). */
export type StoredPhylaxAccountData = {
    balance: string;
    usedAddressCount: number;
    nextReceiveIndex: number;
    nextChangeIndex: number;
    usedAddresses: string[];
    utxos: (Omit<PhylaxAccountData['utxos'][number], 'value'> & { value: string })[];
    usedReceiveAddresses: (Omit<PhylaxAccountData['usedReceiveAddresses'][number], 'balance'> & {
        balance: string;
    })[];
    transactions: (Omit<PhylaxTransaction, 'net' | 'fee' | 'pending'> & {
        net: string;
        fee: string;
        pending?: Omit<PhylaxPendingDetails, 'inputs' | 'outputs'> & {
            inputs: (Omit<PhylaxTxInput, 'value'> & { value: string })[];
            outputs: (Omit<PhylaxTxOutput, 'value'> & { value: string })[];
        };
    })[];
};

export type PhylaxAccountState = {
    // the last scan's data, kept while the next scan runs
    data?: StoredPhylaxAccountData;
    error?: string;
    isRefreshing: boolean;
    // unix ms of the last finished scan
    updatedAt?: number;
};

export type PhylaxSelectedAccount = { slot: number; network: PhylaxNetwork };

export type PhylaxState = {
    // the device the stack was read from; everything below belongs to it
    devicePath?: string;
    blocks: PROTO.PhylaxBlockInfo[];
    wallets: PhylaxWalletEntry[];
    // Every block's copy of the saved wallets has been read by the main block.
    isStoragePresent: boolean;
    isLoaded: boolean;
    error?: string;
    // a call waits for the user on the main block: no stack refresh meanwhile
    isPaused: boolean;
    selectedAccount?: PhylaxSelectedAccount;
    // by getPhylaxAccountKey
    accounts: Record<string, PhylaxAccountState>;
};

export type PhylaxRootState = { phylax: PhylaxState };

export const phylaxInitialState: PhylaxState = {
    blocks: [],
    wallets: [],
    isStoragePresent: false,
    isLoaded: false,
    isPaused: false,
    accounts: {},
};

/** One account per wallet version and network: a wallet saved again in the same slot is new. */
export const getPhylaxAccountKey = (summary: PROTO.PhylaxWalletSummary, network: PhylaxNetwork) =>
    `${network}:${summary.slot}:${summary.threshold}:${summary.fingerprints.join(',')}`;

export const serializePhylaxAccountData = (data: PhylaxAccountData): StoredPhylaxAccountData => ({
    ...data,
    balance: data.balance.toString(),
    utxos: data.utxos.map(utxo => ({ ...utxo, value: utxo.value.toString() })),
    usedReceiveAddresses: data.usedReceiveAddresses.map(address => ({
        ...address,
        balance: address.balance.toString(),
    })),
    transactions: data.transactions.map(tx => ({
        ...tx,
        net: tx.net.toString(),
        fee: tx.fee.toString(),
        pending: tx.pending && {
            ...tx.pending,
            inputs: tx.pending.inputs.map(input => ({ ...input, value: input.value.toString() })),
            outputs: tx.pending.outputs.map(output => ({
                ...output,
                value: output.value.toString(),
            })),
        },
    })),
});

export const deserializePhylaxAccountData = (data: StoredPhylaxAccountData): PhylaxAccountData => ({
    ...data,
    balance: BigInt(data.balance),
    utxos: data.utxos.map(utxo => ({ ...utxo, value: BigInt(utxo.value) })),
    usedReceiveAddresses: data.usedReceiveAddresses.map(address => ({
        ...address,
        balance: BigInt(address.balance),
    })),
    transactions: data.transactions.map(tx => ({
        ...tx,
        net: BigInt(tx.net),
        fee: BigInt(tx.fee),
        pending: tx.pending && {
            ...tx.pending,
            inputs: tx.pending.inputs.map(input => ({ ...input, value: BigInt(input.value) })),
            outputs: tx.pending.outputs.map(output => ({
                ...output,
                value: BigInt(output.value),
            })),
        },
    })),
});

type StackLoadedPayload = {
    devicePath: string;
    blocks: PROTO.PhylaxBlockInfo[];
    wallets: PhylaxWalletEntry[];
    isStoragePresent: boolean;
};

const phylaxSlice = createSlice({
    name: 'phylax',
    initialState: phylaxInitialState,
    reducers: {
        // Another device selected (or none): forget everything read from the previous one, so
        // nothing it showed can be used with the new device.
        deviceChanged(state: PhylaxState, action: PayloadAction<string | undefined>) {
            if (state.devicePath === action.payload) return;

            return { ...phylaxInitialState, devicePath: action.payload };
        },
        stackLoaded(state: PhylaxState, action: PayloadAction<StackLoadedPayload>) {
            if (state.devicePath !== action.payload.devicePath) return;
            state.blocks = action.payload.blocks;
            state.wallets = action.payload.wallets;
            state.isStoragePresent = action.payload.isStoragePresent;
            state.isLoaded = true;
            delete state.error;
        },
        stackFailed(
            state: PhylaxState,
            action: PayloadAction<{ devicePath: string; error: string }>,
        ) {
            if (state.devicePath !== action.payload.devicePath) return;
            state.error = action.payload.error;
            state.isLoaded = true;
        },
        setPaused(state: PhylaxState, action: PayloadAction<boolean>) {
            state.isPaused = action.payload;
        },
        selectAccount(state: PhylaxState, action: PayloadAction<PhylaxSelectedAccount>) {
            state.selectedAccount = action.payload;
        },
        accountRefreshStarted(state: PhylaxState, action: PayloadAction<{ key: string }>) {
            const account = state.accounts[action.payload.key];
            if (account) {
                account.isRefreshing = true;
            } else {
                state.accounts[action.payload.key] = { isRefreshing: true };
            }
        },
        accountLoaded(
            state: PhylaxState,
            action: PayloadAction<{ key: string; data: StoredPhylaxAccountData; time: number }>,
        ) {
            state.accounts[action.payload.key] = {
                data: action.payload.data,
                isRefreshing: false,
                updatedAt: action.payload.time,
            };
        },
        accountFailed(state: PhylaxState, action: PayloadAction<{ key: string; error: string }>) {
            const account = state.accounts[action.payload.key];
            state.accounts[action.payload.key] = {
                ...account,
                isRefreshing: false,
                error: action.payload.error,
            };
        },
    },
});

export const phylaxActions = phylaxSlice.actions;
export const phylaxReducer = phylaxSlice.reducer;

export const selectPhylaxStack = (state: PhylaxRootState) => state.phylax;
export const selectPhylaxDevicePath = (state: PhylaxRootState) => state.phylax.devicePath;
export const selectPhylaxWallets = (state: PhylaxRootState) => state.phylax.wallets;
export const selectPhylaxIsPaused = (state: PhylaxRootState) => state.phylax.isPaused;
export const selectPhylaxIsLoaded = (state: PhylaxRootState) => state.phylax.isLoaded;
export const selectPhylaxSelectedAccount = (state: PhylaxRootState) => state.phylax.selectedAccount;
export const selectPhylaxAccountByKey = (state: PhylaxRootState, key: string) =>
    state.phylax.accounts[key];
