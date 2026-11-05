// PHYLAX Blocks (fork): name, policy and readiness of the wallet, with Receive and Send.

import { Badge, Button, H2, Row } from '@trezor/components';
import type { PROTO } from '@trezor/connect';
import { ArrowDownIcon, ArrowUpIcon } from '@trezor/icons';

import type { PhylaxAccountTab } from './PhylaxAccount';
import { type PhylaxReadiness, getLockedBlockName } from '../phylaxReadiness';
import { type PhylaxNetwork, getFingerprintHex } from '../phylaxWallet';
import type { PhylaxAccount } from '../usePhylaxAccount';

type PhylaxAccountHeaderProps = {
    summary: PROTO.PhylaxWalletSummary;
    network: PhylaxNetwork;
    readiness: PhylaxReadiness;
    account: PhylaxAccount;
    onTabChange: (tab: PhylaxAccountTab) => void;
};

export const PhylaxAccountHeader = ({
    summary,
    network,
    readiness,
    account,
    onTabChange,
}: PhylaxAccountHeaderProps) => (
    <Row gap={12} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Row gap={8} alignItems="center" flexWrap="wrap">
            <H2>{summary.name}</H2>
            <Badge intent="neutral">
                {summary.threshold}-of-{summary.fingerprints.length} multisig
            </Badge>
            <Badge intent="neutral">{network === 'mainnet' ? 'Bitcoin' : 'Bitcoin Testnet'}</Badge>
            {readiness.isReady && <Badge intent="brand">Ready to sign</Badge>}
            {readiness.isAttachNeeded && (
                <Badge intent="warning">
                    Attach key block{' '}
                    {readiness.missingFingerprints.map(getFingerprintHex).join(', ')}
                </Badge>
            )}
            {readiness.lockedInWallet.length > 0 && (
                <Badge intent="warning">
                    Key block {readiness.lockedInWallet.map(getLockedBlockName).join(', ')} locked
                </Badge>
            )}
        </Row>
        <Row gap={8}>
            <Button
                priority="secondary"
                iconLeft={ArrowDownIcon}
                onClick={() => onTabChange('receive')}
                data-testid="@phylax/account/receive"
            >
                Receive
            </Button>
            <Button
                iconLeft={ArrowUpIcon}
                onClick={() => onTabChange('send')}
                isDisabled={account.status !== 'loaded'}
                data-testid="@phylax/account/send"
            >
                Send
            </Button>
        </Row>
    </Row>
);
