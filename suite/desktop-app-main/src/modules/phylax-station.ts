// PHYLAX Blocks (fork): the PHYLAX wallet station (Raspberry Pi CM5 image, phylax-station repo):
// Wi-Fi through NetworkManager (nmcli) and shutting down / restarting (systemctl). Only on a
// station (its image writes /etc/phylax-station-release); elsewhere get-info answers null and the
// rest refuses. The station image allows its kiosk user these actions (polkit).
// Commands run without a shell, with fixed arguments; Wi-Fi passwords are never logged.

import { execFile } from 'child_process';
import { existsSync, readFileSync } from 'fs';

import type { InvokeResult, PhylaxWifiNetwork, PhylaxWifiStatus } from '@suite/desktop-app-api';

import { ipcMain } from '../ipcMain';
import type { ModuleInit } from './module';
import {
    PHYLAX_STATION_RELEASE_FILE,
    describeNmcliError,
    getWifiConnectCommands,
    parseStationRelease,
    parseWifiList,
    parseWifiStatus,
} from '../libs/phylax-station';

export const SERVICE_NAME = 'phylax-station';

const NOT_A_STATION = 'Only on the PHYLAX station.';
const COMMAND_TIMEOUT_MS = 60_000;

type Output = { ok: true; stdout: string } | { ok: false; stderr: string };

const run = (command: string, args: string[]) =>
    new Promise<Output>(resolve => {
        execFile(
            command,
            args,
            { timeout: COMMAND_TIMEOUT_MS, env: { ...process.env, LC_ALL: 'C' } },
            (error, stdout, stderr) => {
                if (error) {
                    resolve({ ok: false, stderr: String(stderr || error.message) });
                } else {
                    resolve({ ok: true, stdout: String(stdout) });
                }
            },
        );
    });

const nmcli = (args: string[]) => run('nmcli', args);

const getSavedNetworks = async () => {
    const output = await nmcli(['-t', '-f', 'NAME,TYPE', 'connection', 'show']);

    return output.ok ? parseWifiStatus('', output.stdout).savedNetworks : [];
};

export const init: ModuleInit = ({ logger }) => {
    const isStation = () => existsSync(PHYLAX_STATION_RELEASE_FILE);
    const refuse = () => ({ success: false as const, error: NOT_A_STATION });

    ipcMain.handle('phylax-station/get-info', () => {
        if (!isStation()) return { success: true, payload: null };
        try {
            return {
                success: true,
                payload: parseStationRelease(readFileSync(PHYLAX_STATION_RELEASE_FILE, 'utf8')),
            };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle(
        'phylax-station/wifi-status',
        async (): Promise<InvokeResult<PhylaxWifiStatus>> => {
            if (!isStation()) return refuse();
            const devices = await nmcli([
                '-t',
                '-f',
                'DEVICE,TYPE,STATE,CONNECTION',
                'device',
                'status',
            ]);
            if (!devices.ok) return { success: false, error: describeNmcliError(devices.stderr) };
            const connections = await nmcli(['-t', '-f', 'NAME,TYPE', 'connection', 'show']);
            const status = parseWifiStatus(
                devices.stdout,
                connections.ok ? connections.stdout : '',
            );
            if (status.wifi === 'connected') {
                const wifiDevice = devices.stdout
                    .split('\n')
                    .find(line => line.split(':')[1] === 'wifi')
                    ?.split(':')[0];
                if (wifiDevice) {
                    const addresses = await nmcli([
                        '-t',
                        '-g',
                        'IP4.ADDRESS',
                        'device',
                        'show',
                        wifiDevice,
                    ]);
                    if (addresses.ok) {
                        return {
                            success: true,
                            payload: parseWifiStatus(
                                devices.stdout,
                                connections.ok ? connections.stdout : '',
                                addresses.stdout,
                            ),
                        };
                    }
                }
            }

            return { success: true, payload: status };
        },
    );

    ipcMain.handle(
        'phylax-station/wifi-scan',
        async (): Promise<InvokeResult<PhylaxWifiNetwork[]>> => {
            if (!isStation()) return refuse();
            // the radio may be off (Raspberry Pi OS ships Wi-Fi off): scanning needs it on
            await nmcli(['radio', 'wifi', 'on']);
            const list = await nmcli([
                '-t',
                '-f',
                'IN-USE,SSID,SIGNAL,SECURITY',
                'device',
                'wifi',
                'list',
                '--rescan',
                'yes',
            ]);
            if (!list.ok) return { success: false, error: describeNmcliError(list.stderr) };

            return { success: true, payload: parseWifiList(list.stdout, await getSavedNetworks()) };
        },
    );

    ipcMain.handle('phylax-station/wifi-connect', async (_, { ssid, password }) => {
        if (!isStation()) return refuse();
        logger.info(SERVICE_NAME, 'Connecting to a Wi-Fi network');
        await nmcli(['radio', 'wifi', 'on']);
        const commands = getWifiConnectCommands(ssid, password, await getSavedNetworks());
        for (const args of commands) {
            const output = await nmcli(args);
            // deleting the old connection: fine if it was already gone
            if (!output.ok && args[0] !== 'connection') {
                logger.warn(SERVICE_NAME, 'Wi-Fi connection failed');

                return { success: false, error: describeNmcliError(output.stderr) };
            }
        }

        return { success: true };
    });

    ipcMain.handle('phylax-station/wifi-forget', async (_, { ssid }) => {
        if (!isStation()) return refuse();
        const output = await nmcli(['connection', 'delete', 'id', ssid]);

        return output.ok
            ? { success: true }
            : { success: false, error: describeNmcliError(output.stderr) };
    });

    ipcMain.handle('phylax-station/power', async (_, action) => {
        if (!isStation()) return refuse();
        logger.info(SERVICE_NAME, `Station ${action}`);
        const output = await run('systemctl', [action === 'reboot' ? 'reboot' : 'poweroff']);

        return output.ok ? { success: true } : { success: false, error: output.stderr.trim() };
    });
};
