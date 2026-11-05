// PHYLAX Snap (fork): the wallet's used receive addresses, like Suite's address history. A new
// payment should go to the fresh address shown above; these are for looking up.

import { useState } from 'react';

import { Address } from '@suite/address';
import { Button, Column, Row, Text } from '@trezor/components';

import type { PhylaxUsedAddress } from './phylaxAccountScan';
import { formatBtc } from './phylaxSend';

type PhylaxAddressHistoryProps = {
    addresses: PhylaxUsedAddress[];
    unit: string;
};

export const PhylaxAddressHistory = ({ addresses, unit }: PhylaxAddressHistoryProps) => {
    const [isOpen, setIsOpen] = useState(false);
    if (addresses.length === 0) return null;

    return (
        <Column gap={8} alignItems="stretch" data-testid="@phylax/address-history">
            <Row>
                <Button
                    size="small"
                    priority="secondary"
                    onClick={() => setIsOpen(value => !value)}
                    data-testid="@phylax/address-history-toggle"
                >
                    {isOpen ? 'Hide' : 'Show'} used addresses ({addresses.length})
                </Button>
            </Row>
            {isOpen &&
                addresses.map(used => (
                    <Row
                        key={used.index}
                        gap={12}
                        alignItems="center"
                        justifyContent="space-between"
                        flexWrap="wrap"
                    >
                        <Row gap={12} alignItems="center" minWidth={0}>
                            <Text typographyStyle="body-sm" priority="secondary">
                                #{used.index}
                            </Text>
                            <Address value={used.address} isChunked typographyStyle="body-sm" />
                        </Row>
                        <Text typographyStyle="body-sm" priority="secondary" isTabular>
                            {used.transactions}{' '}
                            {used.transactions === 1 ? 'transaction' : 'transactions'} · balance{' '}
                            {formatBtc(used.balance)} {unit}
                        </Text>
                    </Row>
                ))}
        </Column>
    );
};
