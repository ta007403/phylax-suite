import { useNavigation } from '@react-navigation/native';

import { ExperimentId, useIsExperimentVariantActive } from '@suite-common/message-system';
import { type NetworkSymbol } from '@suite-common/wallet-config';
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
};

type NavigationProp = StackNavigationProps<RootStackParamList, RootStackRoutes.AccountDetailStack>;

export const useNavigateToAccount = () => {
    const navigation = useNavigation<NavigationProp>();
    const isAssetsFirstEnabled = useIsExperimentVariantActive({
        experimentId: ExperimentId.assetFirstHomeTable,
        variant: 'B',
    });

    return ({ accountKey, networkSymbol, closeActionType }: NavigateToAccountParams) => {
        if (
            isAssetsFirstEnabled ||
            isNetworkWithTokens(networkSymbol) ||
            isStakingSymbol(networkSymbol)
        ) {
            navigation.navigate(RootStackRoutes.AccountOverview, { accountKey });

            return;
        }

        navigation.navigate(RootStackRoutes.AccountDetailStack, {
            screen: AccountDetailStackRoutes.AccountDetail,
            params: {
                accountKey,
                closeActionType,
            },
        });
    };
};
