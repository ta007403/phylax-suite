import { useLayoutEffect } from 'react';
import { Platform } from 'react-native';

import { type NavigationProp, type ParamListBase, useNavigation } from '@react-navigation/native';

type Navigation = NavigationProp<ParamListBase>;

const gestureBlockers = new WeakMap<Navigation, number>();

const getNavigationChain = (navigation: Navigation) => {
    const chain: Navigation[] = [];
    let current: Navigation | undefined = navigation;

    while (current) {
        chain.push(current);
        current = current.getParent?.();
    }

    return chain;
};

export const useDisableIOSGesture = () => {
    const navigation = useNavigation<Navigation>();

    useLayoutEffect(() => {
        if (Platform.OS !== 'ios') {
            return;
        }

        const navigationChain = getNavigationChain(navigation);

        navigationChain.forEach(routeNavigation => {
            const blockers = gestureBlockers.get(routeNavigation) ?? 0;
            gestureBlockers.set(routeNavigation, blockers + 1);
            if (blockers === 0) {
                routeNavigation.setOptions({ gestureEnabled: false });
            }
        });

        return () => {
            navigationChain.forEach(routeNavigation => {
                const blockers = gestureBlockers.get(routeNavigation) ?? 1;
                if (blockers > 1) {
                    gestureBlockers.set(routeNavigation, blockers - 1);
                } else {
                    gestureBlockers.delete(routeNavigation);
                    routeNavigation.setOptions({ gestureEnabled: true });
                }
            });
        };
    }, [navigation]);
};
