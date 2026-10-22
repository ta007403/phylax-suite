import type { PROTO } from '@trezor/connect';

import { getPhylaxAddress, getPhylaxDescriptor } from './phylaxWallet';

const node = (fingerprint: number, chainCode: string, publicKey: string): PROTO.HDNodeType => ({
    depth: 4,
    fingerprint,
    child_num: 0x80000002,
    chain_code: chainCode,
    public_key: publicKey,
});

// The 2-of-2 of the PHYLAX firmware tests: main block "all all ... all" (5c9e228d) and key block
// "abandon ... about" (73c5da0a), sorted by fingerprint as the main block stores them.
const WALLET: PROTO.PhylaxWallet = {
    slot: 0,
    name: '2-of-2 #1',
    threshold: 2,
    complete: true,
    keys: [
        {
            fingerprint: 0x5c9e228d,
            mainnet: node(
                0x9ba94c99,
                'd88ac6ae9ab10611d6ee532496c39aa2ba597ff1880df00eb119ba8034ef0537',
                '03c14f0c48a6b0e1c5b0b09c40e203c3f785a2d63aae7886020bdad96fcee43fa8',
            ),
            testnet: node(
                0x31fcbdcc,
                '3fc37ae2104367152e78a97b989e65027955100759e1a77e07399e1c4b1a8734',
                '022ec7311b52c5224da860e0d24bffe57cc13dc8a59ca78a0ba179efc57b38a3cf',
            ),
        },
        {
            fingerprint: 0x73c5da0a,
            mainnet: node(
                0x1cf29716,
                'bba0c7ca160a870efeb940ab90d0f4284fea1b5e0d2117677e823fc37e2d5763',
                '021a3bf5fbf737d0f36993fd46dc4913093beb532d654fe0dfd98bd27585dc9f29',
            ),
            testnet: node(
                0xbac14839,
                '1d4fbebdd967e1af714c0997d38fcf670b5ce9d301c0440bbcc3b6a20eb7721c',
                '03568ea1f36051916ed1b690c39e12a8e70603b280bd30ce5f281f2918a55363aa',
            ),
        },
    ],
};

describe('PHYLAX wallet', () => {
    it('builds the mainnet descriptor with key origins, both chains and checksum', () => {
        const descriptor = getPhylaxDescriptor(WALLET, 'mainnet');
        const [body, checksum] = descriptor.split('#');

        expect(body).toBe(
            'wsh(sortedmulti(2,' +
                '[5c9e228d/48h/0h/0h/2h]xpub6EgGHjcvovyN3nK921zAGPfuB41cJXkYRdt3tLGmiMyvbgHpss4X1eRZwShbEBb1znz2e2bCkCED87QZpin3sSYKbmCzQ9Sc7LaV98ngdeX/<0;1>/*,' +
                '[73c5da0a/48h/0h/0h/2h]xpub6DkFAXWQ2dHxq2vatrt9qyA3bXYU4ToWQwCHbf5XB2mSTexcHZCeKS1VZYcPoBd5X8yVcbXFHJR9R8UCVpt82VX1VhR28mCyxUFL4r6KFrf/<0;1>/*))',
        );
        // BIP380 checksum, cross-checked with embit's add_checksum
        expect(checksum).toBe('wf5grw0g');
    });

    it('builds the testnet descriptor with tpubs', () => {
        expect(getPhylaxDescriptor(WALLET, 'testnet')).toContain(
            '[5c9e228d/48h/1h/0h/2h]tpubDEGquuorgFNbDrg8vepq1HnaV2mgQu9TcSBgBYfXw4AX8VMgkWqvkxHNuJmiah8iVnA3Hgj4cSvaGAXEnq814yC6hMEreckLsd7zyLL3o76/<0;1>/*',
        );
    });

    it('derives the same addresses as the firmware tests and embit', () => {
        expect(getPhylaxAddress(WALLET, 'testnet', 0, 0)).toBe(
            'tb1qwsqvuucn402dasyuvx3xaph0rzep4wj0f7e9n9egae7utaktnmjsv0dtmy',
        );
        expect(getPhylaxAddress(WALLET, 'testnet', 0, 1)).toBe(
            'tb1qepjx2rtal0r02dpfg27ym7et9c6f3meqprn3qekej34j3w6lvzaqx4jwee',
        );
        expect(getPhylaxAddress(WALLET, 'testnet', 1, 0)).toBe(
            'tb1q6z2vrl5trpvksxkt75mat3tl3vr0kw8cffuufkmgmkk60wudzdyqk5d233',
        );
        expect(getPhylaxAddress(WALLET, 'mainnet', 0, 0)).toBe(
            'bc1qy0pkf83npee4x2rr4q9d56jnyqg44lxzsr23c8wgztqkgqm7dcpqpllqrc',
        );
        expect(getPhylaxAddress(WALLET, 'mainnet', 1, 0)).toBe(
            'bc1qzpyv5fzxelxa2m73p3vpsk5rrlaqms7yc3kcat4pe5ad422cjnjsk8sge5',
        );
    });
});
