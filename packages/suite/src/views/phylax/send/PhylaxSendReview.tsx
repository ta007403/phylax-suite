// PHYLAX Blocks (fork): the last check before signing, the signing, and the broadcast. The main
// block takes one SignTx and runs it past each key block first (pass 1, confirmed on the key
// block's screen) and then signs itself (pass 2, confirmed on its own screen); see the firmware's
// phylax_relay.h. The signed transaction is checked against the plan, then shown ("Signed - ready
// to send", as in Suite after signing): it is broadcast only on Send, or discarded.

import { useState } from 'react';

import { Button, Card, Column, Divider, H3, Row, Text } from '@trezor/components';
import TrezorConnect, { type PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { ArrowLeftIcon, PaperPlaneTiltIcon } from '@trezor/icons';

import { PhylaxTotalLine } from './PhylaxTotalLine';
import type { PhylaxAmountFormat } from '../phylaxAmount';
import {
    type PhylaxSendPlan,
    checkSignedTx,
    getPhylaxSignParams,
    getSignedTxid,
} from '../phylaxSend';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork, getFingerprintHex } from '../phylaxWallet';
import type { RunOnDevice } from '../usePhylaxStack';

/** A signed transaction that matches the plan, not broadcast yet. */
type SignedTx = { serializedTx: string; txid: string };

type SendState =
    | { status: 'review' }
    | { status: 'signing' }
    | { status: 'signed'; signed: SignedTx; isHexCopied: boolean }
    | { status: 'broadcasting'; signed: SignedTx }
    | { status: 'sent'; txid: string; isCopied: boolean }
    // `signed`: the broadcast failed, the signed transaction can still be sent or copied
    | { status: 'error'; text: string; signed?: SignedTx; isHexCopied?: boolean };

type PhylaxSendReviewProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    plan: PhylaxSendPlan;
    feeRate: number;
    amountFormat: PhylaxAmountFormat;
    formatFiat: (satoshis: bigint) => string;
    mainFingerprint: number | undefined;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
    // heading of the review (a payment, or its faster replacement)
    title?: string;
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
    amountFormat,
    formatFiat,
    mainFingerprint,
    runOnDevice,
    isDeviceBusy,
    title = 'Review the payment',
    onBack,
    onSent,
    onNewPayment,
}: PhylaxSendReviewProps) => {
    const [state, setState] = useState<SendState>({ status: 'review' });
    const isBusy = state.status === 'signing' || state.status === 'broadcasting';
    const signed =
        state.status === 'signed' || state.status === 'broadcasting' || state.status === 'error'
            ? state.signed
            : undefined;
    const isHexCopied =
        (state.status === 'signed' || state.status === 'error') && !!state.isHexCopied;
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
        const txid = getSignedTxid(network, serializedTx);
        if (mismatch || !txid) {
            setState({
                status: 'error',
                text: `${mismatch ?? 'The signed transaction could not be read.'} Nothing was broadcast.`,
            });

            return;
        }
        // nothing is broadcast until Send
        setState({ status: 'signed', signed: { serializedTx, txid }, isHexCopied: false });
    };

    const handleBroadcast = async (signed: SignedTx) => {
        setState({ status: 'broadcasting', signed });
        const pushed = await TrezorConnect.pushTransaction({
            tx: signed.serializedTx,
            coin: PHYLAX_COIN_SYMBOLS[network],
        });
        if (!pushed.success) {
            setState({
                status: 'error',
                text: `The broadcast failed: ${pushed.error.message}. The transaction is signed: send it again, or copy it and broadcast it elsewhere.`,
                signed,
            });

            return;
        }
        setState({ status: 'sent', txid: pushed.payload.txid, isCopied: false });
        onSent();
    };

    // the signed transaction is forgotten: nothing was broadcast
    const handleDiscard = () => setState({ status: 'review' });

    const handleCopyHex = async (signed: SignedTx) => {
        await copyToClipboard(signed.serializedTx);
        setState(current =>
            current.status === 'signed' || current.status === 'error'
                ? { ...current, isHexCopied: true }
                : current,
        );
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
                    <Text>{amountFormat.format(amount)} is on its way. Transaction id:</Text>
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
                <H3>{signed ? 'Signed – ready to send' : title}</H3>
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
                            {amountFormat.format(recipient.amount)}
                            {formatFiat(recipient.amount) && ` · ${formatFiat(recipient.amount)}`}
                        </Text>
                    </Column>
                ))}
                <Divider margin={{ top: 0, bottom: 0 }} />
                {plan.change && (
                    <Text typographyStyle="body-sm" priority="secondary">
                        Change: {amountFormat.format(plan.change.amount)} back to this wallet
                        (change address #{plan.change.index}).
                    </Text>
                )}
                <Text typographyStyle="body-sm" priority="secondary">
                    Spends {plan.inputs.length} {plan.inputs.length === 1 ? 'coin' : 'coins'} ·{' '}
                    {feeRate} sat/vB × {plan.vsize} vB · replaceable (the fee can be raised later)
                </Text>
                <PhylaxTotalLine
                    label="Fee"
                    satoshis={plan.fee}
                    amountFormat={amountFormat}
                    formatFiat={formatFiat}
                />
                <PhylaxTotalLine
                    label="Total spent"
                    satoshis={amount + plan.fee}
                    amountFormat={amountFormat}
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
                {signed && (
                    <Column gap={4} alignItems="stretch" data-testid="@phylax/send/signed">
                        <Text typographyStyle="body-sm" priority="secondary">
                            Every block signed, and the signed transaction matches the above.
                            Nothing is broadcast until you press Send. Transaction id:
                        </Text>
                        <Text isMonospaced typographyStyle="body-sm">
                            <span style={{ wordBreak: 'break-all' }}>{signed.txid}</span>
                        </Text>
                    </Column>
                )}
                {state.status === 'error' && (
                    <Text intent="critical" data-testid="@phylax/send/error">
                        {state.text}
                    </Text>
                )}
                {signed ? (
                    <Row gap={12} justifyContent="space-between" flexWrap="wrap">
                        <Row gap={8} flexWrap="wrap">
                            <Button
                                priority="secondary"
                                onClick={handleDiscard}
                                isDisabled={isBusy}
                                data-testid="@phylax/send/discard"
                            >
                                Discard
                            </Button>
                            <Button
                                priority="secondary"
                                onClick={() => handleCopyHex(signed)}
                                isDisabled={isBusy}
                                data-testid="@phylax/send/copy-hex"
                            >
                                {isHexCopied ? 'Copied' : 'Copy signed transaction'}
                            </Button>
                        </Row>
                        <Button
                            size="large"
                            iconLeft={PaperPlaneTiltIcon}
                            onClick={() => handleBroadcast(signed)}
                            isDisabled={isBusy}
                            isLoading={state.status === 'broadcasting'}
                            data-testid="@phylax/send/broadcast"
                        >
                            {state.status === 'broadcasting' ? 'Sending…' : 'Send'}
                        </Button>
                    </Row>
                ) : (
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
                            Sign on the blocks
                        </Button>
                    </Row>
                )}
            </Column>
        </Card>
    );
};
