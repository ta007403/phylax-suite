import { Translation } from '@suite/intl';
import { Banner } from '@trezor/components';

// PHYLAX Blocks (fork): shown instead of the firmware authenticity check result, which is skipped
// for a PHYLAX main block because its firmware can never match an official Trezor build.
export const PhylaxFirmwareBanner = () => (
    <Banner
        data-testid="@banner/phylax-firmware"
        icon
        intent="warning"
        description={<Translation id="TR_PHYLAX_FIRMWARE_BANNER" />}
    />
);
