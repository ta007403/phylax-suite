// PHYLAX Blocks (fork): the block stack and the saved wallets, as the main block reports them.

import { useState } from 'react';

import { selectDevices, selectIsPhylaxDevice } from '@suite-common/device';
import { Badge, Card, Column, H3, Row, SelectBar, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { useSelector } from 'src/hooks/suite';

import { type PhylaxWakeUp, WakeUpButton, usePhylaxWakeUp } from './PhylaxWakeUp';
import { PhylaxWalletCard } from './PhylaxWalletCard';
import { PHYLAX_MAIN_BLOCK_ADDRESS, countConnectedDevices } from './phylaxIdentity';
import { type PhylaxNetwork, getFingerprintHex } from './phylaxWallet';
import { usePhylaxStack } from './usePhylaxStack';

const NETWORK_OPTIONS: { label: string; value: PhylaxNetwork }[] = [
    { label: 'Mainnet', value: 'mainnet' },
    { label: 'Testnet', value: 'testnet' },
];

// The main block is always at bus address 1 (PHYLAX_MAIN_BLOCK_ADDRESS), key blocks at 0x10..0x1f.
const getBlockName = (block: PROTO.PhylaxBlockInfo) =>
    block.address === PHYLAX_MAIN_BLOCK_ADDRESS
        ? 'Main block'
        : `Key block 0x${block.address.toString(16)}`;

const BlockState = ({ block }: { block: PROTO.PhylaxBlockInfo }) => {
    if (!block.initialized) return <Badge intent="warning">No seed</Badge>;
    if (block.locked) return <Badge intent="neutral">Locked</Badge>;

    return <Badge intent="brand">Ready</Badge>;
};

/** Key blocks with a seed that are attached but locked. */
const getLockedKeyBlocks = (blocks: PROTO.PhylaxBlockInfo[]) =>
    blocks.filter(
        block => block.address !== PHYLAX_MAIN_BLOCK_ADDRESS && block.initialized && block.locked,
    );

type StackProps = {
    blocks: PROTO.PhylaxBlockInfo[];
    wakeUp: PhylaxWakeUp;
    isDeviceBusy: boolean;
};

const Stack = ({ blocks, wakeUp, isDeviceBusy }: StackProps) => (
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
                    {block.address !== PHYLAX_MAIN_BLOCK_ADDRESS &&
                        block.initialized &&
                        block.locked && (
                            <WakeUpButton
                                address={block.address}
                                wakeUp={wakeUp}
                                isDeviceBusy={isDeviceBusy}
                            />
                        )}
                </Row>
            ))}
        </Column>
    </Card>
);

export const PhylaxPage = () => {
    const isPhylaxDevice = useSelector(selectIsPhylaxDevice);
    const devices = useSelector(selectDevices);
    const { blocks, wallets, isStoragePresent, error, isLoaded, isPaused, runOnDevice } =
        usePhylaxStack();
    const [network, setNetwork] = useState<PhylaxNetwork>('mainnet');
    const lockedKeyBlocks = getLockedKeyBlocks(blocks);
    const wakeUp = usePhylaxWakeUp(
        runOnDevice,
        lockedKeyBlocks.map(block => block.address),
    );

    if (!isPhylaxDevice) {
        return <Text>Connect a PHYLAX main block to see its stack and wallets.</Text>;
    }
    if (!isLoaded) {
        return <Text>Asking the main block…</Text>;
    }

    const mainFingerprint =
        blocks.find(block => block.address === PHYLAX_MAIN_BLOCK_ADDRESS)?.fingerprint ?? undefined;
    // Blocks that can sign now (locked ones are passed on separately: a locked block reports
    // the fingerprint of its last unlock, or none if it never was unlocked with this firmware).
    const fingerprintsOf = (list: PROTO.PhylaxBlockInfo[]) =>
        list
            .map(block => block.fingerprint)
            .filter((fingerprint): fingerprint is number => typeof fingerprint === 'number');
    const presentFingerprints = fingerprintsOf(blocks.filter(block => !block.locked));

    return (
        <Column gap={16} alignItems="stretch">
            {countConnectedDevices(devices ?? []) > 1 && (
                <Text intent="warning" data-testid="@phylax/several-devices">
                    More than one Trezor is connected. To be safe, unplug every Trezor except the
                    PHYLAX main block while you use PHYLAX Snap.
                </Text>
            )}
            {error && <Text intent="critical">{error}</Text>}
            <Stack blocks={blocks} wakeUp={wakeUp} isDeviceBusy={isPaused} />
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
                    lockedKeyBlocks={lockedKeyBlocks}
                    wakeUp={wakeUp}
                    mainFingerprint={mainFingerprint}
                    runOnDevice={runOnDevice}
                    isDeviceBusy={isPaused}
                />
            ))}
        </Column>
    );
};
