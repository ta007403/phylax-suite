// PHYLAX Blocks (fork): the account's balance and its transactions.

import { Button, Card, Column, Row, Text } from '@trezor/components';
import { ArrowsClockwiseIcon } from '@trezor/icons';

import { PhylaxTransactionList } from './PhylaxTransactionList';
import { formatBtc } from '../phylaxSend';
import { type PhylaxNetwork, getPhylaxUnit } from '../phylaxWallet';
import type { PhylaxAccount } from '../usePhylaxAccount';

type PhylaxOverviewProps = {
    account: PhylaxAccount;
    network: PhylaxNetwork;
};

export const PhylaxOverview = ({ account, network }: PhylaxOverviewProps) => {
    const unit = getPhylaxUnit(network);

    if (account.status === 'loading') {
        return <Text>Checking the blockchain…</Text>;
    }
    if (account.status === 'error') {
        return (
            <Row gap={12} alignItems="center">
                <Text intent="critical">{account.error}</Text>
                <Button size="small" priority="secondary" onClick={account.refresh}>
                    Try again
                </Button>
            </Row>
        );
    }

    const { data } = account;
    const pendingCount = data.transactions.filter(tx => tx.blockHeight === undefined).length;

    return (
        <Column gap={16} alignItems="stretch">
            <Card>
                <Row gap={12} alignItems="flex-end" justifyContent="space-between" flexWrap="wrap">
                    <Column gap={4} alignItems="flex-start">
                        <Text typographyStyle="body-sm" priority="secondary">
                            Balance
                        </Text>
                        <Text
                            typographyStyle="headline-md"
                            isTabular
                            data-testid="@phylax/account/balance"
                        >
                            {formatBtc(data.balance)} {unit}
                        </Text>
                        <Text typographyStyle="body-sm" priority="secondary">
                            {data.utxos.length} coins on {data.usedAddressCount} used addresses
                            {pendingCount > 0 && `, ${pendingCount} pending`}
                        </Text>
                    </Column>
                    <Column gap={4} alignItems="flex-end">
                        <Button
                            size="small"
                            priority="secondary"
                            iconLeft={ArrowsClockwiseIcon}
                            onClick={account.refresh}
                            isLoading={account.isRefreshing}
                            data-testid="@phylax/account/refresh"
                        >
                            Refresh
                        </Button>
                        {account.updatedAt !== undefined && (
                            <Text typographyStyle="body-xs" priority="secondary">
                                Updated {new Date(account.updatedAt).toLocaleTimeString()}
                            </Text>
                        )}
                        {account.error && (
                            <Text typographyStyle="body-xs" intent="critical">
                                Last refresh failed: {account.error}
                            </Text>
                        )}
                    </Column>
                </Row>
            </Card>
            <PhylaxTransactionList transactions={data.transactions} network={network} />
        </Column>
    );
};
