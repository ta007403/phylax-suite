/**
 * Opens external links in the default browser (displays a warning when using Tor)
 */
import { dialog, shell } from 'electron';
import { type HandlerDetails } from 'electron/main';

import * as config from '../config';
import type { ModuleInit } from './module';

export const SERVICE_NAME = 'external-links';

// PHYLAX Blocks (fork): PHYLAX Suite never opens a website, not even in the default browser.
export const PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED: boolean = false;

export const init: ModuleInit = ({ mainWindowProxy, store, logger }) => {
    mainWindowProxy.on('init', mainWindow => {
        // PHYLAX Blocks (fork): the window may only navigate within the app itself.
        mainWindow.webContents.on('will-navigate', (event, url) => {
            if (PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED) {
                return;
            }
            const { protocol } = new URL(url);
            if (protocol === 'http:' || protocol === 'https:') {
                const current = mainWindow.webContents.getURL();
                const isSameOrigin = !!current && new URL(current).origin === new URL(url).origin;
                if (!isSameOrigin) {
                    logger.info(SERVICE_NAME, `${url} was blocked (PHYLAX)`);
                    event.preventDefault();
                }
            }
        });

        mainWindow.webContents.setWindowOpenHandler((details: HandlerDetails) => {
            const { url } = details;

            if (!PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED) {
                logger.info(SERVICE_NAME, `${url} was blocked (PHYLAX)`);

                return { action: 'deny' };
            }
            const { protocol } = new URL(url);

            // https://benjamin-altpeter.de/shell-openexternal-dangers/
            if (!config.allowedProtocols.includes(protocol)) {
                logger.error(SERVICE_NAME, `Protocol '${protocol}' not allowed`);

                return { action: 'deny' };
            }

            if (config.oauthUrls.some(u => url.startsWith(u))) {
                logger.info(SERVICE_NAME, `${url} was allowed (OAuth list)`);
            }

            if (url !== mainWindow.webContents.getURL()) {
                const torSettings = store.getTorSettings();
                if (torSettings.running) {
                    // TODO: Replace with in-app modal
                    const result = dialog.showMessageBoxSync(mainWindow, {
                        type: 'warning',
                        message: "You're leaving Trezor Suite",
                        detail: `This link will open in your default browser, outside Tor protection. Verify the URL before continuing.\n\n${url}`,
                        buttons: ['Cancel', 'Continue'],
                    });
                    const cancel = result === 0;
                    logger.info(
                        SERVICE_NAME,
                        `${url} was ${cancel ? 'not ' : ''}allowed by user in TOR mode`,
                    );

                    if (cancel) {
                        // do nothing
                        return { action: 'deny' };
                    }
                }
                logger.info(SERVICE_NAME, `${url} opened in default browser`);
            }

            // open URL in the user's default browser instead of headless browser window
            shell.openExternal(url).catch(err =>
                dialog.showMessageBoxSync(mainWindow, {
                    type: 'error',
                    message: `${err} ${url}`,
                }),
            );

            // do not open headless browser window
            return { action: 'deny' };
        });
    });
};
