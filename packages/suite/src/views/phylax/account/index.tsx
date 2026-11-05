import { Text } from '@trezor/components';

import { PageHeader } from 'src/components/suite/layouts/SuiteLayout';
import { BasicName } from 'src/components/suite/layouts/SuiteLayout/PageHeader/PageNames/BasicName';
import { useLayout, useSelector } from 'src/hooks/suite';

import { PhylaxAccount } from './PhylaxAccount';
import { selectPhylaxSelectedAccount } from '../state/phylaxReducer';
import { usePhylaxStack } from '../usePhylaxStack';

// PHYLAX Blocks (fork): the account page of one saved multisig wallet, opened from the sidebar.
const PhylaxAccountView = () => {
    const selectedAccount = useSelector(selectPhylaxSelectedAccount);
    const stack = usePhylaxStack();
    const entry = stack.wallets.find(wallet => wallet.summary.slot === selectedAccount?.slot);

    useLayout(
        'PHYLAX account',
        <PageHeader>
            <BasicName>{entry?.summary.name ?? 'PHYLAX account'}</BasicName>
        </PageHeader>,
    );

    if (!stack.isLoaded) return null;
    if (!entry || !selectedAccount) {
        return (
            <Text priority="secondary">
                This wallet is not on the connected main block. Choose an account in the sidebar.
            </Text>
        );
    }

    return (
        <PhylaxAccount
            key={`${selectedAccount.network}:${entry.summary.slot}`}
            entry={entry}
            network={selectedAccount.network}
            blocks={stack.blocks}
            runOnDevice={stack.runOnDevice}
            isDeviceBusy={stack.isPaused}
        />
    );
};

export default PhylaxAccountView;
