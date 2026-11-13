// PHYLAX Blocks (fork): says so when scans of PHYLAX wallets fell back from the PHYLAX API to the
// coin's backend (phylaxApi.ts), and when the API is tried again.

import { Text } from '@trezor/components';

import { useSelector } from 'src/hooks/suite';

import type { PhylaxNetwork } from './phylaxWallet';
import { selectPhylaxApiStatus } from './state/phylaxReducer';

type PhylaxApiNoteProps = { network: PhylaxNetwork };

export const PhylaxApiNote = ({ network }: PhylaxApiNoteProps) => {
    const status = useSelector(state => selectPhylaxApiStatus(state, network));
    if (status?.status !== 'fallback') return null;

    return (
        <Text typographyStyle="body-xs" intent="warning" data-testid="@phylax/api-note">
            PHYLAX server unreachable: {status.error}. Using Trezor&apos;s servers until{' '}
            {new Date(status.retryAt).toLocaleTimeString()}, then trying it again.
        </Text>
    );
};
