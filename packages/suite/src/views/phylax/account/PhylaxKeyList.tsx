// PHYLAX Blocks (fork): the wallet's keys: one per block, with its fingerprint and account xpub.

import { Badge, Card, Column, Divider, H3, Row, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { type PhylaxNetwork, getFingerprintHex, getPhylaxKeyXpub } from '../phylaxWallet';

type PhylaxKeyListProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    mainFingerprint: number | undefined;
};

export const PhylaxKeyList = ({ wallet, network, mainFingerprint }: PhylaxKeyListProps) => (
    <Card data-testid="@phylax/account/keys">
        <Column gap={8} alignItems="stretch">
            <H3>Keys</H3>
            <Text typographyStyle="body-sm" priority="secondary">
                {wallet.threshold} of these {wallet.keys.length} blocks sign every transaction.
            </Text>
            {wallet.keys.map((key, index) => {
                const { origin, xpub } = getPhylaxKeyXpub(key, network);

                return (
                    <Column key={key.fingerprint} gap={4} alignItems="stretch">
                        {index > 0 && <Divider margin={{ top: 4, bottom: 4 }} />}
                        <Row gap={8} alignItems="center">
                            <Text typographyStyle="body-md-strong" isMonospaced>
                                {getFingerprintHex(key.fingerprint)}
                            </Text>
                            <Badge intent="neutral">
                                {key.fingerprint === mainFingerprint ? 'Main block' : 'Key block'}
                            </Badge>
                        </Row>
                        <Text typographyStyle="body-xs" priority="secondary" isMonospaced>
                            m/{origin.split('/').slice(1).join('/')}
                        </Text>
                        <Text typographyStyle="body-xs" isMonospaced>
                            <span style={{ wordBreak: 'break-all' }}>{xpub}</span>
                        </Text>
                    </Column>
                );
            })}
        </Column>
    </Card>
);
