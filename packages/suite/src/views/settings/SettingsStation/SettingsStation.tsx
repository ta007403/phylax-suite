// PHYLAX Blocks (fork): Settings > Station, only on the PHYLAX wallet station (Raspberry Pi CM5
// image): Wi-Fi (networks, connect with a password, forget), shutting down / restarting, the
// image's versions. Everything with the trackpad: the station has no other way to its system.

import { useCallback, useEffect, useState } from 'react';

import {
    type PhylaxWifiNetwork,
    type PhylaxWifiStatus,
    injectDesktopApi,
} from '@suite/desktop-app-api';
import { Button, Column, Input, Row, Text } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { SectionItem, SettingsSection } from '@trezor/product-components';

import { SettingsLayout } from 'src/components/settings/SettingsLayout';
import { usePhylaxStationInfo } from 'src/views/phylax/station/usePhylaxStationInfo';

const STATUS_REFRESH_MS = 5_000;

const describeWifi = (status: PhylaxWifiStatus | undefined) => {
    if (!status) return 'Checking…';
    switch (status.wifi) {
        case 'connected':
            return `Connected to ${status.ssid ?? 'a network'}${
                status.ipAddress ? ` (address ${status.ipAddress})` : ''
            }`;
        case 'connecting':
            return `Connecting to ${status.ssid ?? 'a network'}…`;
        case 'off':
            return 'Wi-Fi is off. Scan for networks to switch it on.';
        case 'missing':
            return 'This station has no Wi-Fi.';
        default:
            return 'Not connected. Scan for networks and choose one.';
    }
};

const describeEthernet = (status: PhylaxWifiStatus | undefined) => {
    if (!status) return 'Checking…';
    if (status.ethernet === 'connected') return 'Connected by cable';
    if (status.ethernet === 'missing') return 'No Ethernet port found';

    return 'No cable';
};

type NetworkRowProps = {
    network: PhylaxWifiNetwork;
    isBusy: boolean;
    onConnect: (password?: string) => void;
    onForget: () => void;
};

const NetworkRow = ({ network, isBusy, onConnect, onForget }: NetworkRowProps) => {
    const [isAskingPassword, setIsAskingPassword] = useState(false);
    const [password, setPassword] = useState('');
    const needsPassword = network.secured && !network.saved;

    const connect = () => {
        if (needsPassword && !isAskingPassword) {
            setIsAskingPassword(true);

            return;
        }
        onConnect(isAskingPassword ? password : undefined);
        setPassword('');
        setIsAskingPassword(false);
    };

    return (
        <Column gap={8} alignItems="stretch">
            <Row gap={12} justifyContent="space-between">
                <Column alignItems="flex-start">
                    <Text typographyStyle="body-md-strong">{network.ssid}</Text>
                    <Text typographyStyle="body-sm" priority="secondary">
                        {[
                            `signal ${network.signal}%`,
                            network.secured ? 'password' : 'open network',
                            network.inUse && 'in use',
                            network.saved && !network.inUse && 'saved',
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                </Column>
                <Row gap={8}>
                    {network.saved && (
                        <Button
                            size="small"
                            intent="neutral"
                            priority="secondary"
                            onClick={onForget}
                            isDisabled={isBusy}
                        >
                            Forget
                        </Button>
                    )}
                    {network.saved && network.secured && !isAskingPassword && (
                        <Button
                            size="small"
                            intent="neutral"
                            priority="secondary"
                            onClick={() => setIsAskingPassword(true)}
                            isDisabled={isBusy}
                        >
                            New password
                        </Button>
                    )}
                    {!network.inUse && !isAskingPassword && (
                        <Button size="small" onClick={connect} isDisabled={isBusy}>
                            Connect
                        </Button>
                    )}
                </Row>
            </Row>
            {isAskingPassword && (
                <Row gap={8}>
                    <Input
                        type="password"
                        value={password}
                        placeholder={`Password of ${network.ssid}`}
                        onChange={event => setPassword(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && password) connect();
                        }}
                    />
                    <Button size="small" onClick={connect} isDisabled={isBusy || !password}>
                        Connect
                    </Button>
                    <Button
                        size="small"
                        intent="neutral"
                        priority="secondary"
                        onClick={() => {
                            setPassword('');
                            setIsAskingPassword(false);
                        }}
                    >
                        Cancel
                    </Button>
                </Row>
            )}
        </Column>
    );
};

const StationNetwork = () => {
    const { desktopApi } = useServices(injectDesktopApi);
    const [status, setStatus] = useState<PhylaxWifiStatus>();
    const [networks, setNetworks] = useState<PhylaxWifiNetwork[]>();
    const [isScanning, setIsScanning] = useState(false);
    const [busySsid, setBusySsid] = useState<string>();
    const [message, setMessage] = useState<{ text: string; isError: boolean }>();

    const refreshStatus = useCallback(async () => {
        const result = await desktopApi.phylaxStationWifiStatus();
        if (result.success) setStatus(result.payload);
    }, [desktopApi]);

    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, STATUS_REFRESH_MS);

        return () => clearInterval(interval);
    }, [refreshStatus]);

    // keepMessage: a rescan after connecting or forgetting keeps its result shown
    const scan = async ({ keepMessage = false } = {}) => {
        setIsScanning(true);
        if (!keepMessage) setMessage(undefined);
        const result = await desktopApi.phylaxStationWifiScan();
        setIsScanning(false);
        if (result.success) {
            setNetworks(result.payload);
            if (!result.payload.length && !keepMessage) {
                setMessage({ text: 'No networks found.', isError: false });
            }
        } else if (!keepMessage) {
            setMessage({ text: result.error, isError: true });
        }
        refreshStatus();
    };

    const connect = async (ssid: string, password?: string) => {
        setBusySsid(ssid);
        setMessage({ text: `Connecting to ${ssid}…`, isError: false });
        const result = await desktopApi.phylaxStationWifiConnect({ ssid, password });
        setBusySsid(undefined);
        setMessage(
            result.success
                ? {
                      text: `Connected to ${ssid}. The station connects by itself from now on.`,
                      isError: false,
                  }
                : { text: result.error, isError: true },
        );
        await refreshStatus();
        if (networks) scan({ keepMessage: true });
    };

    const forget = async (ssid: string) => {
        setBusySsid(ssid);
        const result = await desktopApi.phylaxStationWifiForget({ ssid });
        setBusySsid(undefined);
        setMessage(
            result.success
                ? { text: `${ssid} forgotten.`, isError: false }
                : { text: result.error, isError: true },
        );
        await refreshStatus();
        if (networks) scan({ keepMessage: true });
    };

    return (
        <SettingsSection title="Network">
            <SectionItem
                title="Wi-Fi"
                description={describeWifi(status)}
                actions={
                    <Button onClick={() => scan()} isLoading={isScanning} isDisabled={isScanning}>
                        Scan for networks
                    </Button>
                }
            />
            {message && (
                <Text typographyStyle="body-sm" intent={message.isError ? 'critical' : undefined}>
                    {message.text}
                </Text>
            )}
            {networks?.map(network => (
                <SectionItem key={network.ssid}>
                    <NetworkRow
                        network={network}
                        isBusy={busySsid !== undefined}
                        onConnect={password => connect(network.ssid, password)}
                        onForget={() => forget(network.ssid)}
                    />
                </SectionItem>
            ))}
            <SectionItem title="Ethernet" description={describeEthernet(status)} />
        </SettingsSection>
    );
};

const StationPower = () => {
    const { desktopApi } = useServices(injectDesktopApi);
    const info = usePhylaxStationInfo();
    const [confirming, setConfirming] = useState<'poweroff' | 'reboot'>();
    const [error, setError] = useState<string>();

    const run = async (action: 'poweroff' | 'reboot') => {
        setError(undefined);
        const result = await desktopApi.phylaxStationPower(action);
        if (!result.success) {
            setError(result.error);
            setConfirming(undefined);
        }
    };

    return (
        <SettingsSection title="Station">
            <SectionItem
                title="Shut down or restart"
                description={
                    confirming
                        ? `${confirming === 'poweroff' ? 'Shut down' : 'Restart'} the station now?`
                        : 'Shut down before you unplug the power.'
                }
                actions={
                    confirming ? (
                        <Row gap={8}>
                            <Button
                                intent="neutral"
                                priority="secondary"
                                onClick={() => setConfirming(undefined)}
                            >
                                Cancel
                            </Button>
                            <Button intent="critical" onClick={() => run(confirming)}>
                                {confirming === 'poweroff' ? 'Shut down' : 'Restart'}
                            </Button>
                        </Row>
                    ) : (
                        <Row gap={8}>
                            <Button
                                intent="neutral"
                                priority="secondary"
                                onClick={() => setConfirming('reboot')}
                            >
                                Restart
                            </Button>
                            <Button
                                intent="neutral"
                                priority="secondary"
                                onClick={() => setConfirming('poweroff')}
                            >
                                Shut down
                            </Button>
                        </Row>
                    )
                }
            />
            {error && (
                <Text typographyStyle="body-sm" intent="critical">
                    {error}
                </Text>
            )}
            {info && (
                <SectionItem
                    title="Version"
                    description={`Image ${info.imageVersion} (${info.imageKind}) · PHYLAX Suite ${info.suiteVersion} · ${info.base}`}
                />
            )}
        </SettingsSection>
    );
};

export const SettingsStation = () => {
    const info = usePhylaxStationInfo();

    return (
        <SettingsLayout data-testid="@settings/station">
            {info ? (
                <>
                    <StationNetwork />
                    <StationPower />
                </>
            ) : (
                <Text typographyStyle="body-sm" priority="secondary">
                    These settings are only on the PHYLAX station.
                </Text>
            )}
        </SettingsLayout>
    );
};
