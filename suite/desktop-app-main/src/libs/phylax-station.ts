// PHYLAX Blocks (fork): the PHYLAX wallet station (Raspberry Pi CM5 image, phylax-station repo).
// Reading NetworkManager's command line tool (nmcli, terse mode) and the image's release file.
// No I/O here: the module (modules/phylax-station.ts) runs the commands.

import type {
    PhylaxStationInfo,
    PhylaxWifiNetwork,
    PhylaxWifiState,
    PhylaxWifiStatus,
} from '@suite/desktop-app-api';

// written by the station image; its presence makes this app a station
export const PHYLAX_STATION_RELEASE_FILE = '/etc/phylax-station-release';

/** /etc/phylax-station-release: KEY=VALUE lines. */
export const parseStationRelease = (text: string): PhylaxStationInfo => {
    const values: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
        if (match) values[match[1]!] = match[2]!;
    }

    return {
        imageVersion: values.IMAGE_VERSION ?? '',
        imageKind: values.IMAGE_KIND ?? '',
        suiteVersion: values.SUITE_VERSION ?? '',
        base: values.BASE ?? '',
    };
};

/** One line of `nmcli -t` output: fields split at ':', with '\:' and '\\' escaped. */
export const splitTerseLine = (line: string) => {
    const fields: string[] = [];
    let field = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\\' && i + 1 < line.length) {
            field += line[i + 1];
            i++;
        } else if (char === ':') {
            fields.push(field);
            field = '';
        } else {
            field += char;
        }
    }
    fields.push(field);

    return fields;
};

const terseLines = (output: string) =>
    output
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(splitTerseLine);

const toWifiState = (state: string | undefined): PhylaxWifiState => {
    if (state === undefined) return 'missing';
    if (state.startsWith('connected')) return 'connected';
    if (state.startsWith('connecting')) return 'connecting';
    // radio off (NetworkManager or rfkill), or no driver
    if (state === 'unavailable' || state === 'unmanaged') return 'off';

    return 'disconnected';
};

const toEthernetState = (state: string | undefined): PhylaxWifiStatus['ethernet'] => {
    if (state === undefined) return 'missing';

    return state.startsWith('connected') ? 'connected' : 'disconnected';
};

/**
 * `nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status`,
 * `nmcli -t -f NAME,TYPE connection show`, and the Wi-Fi's `-g IP4.ADDRESS`.
 */
export const parseWifiStatus = (
    deviceStatus: string,
    connections: string,
    ipAddresses = '',
): PhylaxWifiStatus => {
    const devices = terseLines(deviceStatus);
    const wifi = devices.find(([, type]) => type === 'wifi');
    const ethernet = devices.find(([, type]) => type === 'ethernet');
    const wifiState = toWifiState(wifi?.[2]);
    const ipAddress = ipAddresses.split('|')[0]?.trim().split('/')[0] || undefined;

    return {
        wifi: wifiState,
        ssid:
            (wifiState === 'connected' || wifiState === 'connecting') && wifi?.[3]
                ? wifi[3]
                : undefined,
        ipAddress: wifiState === 'connected' ? ipAddress : undefined,
        ethernet: toEthernetState(ethernet?.[2]),
        savedNetworks: terseLines(connections)
            .filter(([, type]) => type === '802-11-wireless')
            .map(([name]) => name!),
    };
};

/**
 * `nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list`: one entry per network name (the
 * strongest access point), hidden networks left out; the one in use first, then by signal.
 */
export const parseWifiList = (output: string, savedNetworks: string[]): PhylaxWifiNetwork[] => {
    const networks = new Map<string, PhylaxWifiNetwork>();
    for (const [inUse, ssid, signal, security] of terseLines(output)) {
        if (!ssid) continue;
        const network: PhylaxWifiNetwork = {
            ssid,
            signal: Math.max(0, Math.min(100, Number(signal) || 0)),
            secured: !!security && security !== '--',
            inUse: inUse === '*',
            saved: savedNetworks.includes(ssid),
        };
        const known = networks.get(ssid);
        if (!known || network.signal > known.signal) {
            networks.set(ssid, { ...network, inUse: network.inUse || !!known?.inUse });
        } else if (network.inUse) {
            known.inUse = true;
        }
    }

    return [...networks.values()].sort(
        (a, b) => Number(b.inUse) - Number(a.inUse) || b.signal - a.signal,
    );
};

/**
 * The nmcli commands that connect to a network. With a password: a saved connection of that
 * name is replaced (a new password). Without: the saved one, or an open network.
 */
export const getWifiConnectCommands = (
    ssid: string,
    password: string | undefined,
    savedNetworks: string[],
): string[][] => {
    const isSaved = savedNetworks.includes(ssid);
    if (password) {
        return [
            ...(isSaved ? [['connection', 'delete', 'id', ssid]] : []),
            ['--wait', '45', 'device', 'wifi', 'connect', ssid, 'password', password],
        ];
    }

    return [
        isSaved
            ? ['--wait', '45', 'connection', 'up', 'id', ssid]
            : ['--wait', '45', 'device', 'wifi', 'connect', ssid],
    ];
};

/** nmcli's error output, said for the station's user. */
export const describeNmcliError = (stderr: string) => {
    const message = stderr
        .split('\n')
        .map(line => line.trim())
        .find(line => line !== '')
        ?.replace(/^Error:\s*/, '');
    if (!message) return 'The network could not be changed.';
    if (/secrets were required|psk|802-11-wireless-security/i.test(message)) {
        return 'Wrong password (or the network needs another kind of sign-in).';
    }
    if (/no network with ssid/i.test(message)) {
        return 'This network is not in range. Scan again, or move the station closer.';
    }
    if (/not authorized|insufficient privileges/i.test(message)) {
        return 'The station is not allowed to change networks (a permission is missing in its image).';
    }

    return message;
};
