// PHYLAX Snap (fork): send from a saved wallet, signed by every block of it.
// The main block takes one SignTx and runs it past each key block first (pass 1, confirmed on
// the key block's screen) and then signs itself (pass 2, confirmed on its own screen); see the
// firmware's phylax_relay.h. Before anything is broadcast, the signed transaction is checked
// against what this form planned.

import { useEffect, useMemo, useState } from 'react';

import { Button, Checkbox, Column, Input, Row, SelectBar, Text } from '@trezor/components';
import TrezorConnect from '@trezor/connect';
import type { PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { PaperPlaneTiltIcon } from '@trezor/icons';

import {
    type PhylaxSendPlan,
    checkSignedTx,
    formatBtc,
    getPhylaxSignParams,
    parseBtc,
    planPhylaxSend,
} from './phylaxSend';
import { PHYLAX_COIN_SYMBOLS, type PhylaxNetwork, getFingerprintHex } from './phylaxWallet';
import type { PhylaxUtxo } from './usePhylaxBalance';
import type { RunOnDevice } from './usePhylaxStack';

type FeeChoice = 'low' | 'normal' | 'high';

const FEE_OPTIONS: { label: string; value: FeeChoice }[] = [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
];

type FeeRates = Record<FeeChoice, number>;

// From the backend ("smart"), else the coin's built-in defaults ("preloaded").
const loadFeeRates = async (network: PhylaxNetwork): Promise<FeeRates> => {
    const coin = PHYLAX_COIN_SYMBOLS[network];
    let result = await TrezorConnect.blockchainEstimateFee({
        coin,
        request: { feeLevels: 'smart' },
    });
    if (!result.success) {
        result = await TrezorConnect.blockchainEstimateFee({
            coin,
            request: { feeLevels: 'preloaded' },
        });
    }
    if (!result.success) throw new Error(result.error.message);
    const rate = (...labels: string[]) => {
        const level = result.payload.levels.find(l => labels.includes(l.label));

        return level ? Number(level.feePerUnit) : NaN;
    };
    const rates = {
        low: rate('low', 'economy'),
        normal: rate('normal'),
        high: rate('high'),
    };
    if (!(rates.normal > 0)) throw new Error('no fee estimate');

    return {
        low: rates.low > 0 ? rates.low : rates.normal,
        normal: rates.normal,
        high: rates.high > 0 ? rates.high : rates.normal,
    };
};

type SendState =
    | { status: 'idle' }
    | { status: 'signing' }
    | { status: 'broadcasting' }
    | { status: 'sent'; txid: string; isCopied: boolean }
    | { status: 'error'; text: string };

type PhylaxSendProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    utxos: PhylaxUtxo[];
    nextChangeIndex: number;
    mainFingerprint: number | undefined;
    // key blocks of this wallet that are not attached, or attached but locked
    missingFingerprints: number[];
    lockedFingerprints: number[];
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
    onSent: () => void;
};

export const PhylaxSend = ({
    wallet,
    network,
    utxos,
    nextChangeIndex,
    mainFingerprint,
    missingFingerprints,
    lockedFingerprints,
    runOnDevice,
    isDeviceBusy,
    onSent,
}: PhylaxSendProps) => {
    const [address, setAddress] = useState('');
    const [amountText, setAmountText] = useState('');
    const [isSendAll, setIsSendAll] = useState(false);
    const [feeChoice, setFeeChoice] = useState<FeeChoice>('normal');
    const [feeRates, setFeeRates] = useState<FeeRates | { error: string } | undefined>();
    const [state, setState] = useState<SendState>({ status: 'idle' });
    const unit = network === 'mainnet' ? 'BTC' : 'tBTC';

    useEffect(() => {
        let isCancelled = false;
        setFeeRates(undefined);
        loadFeeRates(network)
            .then(rates => !isCancelled && setFeeRates(rates))
            .catch((error: Error) => !isCancelled && setFeeRates({ error: error.message }));

        return () => {
            isCancelled = true;
        };
    }, [network]);

    const feeRate = feeRates && !('error' in feeRates) ? feeRates[feeChoice] : undefined;
    const amount = parseBtc(amountText);

    const planned = useMemo(() => {
        if (!address.trim() || feeRate === undefined) return undefined;
        if (!isSendAll && amount === undefined) {
            return amountText.trim()
                ? { kind: 'error' as const, text: 'Invalid amount.' }
                : undefined;
        }

        return planPhylaxSend(wallet, network, utxos, nextChangeIndex, {
            address,
            amount: amount ?? 0n,
            sendAll: isSendAll,
            feeRate,
        });
    }, [wallet, network, utxos, nextChangeIndex, address, amount, amountText, isSendAll, feeRate]);

    const plan: PhylaxSendPlan | undefined = planned?.kind === 'plan' ? planned.plan : undefined;
    const keyBlocks = wallet.keys
        .map(key => key.fingerprint)
        .filter(fingerprint => fingerprint !== mainFingerprint);
    const getBlocker = () => {
        if (missingFingerprints.length > 0) {
            return `Attach key block ${missingFingerprints.map(getFingerprintHex).join(', ')} to send.`;
        }
        if (lockedFingerprints.length > 0) {
            return `Key block ${lockedFingerprints.map(getFingerprintHex).join(', ')} is locked. Press Unlock on the main block and enter its PIN on the key block's own buttons.`;
        }

        return undefined;
    };
    const blocker = getBlocker();
    const sendAllAmount = plan ? formatBtc(plan.recipient.amount) : '';
    const isBusy = state.status === 'signing' || state.status === 'broadcasting';

    const handleSend = async () => {
        if (!plan) return;
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
        const mismatch = checkSignedTx(network, plan, serializedTx);
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
        setAddress('');
        setAmountText('');
        setIsSendAll(false);
        onSent();
    };

    const handleCopyTxid = async () => {
        if (state.status !== 'sent') return;
        await copyToClipboard(state.txid);
        setState({ ...state, isCopied: true });
    };

    return (
        <Column gap={12} alignItems="stretch" data-testid="@phylax/send">
            <Text typographyStyle="body-md" priority="secondary">
                Send
            </Text>
            <Input
                label="Recipient address"
                value={address}
                onChange={event => setAddress(event.target.value)}
                isDisabled={isBusy}
                data-testid="@phylax/send-address"
            />
            <Row gap={12} alignItems="center" flexWrap="wrap">
                <div style={{ flex: '1 1 220px' }}>
                    <Input
                        label={`Amount (${unit})`}
                        value={isSendAll ? sendAllAmount : amountText}
                        onChange={event => setAmountText(event.target.value)}
                        isDisabled={isBusy || isSendAll}
                        data-testid="@phylax/send-amount"
                    />
                </div>
                <Checkbox
                    isChecked={isSendAll}
                    onChange={() => setIsSendAll(value => !value)}
                    isDisabled={isBusy}
                    data-testid="@phylax/send-all"
                >
                    Send all
                </Checkbox>
            </Row>
            <Row gap={12} alignItems="center" flexWrap="wrap">
                <Text typographyStyle="body-sm" priority="secondary">
                    Fee
                </Text>
                <SelectBar
                    options={FEE_OPTIONS}
                    selectedOption={feeChoice}
                    onChange={setFeeChoice}
                    isDisabled={isBusy}
                    data-testid="@phylax/send-fee"
                />
                <Text typographyStyle="body-sm" priority="secondary">
                    {feeRates === undefined && 'Getting fee estimates…'}
                    {feeRates && 'error' in feeRates && `No fee estimate: ${feeRates.error}`}
                    {feeRate !== undefined && `${feeRate} sat/vB`}
                </Text>
            </Row>

            {planned?.kind === 'error' && (
                <Text intent="critical" data-testid="@phylax/send-plan-error">
                    {planned.text}
                </Text>
            )}
            {plan && (
                <Column gap={4} alignItems="stretch" data-testid="@phylax/send-summary">
                    <Text typographyStyle="body-sm">
                        Pay {formatBtc(plan.recipient.amount)} {unit} to {plan.recipient.address}
                    </Text>
                    <Text typographyStyle="body-sm" priority="secondary">
                        Fee {formatBtc(plan.fee)} {unit} ({plan.vsize} vB, {plan.inputs.length}{' '}
                        {plan.inputs.length === 1 ? 'coin' : 'coins'})
                        {plan.change
                            ? `, change ${formatBtc(plan.change.amount)} ${unit} back to this wallet`
                            : ''}
                    </Text>
                    <Text typographyStyle="body-sm-strong">
                        Total {formatBtc(plan.recipient.amount + plan.fee)} {unit}
                    </Text>
                </Column>
            )}

            {blocker && (
                <Text intent="warning" data-testid="@phylax/send-blocker">
                    {blocker}
                </Text>
            )}
            {state.status === 'signing' && (
                <Text data-testid="@phylax/send-steps">
                    {keyBlocks
                        .map(
                            (fingerprint, i) =>
                                `${i + 1}. Confirm on key block ${getFingerprintHex(fingerprint)}`,
                        )
                        .join('  ')}
                    {`  ${keyBlocks.length + 1}. Confirm on the main block`}. Check the address, the
                    amount and the fee on each screen.
                </Text>
            )}
            <Row gap={12} flexWrap="wrap">
                <Button
                    size="large"
                    iconLeft={PaperPlaneTiltIcon}
                    onClick={handleSend}
                    isDisabled={!plan || !!blocker || isDeviceBusy || isBusy}
                    isLoading={isBusy}
                    data-testid="@phylax/send-sign"
                >
                    {state.status === 'broadcasting' ? 'Broadcasting…' : 'Sign on the blocks'}
                </Button>
            </Row>

            {state.status === 'error' && (
                <Text intent="critical" data-testid="@phylax/send-error">
                    {state.text}
                </Text>
            )}
            {state.status === 'sent' && (
                <Column gap={8} alignItems="flex-start" data-testid="@phylax/send-done">
                    <Text>Sent. Transaction id:</Text>
                    <Text isMonospaced typographyStyle="body-sm">
                        <span style={{ wordBreak: 'break-all' }}>{state.txid}</span>
                    </Text>
                    <Button size="small" priority="secondary" onClick={handleCopyTxid}>
                        {state.isCopied ? 'Copied' : 'Copy transaction id'}
                    </Button>
                </Column>
            )}
        </Column>
    );
};
