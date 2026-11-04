// Test fixture: a saved PHYLAX 2-of-2 as PhylaxGetWallet returns it.

import type { PROTO } from '@trezor/connect';

const node = (fingerprint: number, chainCode: string, publicKey: string): PROTO.HDNodeType => ({
    depth: 4,
    fingerprint,
    child_num: 0x80000002,
    chain_code: chainCode,
    public_key: publicKey,
});

// The 2-of-2 of the PHYLAX firmware tests: main block "all all ... all" (5c9e228d) and key block
// "abandon ... about" (73c5da0a), sorted by fingerprint as the main block stores them.
export const WALLET: PROTO.PhylaxWallet = {
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
