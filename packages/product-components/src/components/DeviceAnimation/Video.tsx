import { type MouseEventHandler } from 'react';

import styled from 'styled-components';

import { resolveStaticPath } from '@trezor/env-utils';

const StyledVideo = styled.video`
    max-width: 100%;
    max-height: 100%;
`;

type VideoProps = {
    src: string;
    loop: boolean;
    autoPlay: boolean;
    videoRef: React.Ref<HTMLVideoElement>;
    onMouseOver?: MouseEventHandler<HTMLVideoElement>;
    onEnded?: () => void;
    rerenderKey: string;
};

export const Video = ({
    src,
    loop,
    videoRef,
    onMouseOver,
    rerenderKey,
    autoPlay,
    onEnded,
}: VideoProps) => {
    const commonProps = {
        loop,
        autoPlay,
        muted: true,
        ref: videoRef,
        onMouseOver,
        onEnded,
    };

    return (
        // no Cast / picture-in-picture button over the device animation (Chromium shows a Cast
        // button over videos when it finds a Cast device on the network, e.g. on the PHYLAX station)
        <StyledVideo
            key={rerenderKey}
            preload="auto"
            disableRemotePlayback
            disablePictureInPicture
            {...commonProps}
        >
            <source src={resolveStaticPath(src)} type="video/webm" />
        </StyledVideo>
    );
};
