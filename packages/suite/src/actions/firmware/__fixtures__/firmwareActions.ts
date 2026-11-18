import {
    PHYLAX_NO_FIRMWARE_INSTALL_ERROR,
    firmwareActions,
    firmwareUpdateThunk,
} from '@suite-common/firmware';
import { mockGetFirmwareReleaseConfigInfo, mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { FirmwareType, UI_EVENTS } from '@trezor/connect';
import { DeviceModelInternal } from '@trezor/device-utils';

const bootloaderDevice = mockSuiteDevice({ mode: 'bootloader', connected: true });
const bootloaderDeviceNeedsIntermediary = {
    ...mockSuiteDevice(
        {
            mode: 'bootloader',
            connected: true,
            firmwareReleaseConfigInfo: {
                ...mockGetFirmwareReleaseConfigInfo(),
                intermediary: {
                    min_firmware_version: [1, 6, 2],
                    min_bootloader_version: [1, 6, 2],
                    version: 1,
                },
            },
        },
        { major_version: 1, internal_model: DeviceModelInternal.T1B1 },
    ),
};
const bootloaderDeviceNoIntermediaryT1 = {
    ...mockSuiteDevice(
        {
            mode: 'bootloader',
            connected: true,
            firmwareReleaseConfigInfo: {
                ...mockGetFirmwareReleaseConfigInfo(),
                intermediary: undefined,
            },
        },
        { major_version: 1, internal_model: DeviceModelInternal.T1B1 },
    ),
};
const firmwareUpdateResponsePayload = {
    check: 'valid',
    versionCheck: true,
};

export const actions = [
    // PHYLAX Blocks (fork): PHYLAX Suite never installs firmware. Whatever the device or the
    // firmware type, the thunk fails before Trezor Connect is asked to install anything (even a
    // Connect that would succeed).
    ...[
        { name: 'Trezor Model T in bootloader mode', device: bootloaderDevice },
        { name: 'Trezor One, intermediary needed', device: bootloaderDeviceNeedsIntermediary },
        { name: 'Trezor One, no intermediary', device: bootloaderDeviceNoIntermediaryT1 },
    ].flatMap(({ name, device }) =>
        [FirmwareType.Universal, FirmwareType.BitcoinOnly].map(firmwareType => ({
            description: `PHYLAX: no firmware installation (${name}, ${firmwareType})`,
            action: () => firmwareUpdateThunk({ firmwareType }),
            mocks: {
                connect: {
                    success: true,
                    payload: firmwareUpdateResponsePayload,
                },
            },
            initialState: {
                device: {
                    devices: [device],
                    selectedDevice: device,
                },
            },
            result: {
                actions: [
                    { type: firmwareActions.setStatus.type, payload: 'error' },
                    {
                        type: firmwareActions.setFirmwareUpdateError.type,
                        payload: PHYLAX_NO_FIRMWARE_INSTALL_ERROR,
                    },
                    {
                        type: firmwareUpdateThunk.rejected.type,
                        payload: { error: PHYLAX_NO_FIRMWARE_INSTALL_ERROR },
                    },
                ],
                state: { firmware: { status: 'error', error: PHYLAX_NO_FIRMWARE_INSTALL_ERROR } },
            },
        })),
    ),
    {
        description: 'Errors for missing device',
        action: () => firmwareUpdateThunk({ firmwareType: FirmwareType.Universal }),
        // typed like the PHYLAX entries above (spread entries are not unified with these)
        mocks: undefined,
        initialState: {
            device: {
                selectedDevice: undefined,
            },
        },
        result: {
            state: { firmware: { status: 'error' } },
        },
    },
    {
        description: 'resetReducer',
        action: () => firmwareActions.resetReducer(),
        result: {
            actions: [{ type: firmwareActions.resetReducer.type }],
        },
    },
];

// various cases to test reducer through actions
export const reducerActions = [
    {
        description: 'UI_EVENTS.FIRMWARE_PROGRESS',
        initialState: {},
        action: {
            type: UI_EVENTS.FIRMWARE_PROGRESS,
            payload: {
                operation: 'flashing',
                progress: 50,
            },
        },
        result: {
            state: {
                firmware: {
                    uiEvent: {
                        payload: {
                            operation: 'flashing',
                            progress: 50,
                        },
                    },
                },
            },
        },
    },
];
