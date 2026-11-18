import { createMigration } from '@suite/idb-migration-utils';
import { initialWalletSettingsState } from '@suite-common/wallet-core';

import { type SuiteDBSchema } from 'src/storage/definitions';

import { updateAll } from '../utils';

type OldSuiteSettingsType = { autoEject?: boolean };
type OldWalletSettingsType = { autoForgetDeviceData?: boolean };

export default createMigration<SuiteDBSchema>('25.11.0', async (db, tx) => {
    const getSuiteSettings = async () => {
        if (!db.objectStoreNames.contains('suiteSettings')) return undefined;
        const suiteStore = tx.objectStore('suiteSettings');
        const suite = await suiteStore.get('suite');

        return suite?.settings as OldSuiteSettingsType | undefined;
    };

    const suiteSettings = await getSuiteSettings();
    const prevAutoEjectValue = suiteSettings?.autoEject === true;
    const walletSettingsStore = tx.objectStore('walletSettings');
    const hasAnyWalletSettings = (await walletSettingsStore.count()) > 0;

    if (!hasAnyWalletSettings) {
        // PHYLAX Blocks (fork): a new install (no settings of any kind yet) keeps the reducer's
        // defaults, e.g. auto-eject on. Writing "off" here (no previous value) overrode them.
        if (suiteSettings === undefined) return;

        await walletSettingsStore.put(
            {
                ...initialWalletSettingsState,
                isAutoEjectEnabled: prevAutoEjectValue,
            },
            'wallet',
        );

        return;
    }

    await updateAll(tx, 'walletSettings', walletSettings => {
        delete (walletSettings as OldWalletSettingsType).autoForgetDeviceData;

        return {
            ...walletSettings,
            isAutoEjectEnabled: prevAutoEjectValue,
        };
    });
});
