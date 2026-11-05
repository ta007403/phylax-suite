// PHYLAX Blocks (fork): coin control: off, the coins are picked automatically (largest first);
// on, exactly the ticked coins are spent. Unconfirmed coins are listed but cannot be ticked.

import { Card, Checkbox, Column, Row, Switch, Text } from '@trezor/components';

import { type PhylaxUtxo } from '../phylaxAccountScan';
import { MIN_CONFIRMATIONS, PHYLAX_MAX_INPUTS, formatBtc, getCoinId } from '../phylaxSend';

type PhylaxCoinControlProps = {
    utxos: PhylaxUtxo[];
    isEnabled: boolean;
    coinIds: string[];
    // coins the current plan spends (shown when coin control is off)
    plannedCoinIds: string[];
    unit: string;
    formatFiat: (satoshis: bigint) => string;
    onToggle: () => void;
    onCoinIdsChange: (coinIds: string[]) => void;
};

export const PhylaxCoinControl = ({
    utxos,
    isEnabled,
    coinIds,
    plannedCoinIds,
    unit,
    formatFiat,
    onToggle,
    onCoinIdsChange,
}: PhylaxCoinControlProps) => {
    const sorted = [...utxos].sort((a, b) => Number(b.value - a.value));
    const selectedTotal = utxos
        .filter(utxo => coinIds.includes(getCoinId(utxo)))
        .reduce((sum, utxo) => sum + utxo.value, 0n);

    const toggleCoin = (coinId: string) =>
        onCoinIdsChange(
            coinIds.includes(coinId) ? coinIds.filter(id => id !== coinId) : [...coinIds, coinId],
        );

    return (
        <Card data-testid="@phylax/send/coin-control">
            <Column gap={12} alignItems="stretch">
                <Row justifyContent="space-between" alignItems="center">
                    <Column gap={2} alignItems="flex-start">
                        <Text typographyStyle="body-md-strong">Coin control</Text>
                        <Text typographyStyle="body-sm" priority="secondary">
                            {isEnabled
                                ? `${coinIds.length} chosen: ${formatBtc(selectedTotal)} ${unit}. All of them are spent.`
                                : 'Off: the largest confirmed coins are used.'}
                        </Text>
                    </Column>
                    <Switch
                        isChecked={isEnabled}
                        onChange={onToggle}
                        data-testid="@phylax/send/coin-control-switch"
                    />
                </Row>
                {sorted.map(utxo => {
                    const coinId = getCoinId(utxo);
                    const isConfirmed = utxo.confirmations >= MIN_CONFIRMATIONS;
                    const isChecked = isEnabled
                        ? coinIds.includes(coinId)
                        : plannedCoinIds.includes(coinId);

                    return (
                        <Row key={coinId} gap={12} alignItems="center">
                            <Checkbox
                                isChecked={isChecked}
                                onChange={() => toggleCoin(coinId)}
                                isDisabled={!isEnabled || !isConfirmed}
                                data-testid={`@phylax/send/coin/${coinId}`}
                            >
                                <Column gap={2} alignItems="flex-start">
                                    <Text typographyStyle="body-sm" isTabular>
                                        {formatBtc(utxo.value)} {unit}
                                        {formatFiat(utxo.value) && ` · ${formatFiat(utxo.value)}`}
                                    </Text>
                                    <Text typographyStyle="body-xs" priority="secondary">
                                        {utxo.chain === 0 ? 'Receive' : 'Change'} address #
                                        {utxo.index} ·{' '}
                                        {isConfirmed
                                            ? `${utxo.confirmations} confirmations`
                                            : 'Pending, cannot be spent yet'}{' '}
                                        · {utxo.txid.slice(0, 8)}…:{utxo.vout}
                                    </Text>
                                </Column>
                            </Checkbox>
                        </Row>
                    );
                })}
                {isEnabled && coinIds.length > PHYLAX_MAX_INPUTS && (
                    <Text typographyStyle="body-sm" intent="warning">
                        The main block signs at most {PHYLAX_MAX_INPUTS} coins at once.
                    </Text>
                )}
            </Column>
        </Card>
    );
};
