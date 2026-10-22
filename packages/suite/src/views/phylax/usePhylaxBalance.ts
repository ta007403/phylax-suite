// PHYLAX Blocks (fork): balance of a saved PHYLAX wallet, from Suite's own backend (Blockbook),
// address by address on the receive and change chains until GAP_LIMIT unused addresses in a row.

import { useEffect, useState } from 'react';

import TrezorConnect, { type PROTO } from '@trezor/connect';

import {
    PHYLAX_COIN_SYMBOLS,
    type PhylaxChain,
    type PhylaxNetwork,
    getPhylaxAddress,
} from './phylaxWallet';

const GAP_LIMIT = 20;
const CHAINS: PhylaxChain[] = [0, 1];

export type PhylaxBalance =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | {
          status: 'loaded';
          // satoshis, including unconfirmed
          balance: bigint;
          usedAddressCount: number;
      };

const scanChain = async (
    wallet: PROTO.PhylaxWallet,
    network: PhylaxNetwork,
    chain: PhylaxChain,
) => {
    let balance = 0n;
    let usedAddressCount = 0;
    let lastUsedIndex = -1;
    let nextIndex = 0;

    while (nextIndex <= lastUsedIndex + GAP_LIMIT) {
        const from = nextIndex;
        const to = lastUsedIndex + GAP_LIMIT;
        const addresses: string[] = [];
        for (let index = from; index <= to; index++) {
            addresses.push(getPhylaxAddress(wallet, network, chain, index));
        }
        nextIndex = to + 1;

        // One request per address: connect's bundled getAccountInfo needs a device for its progress
        // events, and these lookups need none.
        const results = await Promise.all(
            addresses.map(address =>
                TrezorConnect.getAccountInfo({
                    coin: PHYLAX_COIN_SYMBOLS[network],
                    descriptor: address,
                    details: 'basic',
                }),
            ),
        );

        results.forEach((result, offset) => {
            if (!result.success) {
                throw new Error(result.error.message);
            }
            const info = result.payload;
            const isUsed = info.history.total > 0 || info.history.unconfirmed > 0;
            if (!isUsed) return;
            lastUsedIndex = from + offset;
            usedAddressCount++;
            // Blockbook: confirmed balance plus the pending (unconfirmed) change
            balance += BigInt(info.availableBalance);
        });
    }

    return { balance, usedAddressCount };
};

export const usePhylaxBalance = (
    wallet: PROTO.PhylaxWallet | undefined,
    network: PhylaxNetwork,
): PhylaxBalance => {
    const [state, setState] = useState<PhylaxBalance>({ status: 'loading' });

    useEffect(() => {
        if (!wallet) return;
        let isCancelled = false;
        setState({ status: 'loading' });

        Promise.all(CHAINS.map(chain => scanChain(wallet, network, chain)))
            .then(chains => {
                if (isCancelled) return;
                setState({
                    status: 'loaded',
                    balance: chains.reduce((sum, chain) => sum + chain.balance, 0n),
                    usedAddressCount: chains.reduce(
                        (sum, chain) => sum + chain.usedAddressCount,
                        0,
                    ),
                });
            })
            .catch((error: Error) => {
                if (isCancelled) return;
                setState({ status: 'error', error: error.message });
            });

        return () => {
            isCancelled = true;
        };
    }, [wallet, network]);

    return state;
};
