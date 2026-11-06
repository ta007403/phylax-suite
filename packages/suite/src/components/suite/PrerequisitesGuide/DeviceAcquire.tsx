import { type MouseEventHandler } from 'react';

import { useDevice } from '@suite/device';
import { Translation } from '@suite/intl';
import { acquireDeviceThunk } from '@suite-common/device';
import { Banner } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { injectDispatch } from '@trezor/redux-utils';

import { TroubleshootingTips } from 'src/components/suite/troubleshooting/TroubleshootingTips';
import {
    TROUBLESHOOTING_TIP_CLOSE_ALL_TABS,
    TROUBLESHOOTING_TIP_RECONNECT,
} from 'src/components/suite/troubleshooting/tips';
import { PHYLAX_IS_BLUETOOTH_ENABLED } from 'src/constants/suite/phylax';

export const DeviceAcquire = () => {
    const { isLocked } = useDevice();
    const { dispatch } = useServices(injectDispatch);

    const isDeviceLocked = isLocked();

    const handleClick: MouseEventHandler = e => {
        e.stopPropagation();
        dispatch(acquireDeviceThunk({}));
    };

    const ctaButton = (
        <Banner.Button
            data-testid="@device-acquire"
            isLoading={isDeviceLocked}
            onClick={handleClick}
            size="small"
        >
            <Translation id="TR_TRY_AGAIN" />
        </Banner.Button>
    );

    const tips = [TROUBLESHOOTING_TIP_CLOSE_ALL_TABS, TROUBLESHOOTING_TIP_RECONNECT];

    return (
        <TroubleshootingTips
            label={
                // PHYLAX Blocks (fork): USB only
                <Translation
                    id={
                        PHYLAX_IS_BLUETOOTH_ENABLED
                            ? 'TR_NEEDS_ATTENTION_CONNECT_USB_OR_BLUETOOTH'
                            : 'TR_NEEDS_ATTENTION_CONNECT_USB'
                    }
                />
            }
            cta={ctaButton}
            items={tips}
        />
    );
};
