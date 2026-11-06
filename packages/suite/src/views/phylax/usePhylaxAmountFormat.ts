// PHYLAX Blocks (fork): the amount format for Settings › Bitcoin units.

import { useMemo } from 'react';

import { selectAreSatsAmountUnit } from '@suite-common/wallet-core';

import { useSelector } from 'src/hooks/suite';

import { type PhylaxAmountFormat, getPhylaxAmountFormat } from './phylaxAmount';
import type { PhylaxNetwork } from './phylaxWallet';

export const usePhylaxAmountFormat = (network: PhylaxNetwork): PhylaxAmountFormat => {
    const isSats = useSelector(selectAreSatsAmountUnit);

    return useMemo(() => getPhylaxAmountFormat(network, isSats), [network, isSats]);
};
