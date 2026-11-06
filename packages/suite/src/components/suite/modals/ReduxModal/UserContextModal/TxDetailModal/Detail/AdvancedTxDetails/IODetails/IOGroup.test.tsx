import '@suite-common/test-utils/globalOverrides';

import { screen } from '@testing-library/react';

import { PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED } from '@suite/external-links';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import { asNetworkSymbol, getNetwork } from '@suite-common/wallet-config';
import { getExplorerUrl } from '@suite-common/wallet-config/src/getExplorerUrls';
import { explorerInitialState } from '@suite-common/wallet-core';
import { type WalletAccountTransaction, asAccountDescriptor } from '@suite-common/wallet-types';
import { mockWalletAccount } from '@suite-common/wallet-types/mocks';

import { type AppState } from 'src/reducers/store';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';

import { type IODetailsType } from './IODetailsType';
import { IOGroup } from './IOGroup';
import { mockInitialAppState } from '../../../../../../../../../../mocks/mockInitialAppState';

const bitcoinAccount = mockWalletAccount({
    symbol: asNetworkSymbol('btc'),
    descriptor: asAccountDescriptor('btcDescriptor'),
});
const ethereumAccount = mockWalletAccount({
    symbol: asNetworkSymbol('eth'),
    descriptor: asAccountDescriptor('ethDescriptor'),
});

const bitcoinTransaction = {
    symbol: bitcoinAccount.symbol,
    descriptor: bitcoinAccount.descriptor,
    deviceState: bitcoinAccount.deviceState,
    txid: 'bitcoin-txid',
} as WalletAccountTransaction;

const inputAddress = 'bc1qtestinputaddress';
const inputs: IODetailsType[] = [{ addresses: [inputAddress] } as IODetailsType];

const getInitialState = (): AppState => ({
    ...mockInitialAppState,
    wallet: {
        ...mockInitialAppState.wallet,
        accounts: [bitcoinAccount, ethereumAccount],
        explorer: explorerInitialState,
        selectedAccount: {
            status: 'loaded',
            account: ethereumAccount,
            network: getNetwork(ethereumAccount.symbol),
            params: undefined,
        },
    },
});

// PHYLAX Blocks (fork): explorer links only when external links are allowed.
const describeWithLinks = PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED ? describe : describe.skip;
const describeWithoutLinks = PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED ? describe.skip : describe;

describeWithoutLinks('IOGroup without external links', () => {
    it('shows the address without an explorer link (PHYLAX)', () => {
        const { services } = createTestCompositionRoot<void, AppState>({
            preloadedState: getInitialState(),
        });

        renderWithProviders(
            services,
            <IOGroup tx={bitcoinTransaction} inputs={inputs} outputs={[]} />,
        );

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByTestId('@tx-detail/txid-value')).toBeInTheDocument();
    });
});

describeWithLinks('IOGroup', () => {
    it('opens an address in the explorer of the transaction network, not of the selected account', () => {
        const { services } = createTestCompositionRoot<void, AppState>({
            preloadedState: getInitialState(),
        });

        renderWithProviders(
            services,
            <IOGroup tx={bitcoinTransaction} inputs={inputs} outputs={[]} />,
        );

        const bitcoinAddressUrl = getExplorerUrl(explorerInitialState.btc.default, 'address');
        const ethereumAddressUrl = getExplorerUrl(explorerInitialState.eth.default, 'address');

        expect(bitcoinAddressUrl).not.toBe(ethereumAddressUrl);
        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            `${bitcoinAddressUrl}${inputAddress}`,
        );
    });
});
