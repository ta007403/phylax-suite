// PHYLAX Blocks (fork): the block stack and the saved wallets, as the main block reports them.

import { useState } from 'react';

import { selectIsPhylaxDevice } from '@suite-common/device';
import { Badge, Card, Column, H3, Row, SelectBar, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { useSelector } from 'src/hooks/suite';

import { PhylaxWalletCard } from './PhylaxWalletCard';
import { type PhylaxNetwork, getFingerprintHex } from './phylaxWallet';
import { usePhylaxStack } from './usePhylaxStack';

const NETWORK_OPTIONS: { label: string; value: PhylaxNetwork }[] = [
    { label: 'Mainnet', value: 'mainnet' },
    { label: 'Testnet', value: 'testnet' },
];

// The main block is always at bus address 1, key blocks at 0x10..0x1f.
const PHYLAX_MAIN_BLOCK_ADDRESS = 1;

const getBlockName = (block: PROTO.PhylaxBlockInfo) =>
    block.address === PHYLAX_MAIN_BLOCK_ADDRESS
        ? 'Main block'
        : `Key block 0x${block.address.toString(16)}`;

const BlockState = ({ block }: { block: PROTO.PhylaxBlockInfo }) => {
    if (!block.initialized) return <Badge intent="warning">No seed</Badge>;
    if (block.locked) return <Badge intent="neutral">Locked</Badge>;

    return <Badge intent="brand">Ready</Badge>;
};

const Stack = ({ blocks }: { blocks: PROTO.PhylaxBlockInfo[] }) => (
    <Card data-testid="@phylax/stack">
        <Column gap={8} alignItems="stretch">
            <H3>Stack</H3>
            {blocks.map(block => (
                <Row key={block.address} gap={12} alignItems="center">
                    <Text typographyStyle="body-md-strong">{getBlockName(block)}</Text>
                    <Text isMonospaced>
                        {block.fingerprint !== undefined && block.fingerprint !== null
                            ? getFingerprintHex(block.fingerprint)
                            : '--------'}
                    </Text>
                    <BlockState block={block} />
                    <Text typographyStyle="body-sm" priority="secondary">
                        v{block.major_version}.{block.minor_version}.{block.patch_version}
                    </Text>
                </Row>
            ))}
        </Column>
    </Card>
);

export const PhylaxPage = () => {
    const isPhylaxDevice = useSelector(selectIsPhylaxDevice);
    const { blocks, wallets, isStoragePresent, error, isLoaded, isPaused, runOnDevice } =
        usePhylaxStack();
    const [network, setNetwork] = useState<PhylaxNetwork>('mainnet');

    if (!isPhylaxDevice) {
        return <Text>Connect a PHYLAX main block to see its stack and wallets.</Text>;
    }
    if (!isLoaded) {
        return <Text>Asking the main block…</Text>;
    }

    const presentFingerprints = blocks
        .map(block => block.fingerprint)
        .filter((fingerprint): fingerprint is number => typeof fingerprint === 'number');

    return (
        <Column gap={16} alignItems="stretch">
            {error && <Text intent="critical">{error}</Text>}
            <Stack blocks={blocks} />
            <Row gap={12} alignItems="center" justifyContent="space-between">
                <H3>Wallets</H3>
                <SelectBar
                    options={NETWORK_OPTIONS}
                    selectedOption={network}
                    onChange={setNetwork}
                    data-testid="@phylax/network"
                />
            </Row>
            {!isStoragePresent && (
                <Text priority="secondary">Reading the wallet copies of every block…</Text>
            )}
            {wallets.length === 0 && isStoragePresent && (
                <Text priority="secondary">
                    No saved wallets yet. Snap a key block onto the main block and confirm the new
                    wallet on its screen.
                </Text>
            )}
            {wallets.map(entry => (
                <PhylaxWalletCard
                    key={entry.summary.slot}
                    entry={entry}
                    network={network}
                    presentFingerprints={presentFingerprints}
                    runOnDevice={runOnDevice}
                    isDeviceBusy={isPaused}
                />
            ))}
        </Column>
    );
};
