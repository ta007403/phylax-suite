import styled from 'styled-components';

import { resolveStaticPath } from '@trezor/env-utils';
import { typography } from '@trezor/theme';

// PHYLAX Blocks (fork): PHYLAX logo in place of the Trezor one.
const PHYLAX_MARK_PATH = 'images/favicons/phylax-mark.png';

const Wrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    user-select: none;
`;

const Mark = styled.img<{ $size: number }>`
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
`;

const Wordmark = styled.span`
    ${typography['headline-sm']}
    color: ${({ theme }) => theme.contentPrimary};
    font-weight: 700;
    letter-spacing: 0.12em;
`;

type PhylaxLogoProps = {
    isSymbolOnly?: boolean;
    size?: number;
};

export const PhylaxLogo = ({ isSymbolOnly = false, size = 28 }: PhylaxLogoProps) => (
    <Wrapper data-testid="@phylax/logo">
        <Mark $size={size} src={resolveStaticPath(PHYLAX_MARK_PATH)} alt="PHYLAX" />
        {!isSymbolOnly && <Wordmark>PHYLAX</Wordmark>}
    </Wrapper>
);
