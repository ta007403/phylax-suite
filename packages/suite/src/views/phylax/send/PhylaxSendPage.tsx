// PHYLAX Blocks (fork): the Send page of a PHYLAX account, in the style of Suite's own: recipients
// (address, amount in BTC and the user's currency, send max), + Add recipient, coin control, fee
// (Low / Normal / High / Custom), the Total panel, then Review & send.

import { useMemo, useState } from 'react';

import { Button, Column, Row } from '@trezor/components';
import type { PROTO } from '@trezor/connect';
import { PlusIcon } from '@trezor/icons';

import { PhylaxCoinControl } from './PhylaxCoinControl';
import { PhylaxFeeCard } from './PhylaxFeeCard';
import { PhylaxRecipientCard } from './PhylaxRecipientCard';
import { PhylaxSendReview } from './PhylaxSendReview';
import { PhylaxSendTotal } from './PhylaxSendTotal';
import { getPhylaxSignBlocker } from './getPhylaxSignBlocker';
import {
    type PhylaxFeeChoice,
    type PhylaxRecipientDraft,
    createRecipientDraft,
    getCustomFeeWarnings,
    getSendRequest,
    parseFeeRate,
} from './phylaxSendForm';
import { usePhylaxFeeRates } from './usePhylaxFeeRates';
import { usePhylaxFiat } from './usePhylaxFiat';
import { type PhylaxWakeUp, WakeUpButton } from '../PhylaxWakeUp';
import type { PhylaxUtxo } from '../phylaxAccountScan';
import { type PhylaxSendPlan, getCoinId, planPhylaxSend } from '../phylaxSend';
import type { PhylaxNetwork } from '../phylaxWallet';
import { usePhylaxAmountFormat } from '../usePhylaxAmountFormat';
import type { RunOnDevice } from '../usePhylaxStack';

const TOTAL_PANEL_WIDTH = 340;

type PhylaxSendPageProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    utxos: PhylaxUtxo[];
    nextChangeIndex: number;
    mainFingerprint: number | undefined;
    // key blocks of this wallet that are not attached, or attached but locked
    missingFingerprints: number[];
    lockedKeyBlocks: PROTO.PhylaxBlockInfo[];
    wakeUp: PhylaxWakeUp;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
    onSent: () => void;
};

export const PhylaxSendPage = ({
    wallet,
    network,
    utxos,
    nextChangeIndex,
    mainFingerprint,
    missingFingerprints,
    lockedKeyBlocks,
    wakeUp,
    runOnDevice,
    isDeviceBusy,
    onSent,
}: PhylaxSendPageProps) => {
    const [recipients, setRecipients] = useState<PhylaxRecipientDraft[]>([createRecipientDraft(1)]);
    const [nextRecipientId, setNextRecipientId] = useState(2);
    const [feeChoice, setFeeChoice] = useState<PhylaxFeeChoice>('normal');
    const [customFeeText, setCustomFeeText] = useState('');
    const [isCoinControl, setIsCoinControl] = useState(false);
    const [coinIds, setCoinIds] = useState<string[]>([]);
    // the plan as reviewed: fixed, so a background refresh cannot change it while it is signed
    const [review, setReview] = useState<{ plan: PhylaxSendPlan; feeRate: number }>();
    const feeRates = usePhylaxFeeRates(network);
    const fiat = usePhylaxFiat(network);

    const amountFormat = usePhylaxAmountFormat(network);
    const rates = feeRates && !('error' in feeRates) ? feeRates : undefined;
    const feeRate = feeChoice === 'custom' ? parseFeeRate(customFeeText) : rates?.[feeChoice];

    const request = useMemo(
        () =>
            getSendRequest(
                recipients,
                feeRate,
                isCoinControl ? coinIds : undefined,
                amountFormat.parse,
            ),
        [recipients, feeRate, isCoinControl, coinIds, amountFormat],
    );
    const planned = useMemo(
        () =>
            request && !('error' in request)
                ? planPhylaxSend(
                      wallet,
                      network,
                      utxos,
                      nextChangeIndex,
                      request,
                      amountFormat.format,
                  )
                : undefined,
        [wallet, network, utxos, nextChangeIndex, request, amountFormat],
    );
    const plan = planned?.kind === 'plan' ? planned.plan : undefined;

    const sendMaxIndex = recipients.findIndex(recipient => recipient.isSendMax);
    const amount = plan?.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);
    const feeWarnings =
        feeChoice === 'custom' && feeRate !== undefined
            ? getCustomFeeWarnings({ feeRate, highRate: rates?.high, fee: plan?.fee, amount })
            : [];
    let planError: string | undefined;
    if (request && 'error' in request) planError = request.error;
    else if (planned?.kind === 'error') planError = planned.text;
    else if (feeChoice === 'custom' && customFeeText.trim() && feeRate === undefined) {
        planError = 'Enter the fee rate as a number of sat/vB, for example 2 or 1.5.';
    }
    const blocker = getPhylaxSignBlocker(missingFingerprints, lockedKeyBlocks.length);

    const updateRecipient = (updated: PhylaxRecipientDraft) =>
        setRecipients(previous =>
            previous.map(recipient => (recipient.id === updated.id ? updated : recipient)),
        );
    const addRecipient = () => {
        setRecipients(previous => [...previous, createRecipientDraft(nextRecipientId)]);
        setNextRecipientId(id => id + 1);
    };
    const removeRecipient = (id: number) =>
        setRecipients(previous => previous.filter(recipient => recipient.id !== id));
    const toggleCoinControl = () => {
        // start from the coins the automatic choice would spend
        if (!isCoinControl) setCoinIds(plan ? plan.inputs.map(getCoinId) : []);
        setIsCoinControl(value => !value);
    };
    const startNewPayment = () => {
        setRecipients([createRecipientDraft(nextRecipientId)]);
        setNextRecipientId(id => id + 1);
        setCoinIds([]);
        setIsCoinControl(false);
        setReview(undefined);
    };

    if (review) {
        return (
            <PhylaxSendReview
                wallet={wallet}
                network={network}
                plan={review.plan}
                feeRate={review.feeRate}
                amountFormat={amountFormat}
                formatFiat={fiat.format}
                mainFingerprint={mainFingerprint}
                runOnDevice={runOnDevice}
                isDeviceBusy={isDeviceBusy}
                onBack={() => setReview(undefined)}
                onSent={onSent}
                onNewPayment={startNewPayment}
            />
        );
    }

    return (
        <Row gap={16} alignItems="flex-start" flexWrap="wrap" data-testid="@phylax/send">
            <Column gap={12} alignItems="stretch" flex="1 1 420px">
                {recipients.map((recipient, index) => (
                    <PhylaxRecipientCard
                        key={recipient.id}
                        recipient={recipient}
                        index={index}
                        count={recipients.length}
                        network={network}
                        amountFormat={amountFormat}
                        fiat={fiat}
                        sendMaxAmount={
                            recipient.isSendMax ? plan?.recipients[index]?.amount : undefined
                        }
                        isSendMaxTaken={sendMaxIndex >= 0 && sendMaxIndex !== index}
                        onChange={updateRecipient}
                        onRemove={() => removeRecipient(recipient.id)}
                    />
                ))}
                <Row>
                    <Button
                        priority="secondary"
                        size="small"
                        iconLeft={PlusIcon}
                        onClick={addRecipient}
                        data-testid="@phylax/send/add-recipient"
                    >
                        Add recipient
                    </Button>
                </Row>
                <PhylaxFeeCard
                    feeChoice={feeChoice}
                    customFeeText={customFeeText}
                    feeRates={feeRates}
                    feeRate={feeRate}
                    fee={plan?.fee}
                    vsize={plan?.vsize}
                    amountFormat={amountFormat}
                    formatFiat={fiat.format}
                    warnings={feeWarnings}
                    onFeeChoiceChange={choice => {
                        // Custom starts from the rate chosen so far
                        if (choice === 'custom' && !customFeeText && feeRate !== undefined) {
                            setCustomFeeText(String(feeRate));
                        }
                        setFeeChoice(choice);
                    }}
                    onCustomFeeChange={setCustomFeeText}
                />
                <PhylaxCoinControl
                    utxos={utxos}
                    isEnabled={isCoinControl}
                    coinIds={coinIds}
                    plannedCoinIds={plan ? plan.inputs.map(getCoinId) : []}
                    amountFormat={amountFormat}
                    formatFiat={fiat.format}
                    onToggle={toggleCoinControl}
                    onCoinIdsChange={setCoinIds}
                />
            </Column>
            <Column gap={12} alignItems="stretch" flex={`0 1 ${TOTAL_PANEL_WIDTH}px`}>
                <PhylaxSendTotal
                    plan={plan}
                    planError={planError}
                    blocker={blocker}
                    amountFormat={amountFormat}
                    formatFiat={fiat.format}
                    isDisabled={isDeviceBusy}
                    onReview={() => {
                        if (plan && feeRate !== undefined) setReview({ plan, feeRate });
                    }}
                />
                {missingFingerprints.length === 0 &&
                    lockedKeyBlocks.map(block => (
                        <WakeUpButton
                            key={block.address}
                            address={block.address}
                            wakeUp={wakeUp}
                            isDeviceBusy={isDeviceBusy}
                        />
                    ))}
            </Column>
        </Row>
    );
};
