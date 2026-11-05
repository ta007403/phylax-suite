// PHYLAX Blocks (fork): the wallet's descriptor (copy, QR for Sparrow), its keys, rename, delete.

import { useMemo, useState } from 'react';

import { Button, Card, Column, H3, Text } from '@trezor/components';
import { copyToClipboard } from '@trezor/dom-utils';
import { QrCode } from '@trezor/product-components';

import { PhylaxKeyList } from './PhylaxKeyList';
import { PhylaxWalletActions } from './PhylaxWalletActions';
import { type PhylaxNetwork, getPhylaxDescriptor } from '../phylaxWallet';
import type { PhylaxWalletEntry, RunOnDevice } from '../usePhylaxStack';

type PhylaxDetailsProps = {
    entry: PhylaxWalletEntry;
    network: PhylaxNetwork;
    mainFingerprint: number | undefined;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

export const PhylaxDetails = ({
    entry,
    network,
    mainFingerprint,
    runOnDevice,
    isDeviceBusy,
}: PhylaxDetailsProps) => {
    const { summary, details } = entry;
    const [isQrVisible, setIsQrVisible] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const descriptor = useMemo(
        () => (details ? getPhylaxDescriptor(details, network) : undefined),
        [details, network],
    );

    const handleCopy = async () => {
        if (!descriptor) return;
        await copyToClipboard(descriptor);
        setIsCopied(true);
    };

    return (
        <Column gap={16} alignItems="stretch">
            <Card>
                <Column gap={8} alignItems="stretch">
                    <H3>Wallet descriptor</H3>
                    <Text typographyStyle="body-sm" priority="secondary">
                        Import it into a watch-only wallet (for example Sparrow) to follow this
                        wallet. It holds the public keys only: anyone with it can see the
                        wallet&apos;s balance and history, but cannot spend.
                    </Text>
                    <Text isMonospaced typographyStyle="body-sm" data-testid="@phylax/descriptor">
                        <span style={{ wordBreak: 'break-all' }}>
                            {descriptor ?? 'Reading the xpubs…'}
                        </span>
                    </Text>
                    <Column gap={8} alignItems="flex-start">
                        <Button
                            size="small"
                            priority="secondary"
                            onClick={handleCopy}
                            isDisabled={!descriptor}
                        >
                            {isCopied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button
                            size="small"
                            priority="secondary"
                            onClick={() => setIsQrVisible(isVisible => !isVisible)}
                            isDisabled={!descriptor}
                        >
                            {isQrVisible ? 'Hide QR code' : 'Show QR code'}
                        </Button>
                    </Column>
                    {isQrVisible && descriptor && (
                        <div style={{ width: 280 }}>
                            <QrCode value={descriptor} data-testid="@phylax/descriptor-qr" />
                        </div>
                    )}
                </Column>
            </Card>

            {details && (
                <PhylaxKeyList
                    wallet={details}
                    network={network}
                    mainFingerprint={mainFingerprint}
                />
            )}

            <PhylaxWalletActions
                summary={summary}
                runOnDevice={runOnDevice}
                isDeviceBusy={isDeviceBusy}
            />
        </Column>
    );
};
