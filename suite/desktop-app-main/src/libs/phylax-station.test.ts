import {
    describeNmcliError,
    getWifiConnectCommands,
    parseStationRelease,
    parseWifiList,
    parseWifiStatus,
    splitTerseLine,
} from './phylax-station';

describe('phylax-station', () => {
    it('reads the image release file', () => {
        expect(
            parseStationRelease(
                'IMAGE_VERSION=20261114-722acf0\nIMAGE_KIND=dev\nSUITE_VERSION=26.11.0\nBASE=2026-10-06-raspios-trixie-arm64-lite\n',
            ),
        ).toEqual({
            imageVersion: '20261114-722acf0',
            imageKind: 'dev',
            suiteVersion: '26.11.0',
            base: '2026-10-06-raspios-trixie-arm64-lite',
        });
    });

    it("splits nmcli's terse lines, with escaped ':' and '\\'", () => {
        expect(splitTerseLine('*:My\\:Net\\\\5G:70:WPA2')).toEqual([
            '*',
            'My:Net\\5G',
            '70',
            'WPA2',
        ]);
        expect(splitTerseLine(':Open cafe:40:')).toEqual(['', 'Open cafe', '40', '']);
    });

    it('Wi-Fi off, as on the first station (Raspberry Pi OS ships it off)', () => {
        const status = parseWifiStatus(
            'eth0:ethernet:unavailable:\nwlan0:wifi:unavailable:\nlo:loopback:connected (externally):lo\n',
            'Super Home 2.4G:802-11-wireless\nlo:loopback\n',
        );
        expect(status).toEqual({
            wifi: 'off',
            ssid: undefined,
            ipAddress: undefined,
            ethernet: 'disconnected',
            savedNetworks: ['Super Home 2.4G'],
        });
    });

    it('Wi-Fi connected, with its address', () => {
        const status = parseWifiStatus(
            'wlan0:wifi:connected:Super Home 2.4G\neth0:ethernet:unavailable:\n',
            'Super Home 2.4G:802-11-wireless\nOffice:802-11-wireless\n',
            '192.168.1.42/24\n',
        );
        expect(status).toMatchObject({
            wifi: 'connected',
            ssid: 'Super Home 2.4G',
            ipAddress: '192.168.1.42',
            savedNetworks: ['Super Home 2.4G', 'Office'],
        });
        expect(
            parseWifiStatus('wlan0:wifi:connecting (getting IP configuration):Office\n', ''),
        ).toMatchObject({
            wifi: 'connecting',
            ssid: 'Office',
            ipAddress: undefined,
        });
        expect(parseWifiStatus('wlan0:wifi:disconnected:\n', '').wifi).toBe('disconnected');
        expect(parseWifiStatus('eth0:ethernet:connected:Wired\n', '')).toMatchObject({
            wifi: 'missing',
            ethernet: 'connected',
        });
    });

    it('lists networks once each (strongest), hidden ones out, the one in use first', () => {
        const list = parseWifiList(
            [
                ':Office:80:WPA2',
                '*:Super Home 2.4G:55:WPA2',
                ':Super Home 2.4G:70:WPA2',
                '::90:WPA2',
                ':Free cafe:30:',
                ':Old:20:--',
            ].join('\n'),
            ['Office'],
        );
        expect(list).toEqual([
            { ssid: 'Super Home 2.4G', signal: 70, secured: true, inUse: true, saved: false },
            { ssid: 'Office', signal: 80, secured: true, inUse: false, saved: true },
            { ssid: 'Free cafe', signal: 30, secured: false, inUse: false, saved: false },
            { ssid: 'Old', signal: 20, secured: false, inUse: false, saved: false },
        ]);
    });

    it('connects: new password replaces a saved one; saved or open without', () => {
        expect(getWifiConnectCommands('Office', 'secret', ['Office'])).toEqual([
            ['connection', 'delete', 'id', 'Office'],
            ['--wait', '45', 'device', 'wifi', 'connect', 'Office', 'password', 'secret'],
        ]);
        expect(getWifiConnectCommands('New', 'secret', [])).toEqual([
            ['--wait', '45', 'device', 'wifi', 'connect', 'New', 'password', 'secret'],
        ]);
        expect(getWifiConnectCommands('Office', undefined, ['Office'])).toEqual([
            ['--wait', '45', 'connection', 'up', 'id', 'Office'],
        ]);
        expect(getWifiConnectCommands('Free cafe', '', [])).toEqual([
            ['--wait', '45', 'device', 'wifi', 'connect', 'Free cafe'],
        ]);
    });

    it("says nmcli's errors for the user", () => {
        expect(
            describeNmcliError(
                'Error: Connection activation failed: Secrets were required, but not provided.\n',
            ),
        ).toMatch(/Wrong password/);
        expect(describeNmcliError("Error: No network with SSID 'X' found.")).toMatch(
            /not in range/,
        );
        expect(describeNmcliError('Error: Not authorized to control networking.')).toMatch(
            /permission/,
        );
        expect(describeNmcliError('Error: something else')).toBe('something else');
        expect(describeNmcliError('')).toBe('The network could not be changed.');
    });
});
