// PHYLAX Snap (fork): "Wake up" a locked key block from Suite. The main block starts its unlock
// for that block (PhylaxUnlockBlock); the user enters the PIN on the key block's own buttons, and
// the stack shows the block unlocked when it is done.

import { useState } from 'react';

import { Button, Row, Text } from '@trezor/components';
import TrezorConnect from '@trezor/connect';

import type { RunOnDevice } from './usePhylaxStack';

export type WakeState =
    { status: 'starting' } | { status: 'waiting' } | { status: 'error'; text: string };

export type PhylaxWakeUp = {
    states: Record<number, WakeState>;
    wake: (address: number) => void;
};

export const getKeyBlockName = (address: number) => `key block 0x${address.toString(16)}`;

/** One wake-up state per key block address; `lockedAddresses` drops the done ones. */
export const usePhylaxWakeUp = (
    runOnDevice: RunOnDevice,
    lockedAddresses: number[],
): PhylaxWakeUp => {
    const [states, setStates] = useState<Record<number, WakeState>>({});
    const setState = (address: number, state: WakeState) =>
        setStates(previous => ({ ...previous, [address]: state }));

    const wake = async (address: number) => {
        setState(address, { status: 'starting' });
        const result = await runOnDevice(target =>
            TrezorConnect.phylaxUnlockBlock({ ...target, address }),
        );
        if (result.kind === 'not-connected') {
            setState(address, { status: 'error', text: 'The main block is not connected.' });
        } else if (result.kind === 'wrong-device') {
            setState(address, { status: 'error', text: result.text });
        } else if (!result.value.success) {
            setState(address, { status: 'error', text: result.value.error.message });
        } else {
            setState(address, { status: 'waiting' });
        }
    };

    // a block that is no longer locked is done (or was unlocked some other way)
    const current = Object.fromEntries(
        Object.entries(states).filter(([address]) => lockedAddresses.includes(Number(address))),
    );

    return { states: current, wake: address => void wake(address) };
};

type WakeUpButtonProps = {
    address: number;
    wakeUp: PhylaxWakeUp;
    isDeviceBusy: boolean;
};

export const WakeUpButton = ({ address, wakeUp, isDeviceBusy }: WakeUpButtonProps) => {
    const state = wakeUp.states[address];

    return (
        <Row gap={8} alignItems="center" flexWrap="wrap">
            <Button
                size="small"
                onClick={() => wakeUp.wake(address)}
                isDisabled={isDeviceBusy || state?.status === 'starting'}
                isLoading={state?.status === 'starting'}
                data-testid={`@phylax/wake/${address}`}
            >
                {state?.status === 'waiting' ? 'Wake up again' : 'Wake up'}
            </Button>
            {state?.status === 'waiting' && (
                <Text typographyStyle="body-sm">
                    Enter the PIN on {getKeyBlockName(address)}&apos;s own buttons.
                </Text>
            )}
            {state?.status === 'error' && (
                <Text typographyStyle="body-sm" intent="critical">
                    {state.text}
                </Text>
            )}
        </Row>
    );
};
