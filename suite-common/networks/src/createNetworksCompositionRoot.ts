import type { Dispatch } from '@reduxjs/toolkit';

import type { NetworkSuiteCommonModuleApi } from '@trezor/network-module-suite-common-types';

import { createNetworkModuleRepository } from './NetworkModuleRepository';
import type { NetworksServices } from './NetworksServices';
import { createAddressValidator } from './createAddressValidator';
import { createGetAccountSyncInterval } from './createGetAccountSyncInterval';
import { createGetIconPaths } from './createGetIconPaths';
import { createGetNamedAddressSupport } from './createGetNamedAddressSupport';
import { createGetNetworkByCoingeckoId } from './createGetNetworkByCoingeckoId';
import { createGetNetworkConfig } from './createGetNetworkConfig';
import { createGetNetworkConfigs } from './createGetNetworkConfigs';
import { createIsWrappedNativeToken } from './createIsWrappedNativeToken';
import { createLoadNetworkModules } from './createLoadNetworkModules';
import { createNetworkIcon } from './createNetworkIcon';
import { createNetworkModulesCompositionRoot } from './createNetworkModulesCompositionRoot';

const PHYLAX_NETWORK_SYMBOLS: readonly string[] = ['btc', 'test', 'regtest'];

export type NetworksCompositionRootDeps = NetworkSuiteCommonModuleApi & { dispatch: Dispatch };

export const createNetworksCompositionRoot = (
    deps: NetworksCompositionRootDeps,
): NetworksServices => {
    const networkModules = createNetworkModulesCompositionRoot(deps);
    const networkModuleRepository = createNetworkModuleRepository({ networkModules });
    const getNetworkConfig = createGetNetworkConfig({ networkModuleRepository });
    const getAllNetworkConfigs = createGetNetworkConfigs({
        getNetworkConfig,
        networkModuleRepository,
    });
    // PHYLAX Blocks (fork): a Bitcoin-only app; only these networks reach the app's state. The
    // same list is in @suite-common/wallet-config (PHYLAX_NETWORK_SYMBOLS).
    const getNetworkConfigs = () =>
        getAllNetworkConfigs().filter(config => PHYLAX_NETWORK_SYMBOLS.includes(config.symbol));

    return {
        getIconPaths: createGetIconPaths({ networkModuleRepository }),
        isSupportedNetwork: networkModuleRepository.isSupportedNetwork,
        networkIcon: createNetworkIcon({ networkModuleRepository }),
        isWrappedNativeToken: createIsWrappedNativeToken({ networkModuleRepository }),
        networkModuleRepository,
        getNetworkConfig,
        getAccountSyncInterval: createGetAccountSyncInterval({ networkModuleRepository }),
        getNetworkByCoingeckoId: createGetNetworkByCoingeckoId({
            getNetworkConfig,
            networkModuleRepository,
        }),
        addressValidator: createAddressValidator({ networkModuleRepository }),
        getNamedAddressSupport: createGetNamedAddressSupport({ networkModuleRepository }),
        loadNetworkModules: createLoadNetworkModules({
            dispatch: deps.dispatch,
            getNetworkConfigs,
        }),
    };
};
