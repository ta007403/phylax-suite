// PHYLAX Blocks (fork): the sidebar's Accounts list for a PHYLAX main block: its saved multisig
// wallets, one per enabled Bitcoin network, instead of the main block's own single-key accounts.

import { selectRouteName } from '@suite/router';
import { selectEnabledNetworks } from '@suite-common/wallet-core';
import { Column, Divider, Text } from '@trezor/components';

import { ExpandedSidebarOnly } from 'src/components/suite/layouts/SuiteLayout/Sidebar/ExpandedSidebarOnly';
import { useSelector } from 'src/hooks/suite';

import { PhylaxAccountItem } from './PhylaxAccountItem';
import { type PhylaxNetwork, getPhylaxNetworkSymbol } from '../phylaxWallet';
import {
    selectPhylaxIsLoaded,
    selectPhylaxSelectedAccount,
    selectPhylaxWallets,
} from '../state/phylaxReducer';

const NETWORKS: PhylaxNetwork[] = ['mainnet', 'testnet'];

export const PhylaxAccountsMenu = () => {
    const wallets = useSelector(selectPhylaxWallets);
    const isLoaded = useSelector(selectPhylaxIsLoaded);
    const enabledNetworks = useSelector(selectEnabledNetworks);
    const selectedAccount = useSelector(selectPhylaxSelectedAccount);
    const routeName = useSelector(selectRouteName);

    const networks = NETWORKS.filter(network =>
        enabledNetworks.includes(getPhylaxNetworkSymbol(network)),
    );
    const isAccountPageOpen = routeName === 'phylax-account';

    return (
        <Column alignItems="stretch" gap={4} padding={{ horizontal: 8, bottom: 20 }}>
            <Divider margin={{ top: 0, bottom: 8 }} />
            <ExpandedSidebarOnly>
                <Text typographyStyle="body-sm" priority="secondary" margin={{ left: 8 }}>
                    PHYLAX accounts
                </Text>
                {!isLoaded && (
                    <Text typographyStyle="body-sm" margin={{ left: 8, top: 8 }}>
                        Asking the main block…
                    </Text>
                )}
                {isLoaded && wallets.length > 0 && networks.length === 0 && (
                    <Text
                        typographyStyle="body-sm"
                        priority="secondary"
                        margin={{ left: 8, top: 8 }}
                    >
                        Turn on Bitcoin in Settings › Coins to see your multisig wallets here.
                    </Text>
                )}
                {isLoaded && wallets.length === 0 && (
                    <Text
                        typographyStyle="body-sm"
                        priority="secondary"
                        margin={{ left: 8, top: 8 }}
                    >
                        No multisig wallets yet: snap a key block onto the main block.
                    </Text>
                )}
            </ExpandedSidebarOnly>
            {networks.flatMap(network =>
                wallets.map(entry => (
                    <PhylaxAccountItem
                        key={`${network}:${entry.summary.slot}`}
                        entry={entry}
                        network={network}
                        isSelected={
                            isAccountPageOpen &&
                            selectedAccount?.slot === entry.summary.slot &&
                            selectedAccount.network === network
                        }
                    />
                )),
            )}
        </Column>
    );
};
