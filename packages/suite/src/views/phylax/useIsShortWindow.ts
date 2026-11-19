import { useSyncExternalStore } from 'react';

// PHYLAX Blocks (fork): the station's 7" screen is 1024x600. Below this window height, the screens
// that open the app (connect, "used this device before?") use smaller pictures and a side-by-side
// layout so their buttons stay on the screen without scrolling.
const SHORT_WINDOW_QUERY = '(max-height: 700px)';

const getMediaQuery = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(SHORT_WINDOW_QUERY)
        : undefined;

const subscribe = (onChange: () => void) => {
    const mediaQuery = getMediaQuery();
    mediaQuery?.addEventListener('change', onChange);

    return () => mediaQuery?.removeEventListener('change', onChange);
};

const getSnapshot = () => getMediaQuery()?.matches ?? false;

export const useIsShortWindow = () => useSyncExternalStore(subscribe, getSnapshot, () => false);
