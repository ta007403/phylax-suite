import { Translation } from '@suite/intl';
import { H3, Modal, Paragraph } from '@trezor/components';
import { getFirmwareVersion } from '@trezor/device-utils';
import { InfoIcon } from '@trezor/icons';

import { type TrezorDevice } from 'src/types/suite';

import { isPhylaxBlock } from './phylaxBlock';

type PhylaxNoFirmwareUpdateProps = {
    device?: TrezorDevice;
    onClose: () => void;
};

// PHYLAX Blocks (fork): shown instead of Trezor's "Install firmware", however that screen was
// opened and whatever the device. PHYLAX Suite never installs firmware: on a PHYLAX block Trezor's
// firmware would replace PHYLAX (and a PHYLAX bootloader may erase the seed for it); PHYLAX
// firmware is installed with trezorctl. A regular Trezor is updated with Trezor Suite: a newer
// Trezor firmware is only a reminder here.
const getTrezorFirmwareUpdate = (device?: TrezorDevice) =>
    device?.features && device.firmwareReleaseConfigInfo?.isNewer
        ? {
              newer: device.firmwareReleaseConfigInfo.release.version.join('.'),
              current: getFirmwareVersion(device),
          }
        : undefined;

export const PhylaxNoFirmwareUpdate = ({ device, onClose }: PhylaxNoFirmwareUpdateProps) => {
    const trezorFirmwareUpdate = getTrezorFirmwareUpdate(device);

    return (
        <Modal.ModalBase
            onCancel={onClose}
            data-testid="@firmware-modal/phylax"
            bottomContent={
                <Modal.Button intent="neutral" priority="secondary" onClick={onClose}>
                    <Translation id="TR_CLOSE" />
                </Modal.Button>
            }
            icon={InfoIcon}
        >
            {device && isPhylaxBlock(device) ? (
                <>
                    <H3>PHYLAX firmware</H3>
                    <Paragraph>
                        This is a PHYLAX block with PHYLAX firmware {getFirmwareVersion(device)}.
                        PHYLAX Suite does not install firmware on PHYLAX blocks: Trezor&apos;s
                        firmware would replace PHYLAX. PHYLAX firmware is installed with trezorctl.
                    </Paragraph>
                </>
            ) : (
                <>
                    <H3>
                        {trezorFirmwareUpdate
                            ? 'Trezor firmware update'
                            : 'No firmware installation'}
                    </H3>
                    <Paragraph>
                        {trezorFirmwareUpdate
                            ? `A newer Trezor firmware (${trezorFirmwareUpdate.newer}) is available for this device. PHYLAX Suite never installs firmware: update it with Trezor Suite when you want to, or keep using the firmware it has (${trezorFirmwareUpdate.current}).`
                            : 'PHYLAX Suite never installs firmware. For a Trezor device, use Trezor Suite. PHYLAX firmware is installed with trezorctl.'}
                    </Paragraph>
                </>
            )}
        </Modal.ModalBase>
    );
};
