import { useDevice } from '@suite/device';
import { getFirmwareVersion } from '@trezor/device-utils';
import { SectionItem } from '@trezor/product-components';

// PHYLAX Blocks (fork): a PHYLAX block's firmware comes from PHYLAX builds. Suite's own update
// would install stock Trezor firmware over it, so it is not offered here. PHYLAX firmware is
// installed with trezorctl (see phylax-firmware: phylax/release/README.md).
export const PhylaxFirmwareVersion = () => {
    const { device } = useDevice();
    if (!device?.features) return null;

    return (
        <SectionItem
            data-testid="@settings/device/phylax-firmware"
            title="Firmware version"
            description={`PHYLAX firmware ${getFirmwareVersion(device)}`}
        />
    );
};
