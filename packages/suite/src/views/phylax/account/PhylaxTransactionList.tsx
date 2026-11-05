// PHYLAX Blocks (fork): the wallet's transactions, newest first, pending ones on top.

import { selectBlockchainHeightBySymbol } from '@suite-common/wallet-core';
import { Card, Column, Divider, H3, Text } from '@trezor/components';

import { useSelector } from 'src/hooks/suite';

import { PhylaxTransactionRow } from './PhylaxTransactionRow';
import { type PhylaxTransaction, TRANSACTIONS_PER_ADDRESS } from '../phylaxAccountScan';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork } from '../phylaxWallet';

type PhylaxTransactionListProps = {
    transactions: PhylaxTransaction[];
    network: PhylaxNetwork;
};

export const PhylaxTransactionList = ({ transactions, network }: PhylaxTransactionListProps) => {
    const tipHeight = useSelector(state =>
        selectBlockchainHeightBySymbol(state, PHYLAX_COIN_SYMBOLS[network]),
    );

    return (
        <Card data-testid="@phylax/account/transactions">
            <Column gap={8} alignItems="stretch">
                <H3>Transactions</H3>
                {transactions.length === 0 && (
                    <Text priority="secondary">
                        No transactions yet. Receive bitcoin to this wallet to get started.
                    </Text>
                )}
                {transactions.map((transaction, index) => (
                    <Column key={transaction.txid} gap={8} alignItems="stretch">
                        {index > 0 && <Divider margin={{ top: 0, bottom: 0 }} />}
                        <PhylaxTransactionRow
                            transaction={transaction}
                            network={network}
                            tipHeight={tipHeight}
                        />
                    </Column>
                ))}
                <Text typographyStyle="body-xs" priority="secondary">
                    Shows the latest {TRANSACTIONS_PER_ADDRESS} transactions of each address.
                </Text>
            </Column>
        </Card>
    );
};
