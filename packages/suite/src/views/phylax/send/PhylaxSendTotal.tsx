// PHYLAX Blocks (fork): the Total panel of a PHYLAX send: amount, fee, total, and Review & send.

import { Button, Card, Column, Divider, Text } from '@trezor/components';

import { PhylaxTotalLine } from './PhylaxTotalLine';
import type { PhylaxSendPlan } from '../phylaxSend';
import { formatBtc } from '../phylaxSend';

type PhylaxSendTotalProps = {
    plan: PhylaxSendPlan | undefined;
    planError: string | undefined;
    // why signing is not possible right now (a key block missing or locked)
    blocker: string | undefined;
    unit: string;
    formatFiat: (satoshis: bigint) => string;
    isDisabled: boolean;
    onReview: () => void;
};

export const PhylaxSendTotal = ({
    plan,
    planError,
    blocker,
    unit,
    formatFiat,
    isDisabled,
    onReview,
}: PhylaxSendTotalProps) => {
    const amount = plan?.recipients.reduce((sum, recipient) => sum + recipient.amount, 0n);

    return (
        <Card data-testid="@phylax/send/total">
            <Column gap={12} alignItems="stretch">
                <Text typographyStyle="body-md-strong">Total</Text>
                {plan && amount !== undefined ? (
                    <>
                        <PhylaxTotalLine
                            label="Amount"
                            satoshis={amount}
                            unit={unit}
                            formatFiat={formatFiat}
                        />
                        <PhylaxTotalLine
                            label="Fee"
                            satoshis={plan.fee}
                            unit={unit}
                            formatFiat={formatFiat}
                        />
                        <Divider margin={{ top: 0, bottom: 0 }} />
                        <PhylaxTotalLine
                            label="Total spent"
                            satoshis={amount + plan.fee}
                            unit={unit}
                            formatFiat={formatFiat}
                            isStrong
                        />
                        <Text typographyStyle="body-xs" priority="secondary">
                            {plan.inputs.length} {plan.inputs.length === 1 ? 'coin' : 'coins'}
                            {plan.change
                                ? `, ${formatBtc(plan.change.amount)} ${unit} change back to this wallet`
                                : ', no change'}
                        </Text>
                    </>
                ) : (
                    <Text typographyStyle="body-sm" priority="secondary">
                        Fill in the address and the amount.
                    </Text>
                )}
                {planError && (
                    <Text
                        typographyStyle="body-sm"
                        intent="critical"
                        data-testid="@phylax/send/plan-error"
                    >
                        {planError}
                    </Text>
                )}
                {blocker && (
                    <Text
                        typographyStyle="body-sm"
                        intent="warning"
                        data-testid="@phylax/send/blocker"
                    >
                        {blocker}
                    </Text>
                )}
                <Button
                    size="large"
                    onClick={onReview}
                    isDisabled={!plan || !!blocker || isDisabled}
                    data-testid="@phylax/send/review"
                >
                    Review & send
                </Button>
            </Column>
        </Card>
    );
};
