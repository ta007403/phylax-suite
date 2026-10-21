import { useNavigation } from '@react-navigation/native';

import { ExperimentId, useIsExperimentVariantActive } from '@suite-common/message-system';
import { type AccountType, type NetworkSymbol } from '@suite-common/wallet-config';
import { type AccountKey } from '@suite-common/wallet-types';
import { isStakingSymbol } from '@suite-common/wallet-utils';
import {
    AccountDetailStackRoutes,
    type CloseActionType,
    type RootStackParamList,
    RootStackRoutes,
    type StackNavigationProps,
} from '@suite-native/navigation';
import { isNetworkWithTokens } from '@suite-native/tokens';

type NavigateToAccountParams = {
    accountKey: AccountKey;
    networkSymbol: NetworkSymbol;
    closeActionType: CloseActionType;
    accountIdentity?: { accountType: AccountType; accountIndex: number };
};

type UseNavigateToAccountParams = {
    navigationMethod?: 'navigate' | 'replace';
    overrideLegacyRoutingToAccountDetail?: boolean;
};

type NavigationProp = StackNavigationProps<RootStackParamList, RootStackRoutes.AccountDetailStack>;

export const useNavigateToAccount = ({
    navigationMethod = 'navigate',
    overrideLegacyRoutingToAccountDetail,
}: UseNavigateToAccountParams = {}) => {
    const navigation = useNavigation<NavigationProp>();
    const isAssetsFirstEnabled = useIsExperimentVariantActive({
        experimentId: ExperimentId.assetFirstHomeTable,
        variant: 'B',
    });

    return ({
        accountKey,
        networkSymbol,
        closeActionType,
        accountIdentity,
    }: NavigateToAccountParams) => {
        if (
            isAssetsFirstEnabled ||
            (!overrideLegacyRoutingToAccountDetail &&
                (isNetworkWithTokens(networkSymbol) || isStakingSymbol(networkSymbol)))
        ) {
            const params = accountIdentity
                ? { accountKey, networkSymbol, ...accountIdentity }
                : { accountKey };

            navigation[navigationMethod](RootStackRoutes.AccountOverview, params);

            return;
        }

        const accountDetailParams = accountIdentity
            ? { networkSymbol, ...accountIdentity, closeActionType }
            : { accountKey, closeActionType };
        const params = {
            screen: AccountDetailStackRoutes.AccountDetail,
            params: accountDetailParams,
        } as const;

        navigation[navigationMethod](RootStackRoutes.AccountDetailStack, params);
    };
};
