// PHYLAX Blocks (fork): the last check before signing, then the signing itself. The main block
// takes one SignTx and runs it past each key block first (pass 1, confirmed on the key block's
// screen) and then signs itself (pass 2, confirmed on its own screen); see the firmware's
// phylax_relay.h. Before anything is broadcast, the signed transaction is checked against the plan.

import { useState } from 'react';

import { Button, Card, Column, Divider, H3, Row, Text } from '@trezor/components';
import TrezorConnect, { type PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { ArrowLeftIcon, PaperPlaneTiltIcon } from '@trezor/icons';

import { PhylaxTotalLine } from './PhylaxTotalLine';
import { type PhylaxSendPlan, checkSignedTx, formatBtc, getPhylaxSignParams } from '../phylaxSend';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork, getFingerprintHex } from '../phylaxWallet';
import type { RunOnDevice } from '../usePhylaxStack';

type SendState =
    | { status: 'review' }
    | { status: 'signing' }
    | { status: 'broadcasting' }
    | { status: 'sent'; txid: string; isCopied: boolean }
    | { status: 'error'; text: string };

type PhylaxSendReviewProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    plan: PhylaxSendPlan;
    feeRate: number;
    unit: string;
    formatFiat: (satoshis: bigint) => string;
    mainFingerprint: number | undefined;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
    onBack: () => void;
    // broadcast done
    onSent: () => void;
    onNewPayment: () => void;
};

export const PhylaxSendReview = ({
    wallet,
    network,
    plan,
    feeRate,
    unit,
    formatFiat,
    mainFingerprint,
    runOnDevice,
    isDeviceBusy,
    onBack,
    onSent,
    onNewPayment,
}: PhylaxSendReviewProps) => {
    const [state, setState] = useState<SendState>({ status: 'review' });
    const isBusy = state.status === 'signing' || state.status === 'broadcasting';
    const amount = plan.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
    const keyBlocks = wallet.keys
        .map(key => key.fingerprint)
        .filter(fingerprint => fingerprint !== mainFingerprint);

    const handleSign = async () => {
        setState({ status: 'signing' });
        const coin = PHYLAX_COIN_SYMBOLS[network];
        const { inputs, outputs } = getPhylaxSignParams(wallet, network, plan);
        const result = await runOnDevice(
            target =>
                TrezorConnect.signTransaction({
                    device: { ...target.device, useEmptyPassphrase: true },
                    coin,
                    inputs,
                    outputs,
                    push: false,
                }),
            wallet.keys.map(key => key.fingerprint),
        );
        if (result.kind === 'not-connected') {
            setState({ status: 'error', text: 'The main block is not connected.' });

            return;
        }
        if (result.kind === 'wrong-device') {
            setState({ status: 'error', text: result.text });

            return;
        }
        if (!result.value.success) {
            setState({ status: 'error', text: result.value.error.message });

            return;
        }
        const { serializedTx } = result.value.payload;
        const mismatch = checkSignedTx(wallet, network, plan, serializedTx);
        if (mismatch) {
            setState({ status: 'error', text: `${mismatch} Nothing was broadcast.` });

            return;
        }

        setState({ status: 'broadcasting' });
        const pushed = await TrezorConnect.pushTransaction({ tx: serializedTx, coin });
        if (!pushed.success) {
            setState({
                status: 'error',
                text: `Signed, but the broadcast failed: ${pushed.error.message}`,
            });

            return;
        }
        setState({ status: 'sent', txid: pushed.payload.txid, isCopied: false });
        onSent();
    };

    const handleCopyTxid = async () => {
        if (state.status !== 'sent') return;
        await copyToClipboard(state.txid);
        setState({ ...state, isCopied: true });
    };

    if (state.status === 'sent') {
        return (
            <Card data-testid="@phylax/send/done">
                <Column gap={12} alignItems="flex-start">
                    <H3>Sent</H3>
                    <Text>
                        {formatBtc(amount)} {unit} is on its way. Transaction id:
                    </Text>
                    <Text isMonospaced typographyStyle="body-sm">
                        <span style={{ wordBreak: 'break-all' }}>{state.txid}</span>
                    </Text>
                    <Row gap={8}>
                        <Button size="small" priority="secondary" onClick={handleCopyTxid}>
                            {state.isCopied ? 'Copied' : 'Copy transaction id'}
                        </Button>
                        <Button size="small" onClick={onNewPayment}>
                            New payment
                        </Button>
                    </Row>
                </Column>
            </Card>
        );
    }

    return (
        <Card data-testid="@phylax/send/review-card">
            <Column gap={12} alignItems="stretch">
                <H3>Review the payment</H3>
                {plan.recipients.map((recipient, index) => (
                    <Column
                        key={`${recipient.address}:${index}`}
                        gap={4}
                        alignItems="stretch"
                        data-testid={`@phylax/send/review/recipient/${index}`}
                    >
                        <Text typographyStyle="body-sm" priority="secondary">
                            {plan.recipients.length > 1 ? `Recipient ${index + 1}` : 'To'}
                        </Text>
                        <Text isMonospaced typographyStyle="body-md">
                            <span style={{ wordBreak: 'break-all' }}>{recipient.address}</span>
                        </Text>
                        <Text typographyStyle="body-md-strong" isTabular>
                            {formatBtc(recipient.amount)} {unit}
                            {formatFiat(recipient.amount) && ` · ${formatFiat(recipient.amount)}`}
                        </Text>
                    </Column>
                ))}
                <Divider margin={{ top: 0, bottom: 0 }} />
                {plan.change && (
                    <Text typographyStyle="body-sm" priority="secondary">
                        Change: {formatBtc(plan.change.amount)} {unit} back to this wallet (change
                        address #{plan.change.index}).
                    </Text>
                )}
                <Text typographyStyle="body-sm" priority="secondary">
                    Spends {plan.inputs.length} {plan.inputs.length === 1 ? 'coin' : 'coins'} ·{' '}
                    {feeRate} sat/vB × {plan.vsize} vB · replaceable (the fee can be raised later)
                </Text>
                <PhylaxTotalLine
                    label="Fee"
                    satoshis={plan.fee}
                    unit={unit}
                    formatFiat={formatFiat}
                />
                <PhylaxTotalLine
                    label="Total spent"
                    satoshis={amount + plan.fee}
                    unit={unit}
                    formatFiat={formatFiat}
                    isStrong
                />

                {state.status === 'signing' && (
                    <Text data-testid="@phylax/send/steps">
                        {keyBlocks
                            .map(
                                (fingerprint, i) =>
                                    `${i + 1}. Confirm on key block ${getFingerprintHex(fingerprint)}`,
                            )
                            .join('  ')}
                        {`  ${keyBlocks.length + 1}. Confirm on the main block`}. Check every
                        address, amount and the fee on each screen.
                    </Text>
                )}
                {state.status === 'error' && (
                    <Text intent="critical" data-testid="@phylax/send/error">
                        {state.text}
                    </Text>
                )}
                <Row gap={12} justifyContent="space-between" flexWrap="wrap">
                    <Button
                        priority="secondary"
                        iconLeft={ArrowLeftIcon}
                        onClick={onBack}
                        isDisabled={isBusy}
                        data-testid="@phylax/send/back"
                    >
                        Back
                    </Button>
                    <Button
                        size="large"
                        iconLeft={PaperPlaneTiltIcon}
                        onClick={handleSign}
                        isDisabled={isDeviceBusy || isBusy}
                        isLoading={isBusy}
                        data-testid="@phylax/send/sign"
                    >
                        {state.status === 'broadcasting' ? 'Broadcasting…' : 'Sign on the blocks'}
                    </Button>
                </Row>
            </Column>
        </Card>
    );
};
