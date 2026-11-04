// PHYLAX Blocks (fork): one saved wallet: balance, receive address (checked on the main block),
// descriptor (+ QR for Sparrow), rename, delete.

import { useMemo, useState } from 'react';

import { Badge, Button, Card, Column, Divider, H3, Input, Row, Text } from '@trezor/components';
import TrezorConnect from '@trezor/connect';
import type { PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { QrCode } from '@trezor/product-components';

import { PhylaxAddressHistory } from './PhylaxAddressHistory';
import { PhylaxReceive } from './PhylaxReceive';
import { PhylaxSend } from './PhylaxSend';
import type { PhylaxWakeUp } from './PhylaxWakeUp';
import { type PhylaxNetwork, getFingerprintHex, getPhylaxDescriptor } from './phylaxWallet';
import { usePhylaxBalance } from './usePhylaxBalance';
import type { PhylaxTarget, PhylaxWalletEntry, RunOnDevice } from './usePhylaxStack';

const NAME_MAX_LENGTH = 15; // the main block's limit

const formatBtc = (satoshis: bigint) => {
    const whole = satoshis / 100_000_000n;
    const fraction = (satoshis % 100_000_000n).toString().padStart(8, '0');

    return `${whole}.${fraction}`;
};

type PhylaxWalletCardProps = {
    entry: PhylaxWalletEntry;
    network: PhylaxNetwork;
    // blocks that can sign now
    presentFingerprints: number[];
    // key blocks attached but locked
    lockedKeyBlocks: PROTO.PhylaxBlockInfo[];
    wakeUp: PhylaxWakeUp;
    mainFingerprint: number | undefined;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

type ActionState =
    | { status: 'idle' }
    | { status: 'waiting'; text: string }
    | { status: 'done'; text: string }
    | { status: 'error'; text: string };

export const PhylaxWalletCard = ({
    entry,
    network,
    presentFingerprints,
    lockedKeyBlocks,
    wakeUp,
    mainFingerprint,
    runOnDevice,
    isDeviceBusy,
}: PhylaxWalletCardProps) => {
    const { summary, details } = entry;
    const [balanceRefresh, setBalanceRefresh] = useState(0);
    const balance = usePhylaxBalance(details, network, balanceRefresh);
    const [newName, setNewName] = useState('');
    const [isQrVisible, setIsQrVisible] = useState(false);
    const [action, setAction] = useState<ActionState>({ status: 'idle' });

    const descriptor = useMemo(
        () => (details ? getPhylaxDescriptor(details, network) : undefined),
        [details, network],
    );
    // The main block counts as ready even when locked: Suite asks for its PIN as usual.
    const notReady = summary.fingerprints.filter(
        fingerprint =>
            fingerprint !== mainFingerprint && !presentFingerprints.includes(fingerprint),
    );
    // locked blocks of this wallet; one without a fingerprint (never unlocked with this firmware)
    // may be any of the wallet's missing keys
    const knownLocked = lockedKeyBlocks.filter(
        block => typeof block.fingerprint === 'number' && notReady.includes(block.fingerprint),
    );
    const unknownLocked = lockedKeyBlocks.filter(block => typeof block.fingerprint !== 'number');
    const missingFingerprints = notReady.filter(
        fingerprint => !knownLocked.some(block => block.fingerprint === fingerprint),
    );
    const isAttachNeeded = missingFingerprints.length > unknownLocked.length;
    const lockedInWallet = [
        ...knownLocked,
        ...(missingFingerprints.length > 0 ? unknownLocked : []),
    ];
    const getLockedName = (block: PROTO.PhylaxBlockInfo) =>
        typeof block.fingerprint === 'number'
            ? getFingerprintHex(block.fingerprint)
            : `0x${block.address.toString(16)}`;

    const runAction = async (
        waitingText: string,
        call: (target: PhylaxTarget) => ReturnType<typeof TrezorConnect.phylaxDeleteWallet>,
        doneText: string,
    ) => {
        setAction({ status: 'waiting', text: waitingText });
        const result = await runOnDevice(call, summary.fingerprints);
        if (result.kind === 'not-connected') {
            setAction({ status: 'error', text: 'The main block is not connected.' });
        } else if (result.kind === 'wrong-device') {
            setAction({ status: 'error', text: result.text });
        } else if (result.value.success) {
            setAction({ status: 'done', text: doneText });
        } else {
            setAction({ status: 'error', text: result.value.error.message });
        }
    };

    const handleRename = () =>
        runAction(
            'Confirm the new name on your PHYLAX main block.',
            target =>
                TrezorConnect.phylaxSetWalletName({ ...target, slot: summary.slot, name: newName }),
            `Renamed to "${newName}".`,
        ).then(() => setNewName(''));

    const handleDelete = () =>
        runAction(
            'Confirm the delete on your PHYLAX main block.',
            target => TrezorConnect.phylaxDeleteWallet({ ...target, slot: summary.slot }),
            'Deleted from every block.',
        );

    const handleCopy = async () => {
        if (!descriptor) return;
        await copyToClipboard(descriptor);
        setAction({ status: 'done', text: 'Descriptor copied.' });
    };

    return (
        <Card data-testid={`@phylax/wallet/${summary.slot}`}>
            <Column gap={12} alignItems="stretch">
                <Row gap={8} alignItems="center" flexWrap="wrap">
                    <H3>{summary.name}</H3>
                    <Badge intent="neutral">
                        {summary.threshold}-of-{summary.fingerprints.length}
                    </Badge>
                    {notReady.length === 0 && <Badge intent="brand">Ready</Badge>}
                    {isAttachNeeded && (
                        <Badge intent="warning">
                            Attach key block {missingFingerprints.map(getFingerprintHex).join(', ')}
                        </Badge>
                    )}
                    {lockedInWallet.length > 0 && (
                        <Badge intent="warning">
                            Key block {lockedInWallet.map(getLockedName).join(', ')} locked
                        </Badge>
                    )}
                </Row>

                <Column gap={4} alignItems="stretch">
                    <Text typographyStyle="body-sm" priority="secondary">
                        Descriptor ({network === 'mainnet' ? 'mainnet' : 'testnet'})
                    </Text>
                    <Text isMonospaced typographyStyle="body-sm" data-testid="@phylax/descriptor">
                        <span style={{ wordBreak: 'break-all' }}>
                            {descriptor ?? 'Reading the xpubs…'}
                        </span>
                    </Text>
                    <Row gap={8}>
                        <Button size="small" priority="secondary" onClick={handleCopy}>
                            Copy
                        </Button>
                        <Button
                            size="small"
                            priority="secondary"
                            onClick={() => setIsQrVisible(isVisible => !isVisible)}
                        >
                            {isQrVisible ? 'Hide QR code' : 'Show QR code'}
                        </Button>
                    </Row>
                    {isQrVisible && descriptor && (
                        <div style={{ width: 280 }}>
                            <QrCode value={descriptor} data-testid="@phylax/descriptor-qr" />
                        </div>
                    )}
                </Column>

                <Row gap={8} alignItems="center" flexWrap="wrap">
                    <Input
                        size="small"
                        placeholder="New name"
                        value={newName}
                        maxLength={NAME_MAX_LENGTH}
                        onChange={event => setNewName(event.target.value)}
                        data-testid="@phylax/rename-input"
                    />
                    <Button
                        size="small"
                        onClick={handleRename}
                        isDisabled={isDeviceBusy || newName.trim().length === 0}
                        data-testid="@phylax/rename"
                    >
                        Rename
                    </Button>
                    <Button
                        size="small"
                        intent="critical"
                        priority="secondary"
                        onClick={handleDelete}
                        isDisabled={isDeviceBusy}
                        data-testid="@phylax/delete"
                    >
                        Delete
                    </Button>
                </Row>
                {action.status !== 'idle' && (
                    <Text
                        intent={action.status === 'error' ? 'critical' : undefined}
                        data-testid="@phylax/action-status"
                    >
                        {action.text}
                    </Text>
                )}

                <Divider margin={{ top: 4, bottom: 4 }} />

                <Row gap={8} alignItems="baseline">
                    <Text typographyStyle="body-sm" priority="secondary">
                        Balance
                    </Text>
                    {balance.status === 'loading' && <Text>Checking the blockchain…</Text>}
                    {balance.status === 'error' && <Text intent="critical">{balance.error}</Text>}
                    {balance.status === 'loaded' && (
                        <Text typographyStyle="body-md-strong" isTabular>
                            {formatBtc(balance.balance)} {network === 'mainnet' ? 'BTC' : 'tBTC'}
                        </Text>
                    )}
                    {balance.status === 'loaded' && (
                        <Text typographyStyle="body-sm" priority="secondary">
                            ({balance.usedAddressCount} used addresses)
                        </Text>
                    )}
                </Row>

                {details && (
                    <PhylaxReceive
                        wallet={details}
                        network={network}
                        nextIndex={
                            balance.status === 'loaded' ? balance.nextReceiveIndex : undefined
                        }
                        isUsageUnknown={balance.status === 'error'}
                        mainFingerprint={mainFingerprint}
                        runOnDevice={runOnDevice}
                        isDeviceBusy={isDeviceBusy}
                    />
                )}

                {balance.status === 'loaded' && (
                    <PhylaxAddressHistory
                        addresses={balance.usedReceiveAddresses}
                        unit={network === 'mainnet' ? 'BTC' : 'tBTC'}
                    />
                )}

                {details && balance.status === 'loaded' && (
                    <>
                        <Divider margin={{ top: 4, bottom: 4 }} />
                        <PhylaxSend
                            wallet={details}
                            network={network}
                            utxos={balance.utxos}
                            nextChangeIndex={balance.nextChangeIndex}
                            mainFingerprint={mainFingerprint}
                            missingFingerprints={isAttachNeeded ? missingFingerprints : []}
                            lockedKeyBlocks={lockedInWallet}
                            wakeUp={wakeUp}
                            runOnDevice={runOnDevice}
                            isDeviceBusy={isDeviceBusy}
                            // a new scan picks up the spent coins and the new change
                            onSent={() => setBalanceRefresh(value => value + 1)}
                        />
                    </>
                )}
            </Column>
        </Card>
    );
};
