// PHYLAX Blocks (fork): one saved wallet on the PHYLAX Snap page: name, policy, readiness, balance,
// and the way to its account page.

import { Badge, Button, Card, Row, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { getLockedBlockName, getPhylaxReadiness } from './phylaxReadiness';
import { type PhylaxNetwork, getFingerprintHex } from './phylaxWallet';
import { useOpenPhylaxAccount } from './useOpenPhylaxAccount';
import { usePhylaxAccount } from './usePhylaxAccount';
import { usePhylaxAmountFormat } from './usePhylaxAmountFormat';
import type { PhylaxWalletEntry } from './usePhylaxStack';

type PhylaxWalletRowProps = {
    entry: PhylaxWalletEntry;
    network: PhylaxNetwork;
    blocks: PROTO.PhylaxBlockInfo[];
};

export const PhylaxWalletRow = ({ entry, network, blocks }: PhylaxWalletRowProps) => {
    const { summary, details } = entry;
    const account = usePhylaxAccount(summary, details !== undefined, network);
    const openAccount = useOpenPhylaxAccount();
    const amountFormat = usePhylaxAmountFormat(network);
    const readiness = getPhylaxReadiness(summary.fingerprints, blocks);

    return (
        <Card data-testid={`@phylax/wallet/${summary.slot}`}>
            <Row gap={12} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                <Row gap={8} alignItems="center" flexWrap="wrap">
                    <Text typographyStyle="body-md-strong">{summary.name}</Text>
                    <Badge intent="neutral">
                        {summary.threshold}-of-{summary.fingerprints.length}
                    </Badge>
                    {readiness.isReady && <Badge intent="brand">Ready</Badge>}
                    {readiness.isAttachNeeded && (
                        <Badge intent="warning">
                            Attach key block{' '}
                            {readiness.missingFingerprints.map(getFingerprintHex).join(', ')}
                        </Badge>
                    )}
                    {readiness.lockedInWallet.length > 0 && (
                        <Badge intent="warning">
                            Key block {readiness.lockedInWallet.map(getLockedBlockName).join(', ')}{' '}
                            locked
                        </Badge>
                    )}
                </Row>
                <Row gap={12} alignItems="center">
                    <Text isTabular priority="secondary">
                        {account.status === 'loaded'
                            ? amountFormat.format(account.data.balance)
                            : '…'}
                    </Text>
                    <Button
                        size="small"
                        onClick={() => openAccount(summary.slot, network)}
                        data-testid={`@phylax/wallet/${summary.slot}/open`}
                    >
                        Open account
                    </Button>
                </Row>
            </Row>
        </Card>
    );
};
