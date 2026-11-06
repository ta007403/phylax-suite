// PHYLAX Blocks (fork): Speed up a pending payment of a PHYLAX wallet: a higher fee for the same
// coins and recipients (see phylaxBump.ts), reviewed and signed like a payment.

import { useMemo, useState } from 'react';

import { Button, Card, Column, H3, Row, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { PhylaxFeeCard } from './PhylaxFeeCard';
import { PhylaxSendReview } from './PhylaxSendReview';
import { getPhylaxSignBlocker } from './getPhylaxSignBlocker';
import { type PhylaxFeeChoice, parseFeeRate } from './phylaxSendForm';
import { type PhylaxFeeLevel, usePhylaxFeeRates } from './usePhylaxFeeRates';
import { usePhylaxFiat } from './usePhylaxFiat';
import { type PhylaxWakeUp, WakeUpButton } from '../PhylaxWakeUp';
import type { PhylaxTransaction, PhylaxUtxo } from '../phylaxAccountScan';
import { type PhylaxBumpPlan, getOriginalFeeRate, planPhylaxBump } from '../phylaxBump';
import type { PhylaxNetwork } from '../phylaxWallet';
import { usePhylaxAmountFormat } from '../usePhylaxAmountFormat';
import type { RunOnDevice } from '../usePhylaxStack';

const FEE_LEVELS: PhylaxFeeLevel[] = ['low', 'normal', 'high'];

type PhylaxSpeedUpProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    // undefined once it is no longer pending (confirmed or replaced)
    transaction: PhylaxTransaction | undefined;
    utxos: PhylaxUtxo[];
    nextChangeIndex: number;
    mainFingerprint: number | undefined;
    missingFingerprints: number[];
    lockedKeyBlocks: PROTO.PhylaxBlockInfo[];
    wakeUp: PhylaxWakeUp;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
    onClose: () => void;
    onSent: () => void;
};

export const PhylaxSpeedUp = ({
    wallet,
    network,
    transaction,
    utxos,
    nextChangeIndex,
    mainFingerprint,
    missingFingerprints,
    lockedKeyBlocks,
    wakeUp,
    runOnDevice,
    isDeviceBusy,
    onClose,
    onSent,
}: PhylaxSpeedUpProps) => {
    const feeRates = usePhylaxFeeRates(network);
    const fiat = usePhylaxFiat(network);
    const amountFormat = usePhylaxAmountFormat(network);
    const [chosenFee, setChosenFee] = useState<PhylaxFeeChoice>();
    const [customFeeText, setCustomFeeText] = useState('');
    // fixed once reviewed, so a refresh cannot change it while it is signed
    const [review, setReview] = useState<{ plan: PhylaxBumpPlan; feeRate: number }>();

    const originalFeeRate = transaction ? getOriginalFeeRate(transaction, wallet) : undefined;
    const rates = feeRates && !('error' in feeRates) ? feeRates : undefined;
    // the first estimate above the current rate, else Custom
    const defaultChoice: PhylaxFeeChoice =
        FEE_LEVELS.find(
            level => rates && originalFeeRate !== undefined && rates[level] > originalFeeRate,
        ) ?? 'custom';
    const feeChoice = chosenFee ?? defaultChoice;
    const feeRate = feeChoice === 'custom' ? parseFeeRate(customFeeText) : rates?.[feeChoice];

    const planned = useMemo(
        () =>
            transaction && feeRate !== undefined
                ? planPhylaxBump(
                      wallet,
                      network,
                      transaction,
                      utxos,
                      nextChangeIndex,
                      feeRate,
                      amountFormat.format,
                  )
                : undefined,
        [wallet, network, transaction, utxos, nextChangeIndex, feeRate, amountFormat],
    );
    const plan = planned?.kind === 'plan' ? planned.plan : undefined;
    const blocker = getPhylaxSignBlocker(missingFingerprints, lockedKeyBlocks.length);

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
                title="Review the faster payment"
                onBack={() => setReview(undefined)}
                onSent={onSent}
                onNewPayment={onClose}
            />
        );
    }

    if (!transaction?.pending) {
        return (
            <Card>
                <Column gap={12} alignItems="flex-start">
                    <Text>This payment is no longer pending: nothing to speed up.</Text>
                    <Button size="small" priority="secondary" onClick={onClose}>
                        Back
                    </Button>
                </Column>
            </Card>
        );
    }

    return (
        <Column gap={12} alignItems="stretch" data-testid="@phylax/speed-up">
            <Card>
                <Column gap={8} alignItems="stretch">
                    <H3>Speed up</H3>
                    <Text typographyStyle="body-sm" priority="secondary">
                        Sends the same payment again with a higher fee. The network keeps the new
                        one and drops the pending one. Current fee:{' '}
                        {amountFormat.format(transaction.fee)}
                        {originalFeeRate !== undefined && ` (${originalFeeRate.toFixed(2)} sat/vB)`}
                        .
                    </Text>
                </Column>
            </Card>
            <PhylaxFeeCard
                feeChoice={feeChoice}
                customFeeText={customFeeText}
                feeRates={feeRates}
                feeRate={feeRate}
                fee={plan?.fee}
                vsize={plan?.vsize}
                amountFormat={amountFormat}
                formatFiat={fiat.format}
                warnings={[]}
                onFeeChoiceChange={choice => {
                    if (choice === 'custom' && !customFeeText && originalFeeRate !== undefined) {
                        setCustomFeeText(String(Math.floor(originalFeeRate) + 1));
                    }
                    setChosenFee(choice);
                }}
                onCustomFeeChange={text => {
                    // typed before the estimates arrived: keep Custom once they do
                    setChosenFee('custom');
                    setCustomFeeText(text);
                }}
            />
            <Card data-testid="@phylax/speed-up/summary">
                <Column gap={8} alignItems="stretch">
                    {plan && (
                        <>
                            <Text>
                                New fee: {amountFormat.format(plan.fee)} (was{' '}
                                {amountFormat.format(plan.originalFee)}).
                            </Text>
                            {plan.change && (
                                <Text typographyStyle="body-sm" priority="secondary">
                                    Change back to this wallet:{' '}
                                    {amountFormat.format(plan.change.amount)}
                                </Text>
                            )}
                            {plan.addedInputs > 0 && (
                                <Text typographyStyle="body-sm" priority="secondary">
                                    Adds {plan.addedInputs} more{' '}
                                    {plan.addedInputs === 1 ? 'coin' : 'coins'} of this wallet to
                                    pay the higher fee.
                                </Text>
                            )}
                            {plan.decreasedRecipient && (
                                <Text intent="warning" data-testid="@phylax/speed-up/decreased">
                                    The recipient gets less:{' '}
                                    {amountFormat.format(plan.decreasedRecipient.to)} instead of{' '}
                                    {amountFormat.format(plan.decreasedRecipient.from)}. There is no
                                    change and no other coin to pay the higher fee.
                                </Text>
                            )}
                        </>
                    )}
                    {planned?.kind === 'error' && (
                        <Text intent="critical" data-testid="@phylax/speed-up/error">
                            {planned.text}
                        </Text>
                    )}
                    {blocker && <Text intent="warning">{blocker}</Text>}
                    <Row gap={8} justifyContent="space-between" flexWrap="wrap">
                        <Button priority="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (plan && feeRate !== undefined) setReview({ plan, feeRate });
                            }}
                            isDisabled={!plan || !!blocker || isDeviceBusy}
                            data-testid="@phylax/speed-up/review"
                        >
                            Review & speed up
                        </Button>
                    </Row>
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
            </Card>
        </Column>
    );
};
