// PHYLAX Blocks (fork): one transaction of the wallet: direction, time or pending, confirmations,
// net amount (fee included) and its txid.

import { useState } from 'react';

import { Button, Column, Icon, Row, Text } from '@trezor/components';
import { copyToClipboard } from '@trezor/dom-utils';
import { ArrowDownLeftIcon, ArrowUpRightIcon, ArrowsLeftRightIcon, CopyIcon } from '@trezor/icons';

import type { PhylaxTransaction, PhylaxTransactionType } from '../phylaxAccountScan';
import { formatBtc } from '../phylaxSend';
import { type PhylaxNetwork, getPhylaxUnit } from '../phylaxWallet';

const LABELS: Record<PhylaxTransactionType, string> = {
    received: 'Received',
    sent: 'Sent',
    self: 'Sent to itself',
};

const ICONS = {
    received: ArrowDownLeftIcon,
    sent: ArrowUpRightIcon,
    self: ArrowsLeftRightIcon,
} as const;

const formatSigned = (satoshis: bigint) =>
    satoshis < 0n ? `−${formatBtc(-satoshis)}` : `+${formatBtc(satoshis)}`;

/** "Pending", or the confirmations once the backend's block height is known. */
const getConfirmationText = (blockHeight: number | undefined, tipHeight: number | null) => {
    if (blockHeight === undefined) return 'Pending';
    if (tipHeight === null || tipHeight < blockHeight) return 'Confirmed';
    const confirmations = tipHeight - blockHeight + 1;

    return `${confirmations} confirmation${confirmations === 1 ? '' : 's'}`;
};

type PhylaxTransactionRowProps = {
    transaction: PhylaxTransaction;
    network: PhylaxNetwork;
    tipHeight: number | null;
};

export const PhylaxTransactionRow = ({
    transaction,
    network,
    tipHeight,
}: PhylaxTransactionRowProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const { txid, type, net, fee, blockHeight, blockTime } = transaction;
    const unit = getPhylaxUnit(network);
    const isPending = blockHeight === undefined;

    const handleCopy = async () => {
        await copyToClipboard(txid);
        setIsCopied(true);
    };

    return (
        <Row gap={12} alignItems="center" data-testid={`@phylax/transaction/${txid}`}>
            <Icon as={ICONS[type]} size={24} intent={isPending ? 'warning' : 'neutral'} />
            <Column gap={2} alignItems="flex-start" flex="1">
                <Text typographyStyle="body-md-strong">{LABELS[type]}</Text>
                <Text typographyStyle="body-sm" priority="secondary">
                    {blockTime !== undefined && `${new Date(blockTime * 1000).toLocaleString()} · `}
                    <Text as="span" intent={isPending ? 'warning' : undefined}>
                        {getConfirmationText(blockHeight, tipHeight)}
                    </Text>
                </Text>
                <Row gap={4} alignItems="center">
                    <Text isMonospaced typographyStyle="body-xs" priority="secondary">
                        {txid.slice(0, 12)}…{txid.slice(-8)}
                    </Text>
                    <Button
                        size="small"
                        priority="secondary"
                        iconLeft={CopyIcon}
                        onClick={handleCopy}
                        data-testid="@phylax/transaction/copy-txid"
                    >
                        {isCopied ? 'Copied' : 'Copy txid'}
                    </Button>
                </Row>
            </Column>
            <Column gap={2} alignItems="flex-end">
                <Text
                    typographyStyle="body-md-strong"
                    isTabular
                    intent={net > 0n ? 'success' : undefined}
                >
                    {formatSigned(net)} {unit}
                </Text>
                {fee > 0n && (
                    <Text typographyStyle="body-xs" priority="secondary" isTabular>
                        fee {formatBtc(fee)} {unit}
                    </Text>
                )}
            </Column>
        </Row>
    );
};
