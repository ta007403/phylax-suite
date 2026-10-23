import { isPhylaxBlockedUrl } from './PhylaxExternalLinkGuard';

describe('isPhylaxBlockedUrl', () => {
    const base = 'http://localhost:8000/accounts';

    it.each([
        ['https://trezor.io/learn', true],
        ['http://example.onion/', true],
        ['mailto:support@trezor.io', true],
        ['//trezor.io', true],
        ['/settings', false],
        ['#/settings', false],
        ['http://localhost:8000/static/file.png', false],
        ['', false],
        [undefined, false],
    ])('%s -> %s', (url, expected) => {
        expect(isPhylaxBlockedUrl(url, base)).toBe(expected);
    });

    it('blocks every website from the desktop app', () => {
        expect(isPhylaxBlockedUrl('https://phylaxwallet.com/', 'file:///app/index.html')).toBe(
            true,
        );
        expect(isPhylaxBlockedUrl('./index.html#/', 'file:///app/index.html')).toBe(false);
    });
});
