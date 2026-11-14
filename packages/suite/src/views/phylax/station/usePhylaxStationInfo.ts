// PHYLAX Blocks (fork): whether this app runs on the PHYLAX wallet station (its image), and the
// image's versions. Asked once per app start; null elsewhere (web, Windows, ...).

import { useEffect, useState } from 'react';

import { type DesktopApi, type PhylaxStationInfo, injectDesktopApi } from '@suite/desktop-app-api';
import { useServices } from '@trezor/dependency-injection';

let infoRequest: Promise<PhylaxStationInfo | null> | undefined;

const getStationInfo = (desktopApi: DesktopApi) => {
    if (!desktopApi.available) return Promise.resolve(null);
    infoRequest ??= desktopApi
        .phylaxStationGetInfo()
        .then(result => (result.success ? result.payload : null))
        .catch(() => null);

    return infoRequest;
};

export const usePhylaxStationInfo = () => {
    const { desktopApi } = useServices(injectDesktopApi);
    const [info, setInfo] = useState<PhylaxStationInfo | null>(null);

    useEffect(() => {
        let isMounted = true;
        getStationInfo(desktopApi).then(value => {
            if (isMounted) setInfo(value);
        });

        return () => {
            isMounted = false;
        };
    }, [desktopApi]);

    return info;
};
