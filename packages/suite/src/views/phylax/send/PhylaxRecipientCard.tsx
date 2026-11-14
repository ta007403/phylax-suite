// PHYLAX Blocks (fork): one recipient of a PHYLAX send: address (typed or scanned from a QR code,
// as in Suite's own Send), amount in BTC and in the user's currency (linked), and "Send max".

import { useState } from 'react';

import { openDeferredModal, preserveModal } from '@suite/modal';
import { Card, Checkbox, Column, Icon, IconButton, Input, Row, Text } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { QrCodeIcon, TrashIcon } from '@trezor/icons';
import { injectDispatch } from '@trezor/redux-utils';

import { type PhylaxRecipientDraft, readScannedPayment } from './phylaxSendForm';
import type { PhylaxFiat } from './usePhylaxFiat';
import type { PhylaxAmountFormat } from '../phylaxAmount';
import type { PhylaxNetwork } from '../phylaxWallet';

type PhylaxRecipientCardProps = {
    recipient: PhylaxRecipientDraft;
    index: number;
    count: number;
    network: PhylaxNetwork;
    amountFormat: PhylaxAmountFormat;
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
    network,
    amountFormat,
    fiat,
    sendMaxAmount,
    isSendMaxTaken,
    onChange,
    onRemove,
}: PhylaxRecipientCardProps) => {
    const { dispatch } = useServices(injectDispatch);
    const [scanError, setScanError] = useState<string>();
    const testId = `@phylax/send/recipient/${index}`;
    const maxText = sendMaxAmount !== undefined ? amountFormat.formatValue(sendMaxAmount) : '';
    const maxFiatText = sendMaxAmount !== undefined ? fiat.toFiatText(sendMaxAmount) : '';

    const handleAmountChange = (amountText: string) => {
        const amount = amountFormat.parse(amountText);
        onChange({
            ...recipient,
            amountText,
            fiatText: amount !== undefined ? fiat.toFiatText(amount) : '',
        });
    };

    // Suite's QR scanner (camera), as in its own Send: an address, or a "bitcoin:" request whose
    // amount fills the amount too. Kept open: the PHYLAX page talks to the main block every few
    // seconds, and the end of each call would otherwise close it (as in Suite's signing flows).
    const handleScanQr = async () => {
        setScanError(undefined);
        const scanned = dispatch(openDeferredModal({ type: 'qr-reader' }));
        dispatch(preserveModal());
        const text = await scanned;
        if (typeof text !== 'string') return;
        const payment = readScannedPayment(text, network);
        if (!payment.success) {
            setScanError(payment.error);

            return;
        }
        onChange({
            ...recipient,
            address: payment.address,
            ...(payment.amount !== undefined && {
                amountText: amountFormat.formatValue(payment.amount),
                fiatText: fiat.toFiatText(payment.amount),
                isSendMax: false,
            }),
        });
    };

    const handleFiatChange = (fiatText: string) => {
        const amount = fiat.fromFiatText(fiatText);
        onChange({
            ...recipient,
            fiatText,
            amountText: amount !== undefined ? amountFormat.formatValue(amount) : '',
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
                    onChange={event => {
                        setScanError(undefined);
                        onChange({ ...recipient, address: event.target.value });
                    }}
                    rightContent={
                        <Icon
                            as={QrCodeIcon}
                            onClick={handleScanQr}
                            data-testid={`${testId}/scan-qr`}
                        />
                    }
                    bottomText={scanError}
                    hasError={!!scanError}
                    data-testid={`${testId}/address`}
                />
                <Row gap={12} alignItems="flex-start" flexWrap="wrap">
                    <Column flex="1 1 200px" alignItems="stretch">
                        <Input
                            label={`Amount (${amountFormat.unit})`}
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
