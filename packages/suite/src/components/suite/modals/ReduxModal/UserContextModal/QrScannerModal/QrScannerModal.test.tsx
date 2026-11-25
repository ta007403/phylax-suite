import '@suite-common/test-utils/globalOverrides';

import { screen } from '@testing-library/react';

import { type PhylaxStationInfo } from '@suite/desktop-app-api';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import { createDeferred } from '@trezor/utils';

import { type AppState } from 'src/reducers/store';
import { renderWithProviders } from 'src/support/test-utils/hooksHelper';
import { usePhylaxStationInfo } from 'src/views/phylax/station/usePhylaxStationInfo';

import { QrScannerModal } from './QrScannerModal';
import { mockInitialAppState } from '../../../../../../../mocks/mockInitialAppState';

jest.mock('@suite-common/tx-simulation', () => ({}));

jest.mock('@suite/intl', () => ({
    ...jest.requireActual('@suite/intl'),
    Translation: ({ id }: { id: string }) => <span>{id}</span>,
}));

jest.mock('src/views/phylax/station/usePhylaxStationInfo', () => ({
    usePhylaxStationInfo: jest.fn(),
}));

// the camera and image readers themselves (zxing) are not under test, only which one is shown
jest.mock('./QrScannerModalContent', () => ({
    QrScannerModalContent: ({ activeTab }: { activeTab: string }) => (
        <span>{`reader: ${activeTab}`}</span>
    ),
}));

const stationInfo: PhylaxStationInfo = {
    imageVersion: '20261125-test',
    imageKind: 'dev',
    suiteVersion: 'test',
    base: 'Buildroot',
};

const renderModal = () => {
    const { services } = createTestCompositionRoot<object, AppState>({
        preloadedState: mockInitialAppState as AppState,
        services: () => ({}),
    });

    return renderWithProviders(
        services,
        <QrScannerModal decision={createDeferred<string>()} onCancel={jest.fn()} />,
    );
};

describe('QrScannerModal', () => {
    it('offers the camera and an image file', async () => {
        jest.mocked(usePhylaxStationInfo).mockReturnValue(null);
        renderModal();

        expect(screen.getByText('TR_QR_TAB_CAMERA')).toBeTruthy();
        expect(screen.getByText('TR_QR_TAB_IMAGE')).toBeTruthy();
        expect(await screen.findByText('reader: camera')).toBeTruthy();
    });

    it('PHYLAX station: camera only, no image file picker', async () => {
        jest.mocked(usePhylaxStationInfo).mockReturnValue(stationInfo);
        renderModal();

        expect(screen.queryByText('TR_QR_TAB_IMAGE')).toBeNull();
        expect(screen.queryByText('TR_QR_TAB_CAMERA')).toBeNull();
        expect(await screen.findByText('reader: camera')).toBeTruthy();
    });
});
