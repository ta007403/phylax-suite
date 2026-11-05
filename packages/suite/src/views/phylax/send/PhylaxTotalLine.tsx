// PHYLAX Blocks (fork): one line of a PHYLAX send's totals: BTC, and below it the user's currency.

import { Column, Row, Text } from '@trezor/components';

import { formatBtc } from '../phylaxSend';

export type PhylaxTotalLineProps = {
    label: string;
    satoshis: bigint;
    unit: string;
    formatFiat: (satoshis: bigint) => string;
    isStrong?: boolean;
};

export const PhylaxTotalLine = ({
    label,
    satoshis,
    unit,
    formatFiat,
    isStrong,
}: PhylaxTotalLineProps) => (
    <Row justifyContent="space-between" alignItems="flex-start" gap={12}>
        <Text typographyStyle={isStrong ? 'body-md-strong' : 'body-sm'} priority="secondary">
            {label}
        </Text>
        <Column alignItems="flex-end" gap={2}>
            <Text typographyStyle={isStrong ? 'body-md-strong' : 'body-sm'} isTabular>
                {formatBtc(satoshis)} {unit}
            </Text>
            {formatFiat(satoshis) && (
                <Text typographyStyle="body-xs" priority="secondary" isTabular>
                    {formatFiat(satoshis)}
                </Text>
            )}
        </Column>
    </Row>
);
