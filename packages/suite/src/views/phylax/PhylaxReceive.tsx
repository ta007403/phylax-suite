// PHYLAX Blocks (fork): a saved wallet's receive address, shown on the main block first.
// Suite shows the address it computed from the saved xpubs; "Show on main block" has the main
// block draw the same address on its own screen (GetAddress with the wallet's multisig and
// showOnTrezor) for the user to compare. The QR code and Copy appear only after the main block
// confirmed it and returned the same address.

import { useEffect, useState } from 'react';

import { Address } from '@suite/address';
import { CoinQrCode } from '@suite/receive';
import { getNetwork } from '@suite-common/wallet-config';
import { Box, Button, Column, Grid, Row, Text, useMediaQuery } from '@trezor/components';
import TrezorConnect from '@trezor/connect';
import type { PROTO } from '@trezor/connect';
import { copyToClipboard } from '@trezor/dom-utils';
import { CopyIcon, PlusIcon, ShieldCheckIcon } from '@trezor/icons';
import { belowBreakpoint, breakpoints } from '@trezor/theme';

import {
    PHYLAX_COIN_SYMBOLS,
    type PhylaxNetwork,
    getPhylaxAccountPath,
    getPhylaxAddress,
    getPhylaxAddressPath,
    getPhylaxKeyNode,
    getPhylaxMultisig,
    getPublicKeyId,
} from './phylaxWallet';
import type { RunOnDevice } from './usePhylaxStack';

const QR_CODE_SIZE = 200;
const COMPACT_QR_CODE_SIZE = 148;

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
    // seed fingerprint of the connected main block (from the stack)
    mainFingerprint: number | undefined;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

type ShowResult =
    | { kind: 'failed'; text: string }
    | { kind: 'session-mismatch'; sessionKeyId: string; savedKeyId: string }
    | { kind: 'address'; address: string };

export const PhylaxReceive = ({
    wallet,
    network,
    nextIndex,
    isUsageUnknown,
    mainFingerprint,
    runOnDevice,
    isDeviceBusy,
}: PhylaxReceiveProps) => {
    const isBelowTablet = useMediaQuery(belowBreakpoint(breakpoints.tablet));
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

    const walletFingerprints = wallet.keys.map(key => key.fingerprint);

    const showResult = (result: ShowResult) => {
        if (result.kind === 'failed') {
            setState({ status: 'error', text: result.text });
        } else if (result.kind === 'session-mismatch') {
            setState({
                status: 'error',
                text:
                    'Safety check failed: in this session the main block derives a different key ' +
                    `(${result.sessionKeyId}) than the one saved in this wallet (${result.savedKeyId}). ` +
                    'Nothing was shown. Unplug the main block, plug it back in and try again. ' +
                    'If this still appears, do not use this wallet and update the main block firmware.',
            });
        } else if (result.address !== address) {
            // Never offer an address the two sides disagree on.
            setState({
                status: 'error',
                text: 'The main block returned a different address. Do not use this wallet; contact support.',
            });
        } else {
            setState({ status: 'verified', isCopied: false });
        }
    };

    const handleShow = async () => {
        setState({ status: 'waiting' });
        const coin = PHYLAX_COIN_SYMBOLS[network];
        const result = await runOnDevice(
            async (target, checkedFingerprint): Promise<ShowResult> => {
                // The fingerprint the device reported just now; the page's may be older.
                const savedKey = getPhylaxKeyNode(
                    wallet,
                    network,
                    checkedFingerprint ?? mainFingerprint,
                );
                const device = { ...target.device, useEmptyPassphrase: true };
                // Safety check first: in this session the main block must derive exactly the key the
                // wallet saved for it. If not, every address and signature in this session would be
                // wrong, so nothing is shown.
                const own = await TrezorConnect.getPublicKey({
                    device,
                    path: getPhylaxAccountPath(network),
                    coin,
                    showOnTrezor: false,
                });
                if (!own.success) return { kind: 'failed', text: own.error.message };
                if (
                    own.payload.publicKey !== savedKey?.public_key ||
                    own.payload.chainCode !== savedKey.chain_code
                ) {
                    return {
                        kind: 'session-mismatch',
                        sessionKeyId: getPublicKeyId(own.payload.publicKey),
                        savedKeyId: savedKey ? getPublicKeyId(savedKey.public_key) : 'none',
                    };
                }

                const shown = await TrezorConnect.getAddress({
                    device,
                    path: getPhylaxAddressPath(network, 0, index),
                    coin,
                    multisig: getPhylaxMultisig(wallet, network, 0, index),
                    scriptType: 'SPENDWITNESS',
                    showOnTrezor: true,
                });
                if (!shown.success) return { kind: 'failed', text: shown.error.message };

                return { kind: 'address', address: shown.payload.address };
            },
            walletFingerprints,
        );

        if (result.kind === 'not-connected') {
            setState({ status: 'error', text: 'The main block is not connected.' });
        } else if (result.kind === 'wrong-device') {
            setState({ status: 'error', text: result.text });
        } else {
            showResult(result.value);
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

    const isVerified = state.status === 'verified';
    const qrCodeSize = isBelowTablet ? COMPACT_QR_CODE_SIZE : QR_CODE_SIZE;

    // Laid out like Suite's own receive card (AddressCardDetail): the address in large type on
    // the left, the QR code with the coin logo on the right. As in Suite, the QR code only
    // appears once the address was checked on the device; here Copy waits for it too.
    return (
        <Box data-testid="@phylax/receive">
            <Grid
                columns={isBelowTablet ? '1fr' : 'minmax(0, 1fr) auto'}
                gap={24}
                alignItems="stretch"
            >
                <Column
                    gap={24}
                    alignItems="flex-start"
                    justifyContent="space-between"
                    minWidth={0}
                >
                    <Column gap={8} alignItems="flex-start" minWidth={0}>
                        <Text typographyStyle="body-md" priority="secondary">
                            Receive address #{index}
                        </Text>
                        <Address
                            value={address}
                            isChunked
                            typographyStyle="headline-md"
                            data-testid="@phylax/receive-address"
                        />
                        {isUsageUnknown && (
                            <Text typographyStyle="body-sm" intent="warning">
                                The balance check failed, so this address may have been used before.
                                Prefer a new address once the balance loads.
                            </Text>
                        )}
                        <Text typographyStyle="body-sm" priority="secondary">
                            {isVerified
                                ? 'Confirmed on your main block.'
                                : 'Before you use it, press Show on main block and check that the main block shows exactly this address. Confirm it there only if it does.'}
                        </Text>
                    </Column>
                    <Row gap={12} flexWrap="wrap" width="100%">
                        {isVerified ? (
                            <Button
                                size="large"
                                iconLeft={CopyIcon}
                                onClick={handleCopy}
                                data-testid="@phylax/receive-copy"
                            >
                                {state.isCopied ? 'Copied' : 'Copy address'}
                            </Button>
                        ) : (
                            <Button
                                size="large"
                                iconLeft={ShieldCheckIcon}
                                onClick={handleShow}
                                isDisabled={isDeviceBusy || state.status === 'waiting'}
                                isLoading={state.status === 'waiting'}
                                data-testid="@phylax/receive-show"
                            >
                                Show on main block
                            </Button>
                        )}
                        <Button
                            size="large"
                            intent="neutral"
                            priority="secondary"
                            iconLeft={PlusIcon}
                            onClick={handleNext}
                            isDisabled={state.status === 'waiting'}
                            data-testid="@phylax/receive-next"
                        >
                            Next address
                        </Button>
                    </Row>
                    {state.status === 'error' && (
                        <Text intent="critical" data-testid="@phylax/receive-error">
                            {state.text}
                        </Text>
                    )}
                </Column>
                <Box aspectRatio="1" width={qrCodeSize} maxWidth="100%">
                    {isVerified && (
                        <div data-testid="@phylax/receive-qr">
                            <CoinQrCode
                                value={address}
                                symbol={getNetwork(PHYLAX_COIN_SYMBOLS[network]).symbol}
                            />
                        </div>
                    )}
                </Box>
            </Grid>
        </Box>
    );
};
