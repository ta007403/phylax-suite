// PHYLAX Blocks (fork): rename or delete the wallet; both are confirmed on the main block.

import { useState } from 'react';

import { gotoThunk } from '@suite/router';
import { Button, Card, Column, H3, Input, Row, Text } from '@trezor/components';
import TrezorConnect, { type PROTO } from '@trezor/connect';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { getSavedWalletProblem } from '../phylaxIdentity';
import type { PhylaxTarget, RunOnDevice } from '../usePhylaxStack';

const NAME_MAX_LENGTH = 15; // the main block's limit

type ActionState =
    | { status: 'idle' }
    | { status: 'waiting'; text: string }
    | { status: 'done'; text: string }
    | { status: 'error'; text: string };

type PhylaxWalletActionsProps = {
    summary: PROTO.PhylaxWalletSummary;
    runOnDevice: RunOnDevice;
    isDeviceBusy: boolean;
};

export const PhylaxWalletActions = ({
    summary,
    runOnDevice,
    isDeviceBusy,
}: PhylaxWalletActionsProps) => {
    const [newName, setNewName] = useState('');
    const [action, setAction] = useState<ActionState>({ status: 'idle' });
    const { dispatch } = useServices(injectDispatch);

    const runAction = async (
        waitingText: string,
        call: (target: PhylaxTarget) => ReturnType<typeof TrezorConnect.phylaxDeleteWallet>,
        doneText: string,
    ) => {
        setAction({ status: 'waiting', text: waitingText });
        // Rename and delete change the main block's saved list: they need the main block that
        // holds this wallet (not the main block's key in it), and are confirmed on its screen.
        const result = await runOnDevice(async target => {
            const problem = getSavedWalletProblem(
                await TrezorConnect.phylaxGetWallets(target),
                summary.slot,
                summary.fingerprints,
            );
            if (problem) return { success: false as const, error: { message: problem } };

            return call(target);
        });
        if (result.kind === 'not-connected') {
            setAction({ status: 'error', text: 'The main block is not connected.' });
        } else if (result.kind === 'wrong-device') {
            setAction({ status: 'error', text: result.text });
        } else if (result.value.success) {
            setAction({ status: 'done', text: doneText });

            return true;
        } else {
            setAction({ status: 'error', text: result.value.error.message });
        }

        return false;
    };

    const handleRename = async () => {
        const isDone = await runAction(
            'Confirm the new name on your PHYLAX main block.',
            target =>
                TrezorConnect.phylaxSetWalletName({ ...target, slot: summary.slot, name: newName }),
            `Renamed to "${newName}".`,
        );
        if (isDone) setNewName('');
    };

    const handleDelete = async () => {
        const isDone = await runAction(
            'Confirm the delete on your PHYLAX main block.',
            target => TrezorConnect.phylaxDeleteWallet({ ...target, slot: summary.slot }),
            'Deleted from every block.',
        );
        if (isDone) dispatch(gotoThunk({ routeName: 'phylax-index' }));
    };

    return (
        <Card>
            <Column gap={8} alignItems="stretch">
                <H3>Name and delete</H3>
                <Row gap={8} alignItems="center" flexWrap="wrap">
                    <Input
                        size="small"
                        placeholder="New name"
                        value={newName}
                        maxLength={NAME_MAX_LENGTH}
                        onChange={event => setNewName(event.target.value)}
                        data-testid="@phylax/rename-input"
                    />
                    <Button
                        size="small"
                        onClick={handleRename}
                        isDisabled={isDeviceBusy || newName.trim().length === 0}
                        data-testid="@phylax/rename"
                    >
                        Rename
                    </Button>
                </Row>
                <Text typographyStyle="body-sm" priority="secondary">
                    Deleting removes the wallet from every block. Its coins stay on the blockchain
                    and still need its keys: keep the descriptor before you delete. The main block
                    then no longer offers these blocks as a wallet, until you choose Ask again under
                    Never on the PHYLAX Snap page.
                </Text>
                <Row>
                    <Button
                        size="small"
                        intent="critical"
                        priority="secondary"
                        onClick={handleDelete}
                        isDisabled={isDeviceBusy}
                        data-testid="@phylax/delete"
                    >
                        Delete wallet
                    </Button>
                </Row>
                {action.status !== 'idle' && (
                    <Text
                        intent={action.status === 'error' ? 'critical' : undefined}
                        data-testid="@phylax/action-status"
                    >
                        {action.text}
                    </Text>
                )}
            </Column>
        </Card>
    );
};
