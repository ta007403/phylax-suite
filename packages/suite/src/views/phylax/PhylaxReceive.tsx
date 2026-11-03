// PHYLAX Blocks (fork): a saved wallet's receive address, shown on the main block first.
// Suite shows the address it computed from the saved xpubs; "Show on main block" has the main
// block draw the same address on its own screen (GetAddress with the wallet's multisig and
// showOnTrezor) for the user to compare. The QR code and Copy appear only after the main block
// confirmed it and returned the same address.

import { useEffect, useState } from 'react';

import { Button, Column, Row, Text } from '@trezor/components';
import TrezorConnect from '@trezor/connect';
import type { PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { QrCode } from '@trezor/product-components';

import {
    PHYLAX_COIN_SYMBOLS,
    type PhylaxNetwork,
    getPhylaxAddress,
    getPhylaxAddressPath,
    getPhylaxMultisig,
} from './phylaxWallet';
import type { PhylaxTarget } from './usePhylaxStack';

type RunOnDevice = <T>(call: (target: PhylaxTarget) => Promise<T>) => Promise<T | undefined>;

type ReceiveState =
    | { status: 'idle' }
    | { status: 'waiting' }
    | { status: 'verified'; isCopied: boolean }
    | { status: 'error'; text: string };

type PhylaxReceiveProps = {
    wallet: PROTO.PhylaxWallet;
    network: PhylaxNetwork;
    // first unused receive index, once the balance scan has finished
    nextIndex: number | undefined;
    // the balance scan failed: start at #0 without knowing which addresses were used
    isUsageUnknown: boolean;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

export const PhylaxReceive = ({
    wallet,
    network,
    nextIndex,
    isUsageUnknown,
    runOnDevice,
    isDeviceBusy,
}: PhylaxReceiveProps) => {
    const startIndex = isUsageUnknown ? 0 : nextIndex;
    const [index, setIndex] = useState(startIndex);
    const [state, setState] = useState<ReceiveState>({ status: 'idle' });

    // A new scan result (or another network) starts again at the first unused address.
    useEffect(() => {
        setIndex(startIndex);
        setState({ status: 'idle' });
    }, [startIndex, network, wallet]);

    if (index === undefined) {
        return (
            <Text typographyStyle="body-sm" priority="secondary">
                Receive address: waiting for the balance check…
            </Text>
        );
    }

    const address = getPhylaxAddress(wallet, network, 0, index);

    const handleShow = async () => {
        setState({ status: 'waiting' });
        const result = await runOnDevice(target =>
            TrezorConnect.getAddress({
                device: { ...target.device, useEmptyPassphrase: true },
                path: getPhylaxAddressPath(network, 0, index),
                coin: PHYLAX_COIN_SYMBOLS[network],
                multisig: getPhylaxMultisig(wallet, network, 0, index),
                scriptType: 'SPENDWITNESS',
                showOnTrezor: true,
            }),
        );
        if (!result) {
            setState({ status: 'error', text: 'The main block is not connected.' });
        } else if (!result.success) {
            setState({ status: 'error', text: result.error.message });
        } else if (result.payload.address !== address) {
            // Never offer an address the two sides disagree on.
            setState({
                status: 'error',
                text: 'The main block returned a different address. Do not use this wallet; contact support.',
            });
        } else {
            setState({ status: 'verified', isCopied: false });
        }
    };

    const handleCopy = async () => {
        if (state.status !== 'verified') return;
        await copyToClipboard(address);
        setState({ ...state, isCopied: true });
    };

    const handleNext = () => {
        setIndex(index + 1);
        setState({ status: 'idle' });
    };

    return (
        <Column gap={8} alignItems="stretch" data-testid="@phylax/receive">
            <Text typographyStyle="body-sm" priority="secondary">
                Receive address #{index}
            </Text>
            {isUsageUnknown && (
                <Text typographyStyle="body-sm" intent="warning">
                    The balance check failed, so this address may have been used before. Prefer a
                    new address once the balance loads.
                </Text>
            )}

            <Text isMonospaced typographyStyle="body-sm" data-testid="@phylax/receive-address">
                <span style={{ wordBreak: 'break-all' }}>{address}</span>
            </Text>

            {state.status === 'verified' ? (
                <>
                    <Text typographyStyle="body-sm" priority="secondary">
                        Confirmed on your main block.
                    </Text>
                    <div style={{ width: 220 }}>
                        <QrCode value={address} data-testid="@phylax/receive-qr" />
                    </div>
                    <Row gap={8}>
                        <Button size="small" priority="secondary" onClick={handleCopy}>
                            {state.isCopied ? 'Copied' : 'Copy address'}
                        </Button>
                        <Button size="small" priority="secondary" onClick={handleNext}>
                            Next address
                        </Button>
                    </Row>
                </>
            ) : (
                <>
                    <Text typographyStyle="body-sm">
                        Before you use it, press Show on main block and check that the main block
                        shows exactly this address. Confirm it there only if it does.
                    </Text>
                    <Row gap={8}>
                        <Button
                            size="small"
                            onClick={handleShow}
                            isDisabled={isDeviceBusy || state.status === 'waiting'}
                            isLoading={state.status === 'waiting'}
                            data-testid="@phylax/receive-show"
                        >
                            Show on main block
                        </Button>
                    </Row>
                </>
            )}

            {state.status === 'error' && (
                <Text intent="critical" data-testid="@phylax/receive-error">
                    {state.text}
                </Text>
            )}
        </Column>
    );
};
