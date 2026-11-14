import { Translation } from '@suite/intl';
import { H3, Modal, Paragraph } from '@trezor/components';
import { getFirmwareVersion } from '@trezor/device-utils';
import { InfoIcon } from '@trezor/icons';

import { type TrezorDevice } from 'src/types/suite';

type PhylaxNoFirmwareUpdateProps = {
    device: TrezorDevice;
    onClose: () => void;
};

// PHYLAX Blocks (fork): shown instead of Trezor's "Install firmware" for a PHYLAX block, however
// that screen was opened. Trezor's firmware would replace PHYLAX on the block (and a PHYLAX
// bootloader may erase the seed for it); PHYLAX firmware is installed with trezorctl.
export const PhylaxNoFirmwareUpdate = ({ device, onClose }: PhylaxNoFirmwareUpdateProps) => (
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
        <H3>PHYLAX firmware</H3>
        <Paragraph>
            This is a PHYLAX block with PHYLAX firmware {getFirmwareVersion(device)}. PHYLAX Suite
            does not install firmware on PHYLAX blocks: Trezor&apos;s firmware would replace PHYLAX.
            PHYLAX firmware is installed with trezorctl.
        </Paragraph>
    </Modal.ModalBase>
);
