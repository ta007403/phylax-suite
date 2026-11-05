// PHYLAX Blocks (fork): one recipient of a PHYLAX send: address, amount in BTC and in the user's
// currency (linked), and "Send max".

import { Card, Checkbox, Column, IconButton, Input, Row, Text } from '@trezor/components';
import { TrashIcon } from '@trezor/icons';

import type { PhylaxRecipientDraft } from './phylaxSendForm';
import type { PhylaxFiat } from './usePhylaxFiat';
import { formatBtc, parseBtc } from '../phylaxSend';

type PhylaxRecipientCardProps = {
    recipient: PhylaxRecipientDraft;
    index: number;
    count: number;
    unit: string;
    fiat: PhylaxFiat;
    // the amount the plan gives a send-max recipient
    sendMaxAmount: bigint | undefined;
    // another recipient already gets the maximum
    isSendMaxTaken: boolean;
    onChange: (recipient: PhylaxRecipientDraft) => void;
    onRemove: () => void;
};

export const PhylaxRecipientCard = ({
    recipient,
    index,
    count,
    unit,
    fiat,
    sendMaxAmount,
    isSendMaxTaken,
    onChange,
    onRemove,
}: PhylaxRecipientCardProps) => {
    const testId = `@phylax/send/recipient/${index}`;
    const maxText = sendMaxAmount !== undefined ? formatBtc(sendMaxAmount) : '';
    const maxFiatText = sendMaxAmount !== undefined ? fiat.toFiatText(sendMaxAmount) : '';

    const handleAmountChange = (amountText: string) => {
        const amount = parseBtc(amountText);
        onChange({
            ...recipient,
            amountText,
            fiatText: amount !== undefined ? fiat.toFiatText(amount) : '',
        });
    };

    const handleFiatChange = (fiatText: string) => {
        const amount = fiat.fromFiatText(fiatText);
        onChange({
            ...recipient,
            fiatText,
            amountText: amount !== undefined ? formatBtc(amount) : '',
        });
    };

    return (
        <Card data-testid={testId}>
            <Column gap={12} alignItems="stretch">
                <Row justifyContent="space-between" alignItems="center">
                    <Text typographyStyle="body-md-strong">
                        {count > 1 ? `Recipient ${index + 1}` : 'To'}
                    </Text>
                    {count > 1 && (
                        <IconButton
                            icon={TrashIcon}
                            size="small"
                            priority="secondary"
                            onClick={onRemove}
                            tooltip={{ content: 'Remove recipient' }}
                            aria-label="Remove recipient"
                            data-testid={`${testId}/remove`}
                        />
                    )}
                </Row>
                <Input
                    label="Address"
                    value={recipient.address}
                    onChange={event => onChange({ ...recipient, address: event.target.value })}
                    data-testid={`${testId}/address`}
                />
                <Row gap={12} alignItems="flex-start" flexWrap="wrap">
                    <Column flex="1 1 200px" alignItems="stretch">
                        <Input
                            label={`Amount (${unit})`}
                            value={recipient.isSendMax ? maxText : recipient.amountText}
                            onChange={event => handleAmountChange(event.target.value)}
                            isDisabled={recipient.isSendMax}
                            data-testid={`${testId}/amount`}
                        />
                    </Column>
                    {fiat.rate !== undefined && (
                        <Column flex="1 1 160px" alignItems="stretch">
                            <Input
                                label={fiat.currency}
                                value={recipient.isSendMax ? maxFiatText : recipient.fiatText}
                                onChange={event => handleFiatChange(event.target.value)}
                                isDisabled={recipient.isSendMax}
                                data-testid={`${testId}/fiat`}
                            />
                        </Column>
                    )}
                </Row>
                <Checkbox
                    isChecked={recipient.isSendMax}
                    onChange={() => onChange({ ...recipient, isSendMax: !recipient.isSendMax })}
                    isDisabled={isSendMaxTaken && !recipient.isSendMax}
                    data-testid={`${testId}/send-max`}
                >
                    Send max
                    {count > 1 ? ' (everything left after the other recipients and the fee)' : ''}
                </Checkbox>
            </Column>
        </Card>
    );
};
