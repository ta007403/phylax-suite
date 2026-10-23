import { useEffect } from 'react';

import { PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED } from '@suite/external-links';

// PHYLAX Blocks (fork): PHYLAX Suite never opens a website. Links to websites are hidden by
// GlobalStyle; this guard also refuses any that are still clicked or opened from code.
// Electron's main process refuses them as well (modules/external-links.ts).

const BLOCKED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

export const isPhylaxBlockedUrl = (url: string | URL | undefined, base: string) => {
    if (url === undefined || url === '') {
        return false;
    }
    try {
        const resolved = new URL(url, base);

        return (
            BLOCKED_PROTOCOLS.includes(resolved.protocol) &&
            resolved.origin !== new URL(base).origin
        );
    } catch {
        return true;
    }
};

export const PhylaxExternalLinkGuard = () => {
    useEffect(() => {
        if (PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED) {
            return;
        }

        const onClick = (event: MouseEvent) => {
            const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
            const href = anchor?.getAttribute('href') ?? undefined;
            if (isPhylaxBlockedUrl(href, window.location.href)) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        const originalOpen = window.open;
        window.open = (url, ...rest) =>
            isPhylaxBlockedUrl(url, window.location.href) ? null : originalOpen(url, ...rest);

        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);

        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('auxclick', onClick, true);
            window.open = originalOpen;
        };
    }, []);

    return null;
};
