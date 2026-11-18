import { Translation } from '@suite/intl';
import { CpuIcon } from '@trezor/icons';

import { TroubleshootingTips } from 'src/components/suite/troubleshooting/TroubleshootingTips';

// PHYLAX Blocks (fork): PHYLAX Suite never installs firmware, so a device without firmware (a
// brand-new Trezor) is not set up here: no "go to setup", which would start with installing it.
export const DeviceNoFirmware = () => (
    <TroubleshootingTips
        label={<Translation id="TR_PHYLAX_NO_FIRMWARE_HEADING" />}
        intent="info"
        items={[
            {
                key: 'device-firmware-missing',
                heading: <Translation id="TR_PHYLAX_NO_FIRMWARE_HEADING" />,
                description: <Translation id="TR_PHYLAX_NO_FIRMWARE_DESCRIPTION" />,
                icon: CpuIcon,
            },
        ]}
    />
);
