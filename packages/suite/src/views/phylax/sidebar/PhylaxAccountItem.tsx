// PHYLAX Blocks (fork): one multisig wallet in the sidebar: coin, name, m-of-n and balance.

import styled, { css } from 'styled-components';

import { Badge, Column, Row, Text } from '@trezor/components';
import { commonFocusStyles } from '@trezor/components/src/utils/utils';
import { TokenIcon } from '@trezor/product-components';

import { useResponsiveContext } from 'src/support/suite/ResponsiveContext';

import { formatBtc } from '../phylaxSend';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork, getPhylaxUnit } from '../phylaxWallet';
import { useOpenPhylaxAccount } from '../useOpenPhylaxAccount';
import { usePhylaxAccount } from '../usePhylaxAccount';
import type { PhylaxWalletEntry } from '../usePhylaxStack';

// the look of Suite's own account rows (AccountRow)
const Container = styled.button<{ $isActive: boolean }>`
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px;
    border-radius: 12px;
    border: 0;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s ease-in-out;
    -webkit-app-region: no-drag;

    &:focus-visible {
        ${commonFocusStyles}
    }

    &:hover {
        background: ${({ theme }) => theme.elementFillGhostHovered};
    }

    ${({ $isActive, theme }) =>
        $isActive &&
        css`
            background: ${theme.elementFillElevated} !important;
            box-shadow: ${theme.elementShadowElevated};
        `}
`;

type PhylaxAccountItemProps = {
    entry: PhylaxWalletEntry;
    network: PhylaxNetwork;
    isSelected: boolean;
};

export const PhylaxAccountItem = ({ entry, network, isSelected }: PhylaxAccountItemProps) => {
    const { summary, details } = entry;
    const account = usePhylaxAccount(summary, details !== undefined, network);
    const openAccount = useOpenPhylaxAccount();
    const { isSidebarCollapsed } = useResponsiveContext();

    let balance = '…';
    if (account.status === 'loaded') {
        balance = `${formatBtc(account.data.balance)} ${getPhylaxUnit(network)}`;
    } else if (account.status === 'error') {
        balance = 'Offline';
    }

    return (
        <Container
            type="button"
            $isActive={isSelected}
            onClick={() => openAccount(summary.slot, network)}
            data-testid={`@phylax/sidebar/${network}/${summary.slot}`}
        >
            <Row gap={16} width="100%">
                <TokenIcon size={24} symbol={PHYLAX_COIN_SYMBOLS[network]} />
                {!isSidebarCollapsed && (
                    <Column flex="1" gap={2} alignItems="flex-start" overflow="hidden">
                        <Row gap={8} alignItems="center" width="100%">
                            <Text typographyStyle="body-sm" ellipsisLineCount={1}>
                                {summary.name}
                            </Text>
                            <Badge size="tiny" intent="neutral">
                                {summary.threshold}-of-{summary.fingerprints.length}
                            </Badge>
                        </Row>
                        <Text typographyStyle="body-xs" priority="secondary" isTabular>
                            {balance}
                        </Text>
                    </Column>
                )}
            </Row>
        </Container>
    );
};
