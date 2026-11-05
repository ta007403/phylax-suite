// PHYLAX Blocks (fork): a saved multisig wallet as a Suite account: header with Receive and Send,
// and the Overview, Receive, Send and Details tabs.

import { useState } from 'react';

import { Card, Column, Tabs, Text } from '@trezor/components';
import type { PROTO } from '@trezor/connect';

import { PhylaxAccountHeader } from './PhylaxAccountHeader';
import { PhylaxDetails } from './PhylaxDetails';
import { PhylaxOverview } from './PhylaxOverview';
import { PhylaxAddressHistory } from '../PhylaxAddressHistory';
import { PhylaxReceive } from '../PhylaxReceive';
import { usePhylaxWakeUp } from '../PhylaxWakeUp';
import { getLockedKeyBlocks, getMainFingerprint, getPhylaxReadiness } from '../phylaxReadiness';
import { type PhylaxNetwork, getPhylaxUnit } from '../phylaxWallet';
import { PhylaxSendPage } from '../send/PhylaxSendPage';
import { usePhylaxAccount } from '../usePhylaxAccount';
import type { PhylaxWalletEntry, RunOnDevice } from '../usePhylaxStack';

export type PhylaxAccountTab = 'overview' | 'receive' | 'send' | 'details';

const TABS: { id: PhylaxAccountTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'receive', label: 'Receive' },
    { id: 'send', label: 'Send' },
    { id: 'details', label: 'Details' },
];

type PhylaxAccountProps = {
    entry: PhylaxWalletEntry;
    network: PhylaxNetwork;
    blocks: PROTO.PhylaxBlockInfo[];
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

export const PhylaxAccount = ({
    entry,
    network,
    blocks,
    runOnDevice,
    isDeviceBusy,
}: PhylaxAccountProps) => {
    const { summary, details } = entry;
    const [tab, setTab] = useState<PhylaxAccountTab>('overview');
    const account = usePhylaxAccount(summary, details !== undefined, network);
    const wakeUp = usePhylaxWakeUp(
        runOnDevice,
        getLockedKeyBlocks(blocks).map(block => block.address),
    );

    const readiness = getPhylaxReadiness(summary.fingerprints, blocks);
    const mainFingerprint = getMainFingerprint(blocks);
    const unit = getPhylaxUnit(network);

    return (
        <Column gap={16} alignItems="stretch" data-testid={`@phylax/account/${summary.slot}`}>
            <PhylaxAccountHeader
                summary={summary}
                network={network}
                readiness={readiness}
                account={account}
                onTabChange={setTab}
            />
            <Tabs activeItemId={tab}>
                {TABS.map(item => (
                    <Tabs.Item
                        key={item.id}
                        id={item.id}
                        onClick={() => setTab(item.id)}
                        data-testid={`@phylax/account/tab/${item.id}`}
                    >
                        {item.label}
                    </Tabs.Item>
                ))}
            </Tabs>

            {tab === 'overview' && <PhylaxOverview account={account} network={network} />}

            {tab === 'receive' && details && (
                <Card>
                    <Column gap={12} alignItems="stretch">
                        <PhylaxReceive
                            wallet={details}
                            network={network}
                            nextIndex={
                                account.status === 'loaded'
                                    ? account.data.nextReceiveIndex
                                    : undefined
                            }
                            isUsageUnknown={account.status === 'error'}
                            mainFingerprint={mainFingerprint}
                            runOnDevice={runOnDevice}
                            isDeviceBusy={isDeviceBusy}
                        />
                        {account.status === 'loaded' && (
                            <PhylaxAddressHistory
                                addresses={account.data.usedReceiveAddresses}
                                unit={unit}
                            />
                        )}
                    </Column>
                </Card>
            )}

            {tab === 'send' &&
                details &&
                (account.status === 'loaded' ? (
                    <PhylaxSendPage
                        wallet={details}
                        network={network}
                        utxos={account.data.utxos}
                        nextChangeIndex={account.data.nextChangeIndex}
                        mainFingerprint={mainFingerprint}
                        missingFingerprints={
                            readiness.isAttachNeeded ? readiness.missingFingerprints : []
                        }
                        lockedKeyBlocks={readiness.lockedInWallet}
                        wakeUp={wakeUp}
                        runOnDevice={runOnDevice}
                        isDeviceBusy={isDeviceBusy}
                        // the spent coins and the new change, now and again a little later
                        onSent={account.refreshAfterSend}
                    />
                ) : (
                    <Text>Checking the blockchain for the wallet&apos;s coins…</Text>
                ))}

            {tab === 'details' && (
                <PhylaxDetails
                    entry={entry}
                    network={network}
                    mainFingerprint={mainFingerprint}
                    runOnDevice={runOnDevice}
                    isDeviceBusy={isDeviceBusy}
                />
            )}

            {!details && <Text priority="secondary">Reading the xpubs from the main block…</Text>}
        </Column>
    );
};
