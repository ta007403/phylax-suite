// PHYLAX Blocks (fork): the fee of a PHYLAX send: Low / Normal / High from the backend's
// estimates, or Custom in sat/vB.

import { Card, Column, Input, Row, SelectBar, Text } from '@trezor/components';

import type { PhylaxFeeChoice } from './phylaxSendForm';
import type { PhylaxFeeRatesState } from './usePhylaxFeeRates';
import type { PhylaxAmountFormat } from '../phylaxAmount';

const FEE_OPTIONS: { label: string; value: PhylaxFeeChoice }[] = [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
    { label: 'Custom', value: 'custom' },
];

type PhylaxFeeCardProps = {
    feeChoice: PhylaxFeeChoice;
    customFeeText: string;
    feeRates: PhylaxFeeRatesState;
    // the rate in use; undefined if none yet or the custom value is invalid
    feeRate: number | undefined;
    // the fee of the current plan
    fee: bigint | undefined;
    vsize: number | undefined;
    amountFormat: PhylaxAmountFormat;
    formatFiat: (satoshis: bigint) => string;
    warnings: string[];
    onFeeChoiceChange: (choice: PhylaxFeeChoice) => void;
    onCustomFeeChange: (text: string) => void;
};

export const PhylaxFeeCard = ({
    feeChoice,
    customFeeText,
    feeRates,
    feeRate,
    fee,
    vsize,
    amountFormat,
    formatFiat,
    warnings,
    onFeeChoiceChange,
    onCustomFeeChange,
}: PhylaxFeeCardProps) => {
    const rates = feeRates && !('error' in feeRates) ? feeRates : undefined;

    return (
        <Card data-testid="@phylax/send/fee">
            <Column gap={12} alignItems="stretch">
                <Row justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={8}>
                    <Text typographyStyle="body-md-strong">Fee</Text>
                    <SelectBar
                        options={FEE_OPTIONS}
                        selectedOption={feeChoice}
                        onChange={onFeeChoiceChange}
                        data-testid="@phylax/send/fee-level"
                    />
                </Row>
                {feeRates === undefined && (
                    <Text typographyStyle="body-sm" priority="secondary">
                        Getting fee estimates…
                    </Text>
                )}
                {feeRates && 'error' in feeRates && (
                    <Text typographyStyle="body-sm" intent="warning">
                        No fee estimate ({feeRates.error}). Choose Custom and enter a fee.
                    </Text>
                )}
                {feeChoice === 'custom' && (
                    <Input
                        label="Fee rate (sat/vB)"
                        value={customFeeText}
                        onChange={event => onCustomFeeChange(event.target.value)}
                        bottomText={
                            rates
                                ? `Estimates: Low ${rates.low}, Normal ${rates.normal}, High ${rates.high} sat/vB`
                                : undefined
                        }
                        data-testid="@phylax/send/fee-custom"
                    />
                )}
                {feeRate !== undefined && (
                    <Row justifyContent="space-between" alignItems="baseline" flexWrap="wrap">
                        <Text typographyStyle="body-sm" priority="secondary">
                            {feeRate} sat/vB{vsize !== undefined ? ` × ${vsize} vB` : ''}
                        </Text>
                        {fee !== undefined && (
                            <Text typographyStyle="body-sm" isTabular>
                                {amountFormat.format(fee)}
                                {formatFiat(fee) && ` · ${formatFiat(fee)}`}
                            </Text>
                        )}
                    </Row>
                )}
                {warnings.map(warning => (
                    <Text key={warning} typographyStyle="body-sm" intent="warning">
                        {warning}
                    </Text>
                ))}
            </Column>
        </Card>
    );
};
