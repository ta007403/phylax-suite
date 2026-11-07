// PHYLAX Blocks (fork): the block combinations the main block does not offer as a wallet. The user
// answered "Never" on the main block's "New ... wallet?" (or deleted their wallet); "Ask again"
// makes the main block offer the combination again the next time those blocks are all attached.

import { useState } from 'react';

import { Button, Card, Column, H3, Row, Text } from '@trezor/components';
import TrezorConnect, { type PROTO } from '@trezor/connect';

import { PHYLAX_MAIN_BLOCK_ADDRESS } from './phylaxIdentity';
import { getFingerprintHex } from './phylaxWallet';
import type { RunOnDevice } from './usePhylaxStack';

/** "Main block 1a2b3c4d" for the main block's fingerprint, else just the fingerprint. */
export const getIgnoredBlockLabel = (fingerprint: number, blocks: PROTO.PhylaxBlockInfo[]) => {
    const hex = getFingerprintHex(fingerprint);
    const isMain = blocks.some(
        block => block.address === PHYLAX_MAIN_BLOCK_ADDRESS && block.fingerprint === fingerprint,
    );

    return isMain ? `Main block ${hex}` : `Key block ${hex}`;
};

const getSetKey = (fingerprints: number[]) => fingerprints.join(',');

type PhylaxNeverListProps = {
    ignored: number[][];
    blocks: PROTO.PhylaxBlockInfo[];
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

export const PhylaxNeverList = ({
    ignored,
    blocks,
    runOnDevice,
    isDeviceBusy,
}: PhylaxNeverListProps) => {
    const [pendingKey, setPendingKey] = useState<string>();
    const [error, setError] = useState<string>();

    if (ignored.length === 0) return null;

    const askAgain = async (fingerprints: number[]) => {
        setPendingKey(getSetKey(fingerprints));
        setError(undefined);
        const result = await runOnDevice(target =>
            TrezorConnect.phylaxForgetIgnored({ ...target, fingerprints }),
        );
        setPendingKey(undefined);
        if (result.kind === 'not-connected') {
            setError('The main block is not connected.');
        } else if (result.kind === 'wrong-device') {
            setError(result.text);
        } else if (!result.value.success) {
            setError(result.value.error.message);
        }
    };

    return (
        <Card data-testid="@phylax/never">
            <Column gap={8} alignItems="stretch">
                <H3>Never</H3>
                <Text typographyStyle="body-sm" priority="secondary">
                    The main block does not offer these blocks as a wallet: you chose Never on its
                    screen, or deleted their wallet. Ask again to have it offered the next time
                    these blocks are all attached.
                </Text>
                {ignored.map(fingerprints => {
                    const key = getSetKey(fingerprints);

                    return (
                        <Row key={key} gap={12} alignItems="center" justifyContent="space-between">
                            <Column gap={2} alignItems="flex-start">
                                <Text typographyStyle="body-md-strong">
                                    {fingerprints.length}-of-{fingerprints.length}
                                </Text>
                                {fingerprints.map(fingerprint => (
                                    <Text key={fingerprint} isMonospaced typographyStyle="body-sm">
                                        {getIgnoredBlockLabel(fingerprint, blocks)}
                                    </Text>
                                ))}
                            </Column>
                            <Button
                                size="small"
                                priority="secondary"
                                onClick={() => void askAgain(fingerprints)}
                                isDisabled={isDeviceBusy}
                                isLoading={pendingKey === key}
                                data-testid={`@phylax/never/ask-again/${key}`}
                            >
                                Ask again
                            </Button>
                        </Row>
                    );
                })}
                {error && (
                    <Text typographyStyle="body-sm" intent="critical">
                        {error}
                    </Text>
                )}
            </Column>
        </Card>
    );
};
