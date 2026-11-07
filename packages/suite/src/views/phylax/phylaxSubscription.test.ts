import { GAP_LIMIT } from './phylaxAccountScan';
import { getPhylaxSubscriptionAccount } from './phylaxSubscription';
import { getPhylaxAddress } from './phylaxWallet';
import { WALLET } from './phylaxWallet.fixture';
import {
    getPhylaxSubscriptionDescriptor,
    phylaxInitialState,
    phylaxReducer,
} from './state/phylaxReducer';

describe('PHYLAX backend subscription', () => {
    it('watches the used addresses and the next unused ones on both chains', () => {
        const used = getPhylaxAddress(WALLET, 'testnet', 0, 0);
        const account = getPhylaxSubscriptionAccount(WALLET, 'testnet', 'testnet:0:2:1,2', {
            usedAddresses: [used],
            nextReceiveIndex: 1,
            nextChangeIndex: 0,
        });
        expect(account.descriptor).toBe('phylax:testnet:0:2:1,2');
        expect(account.addresses?.used.map(a => a.address)).toEqual([used]);
        expect(account.addresses?.unused).toHaveLength(GAP_LIMIT);
        expect(account.addresses?.unused[0]?.address).toBe(
            getPhylaxAddress(WALLET, 'testnet', 0, 1),
        );
        expect(account.addresses?.change[GAP_LIMIT - 1]?.address).toBe(
            getPhylaxAddress(WALLET, 'testnet', 1, GAP_LIMIT - 1),
        );
    });

    it("counts the notifications for a PHYLAX wallet and ignores Suite's own", () => {
        const notify = (descriptor: string) => ({
            type: 'blockchain-notification',
            payload: { coin: {}, notification: { descriptor, tx: {} } },
        });
        let state = phylaxReducer(
            phylaxInitialState,
            notify(getPhylaxSubscriptionDescriptor('mainnet:0:2:1,2')),
        );
        state = phylaxReducer(state, notify(getPhylaxSubscriptionDescriptor('mainnet:0:2:1,2')));
        state = phylaxReducer(
            state,
            notify(
                'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz',
            ),
        );
        expect(state.notifications).toEqual({ 'mainnet:0:2:1,2': 2 });
    });
});
