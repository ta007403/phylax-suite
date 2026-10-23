import { type ReactNode } from 'react';

import { Translation } from '@suite/intl';
import { Button, type ButtonProps } from '@trezor/components';
import { type Url } from '@trezor/urls';

import { PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED } from './phylax';
import { useExternalLink } from './useExternalLink';

interface LearnMoreButtonProps extends Omit<ButtonProps, 'children'> {
    url: Url;
    children?: ReactNode;
}

export const LearnMoreButton = ({
    children,
    size = 'small',
    url,
    ...buttonProps
}: LearnMoreButtonProps) => {
    const href = useExternalLink(url);

    // PHYLAX Blocks (fork): no "Learn more" buttons, they only open websites.
    if (!PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED) {
        return null;
    }

    return (
        <Button href={href} intent="neutral" priority="secondary" size={size} {...buttonProps}>
            {children || <Translation id="TR_LEARN_MORE" />}
        </Button>
    );
};
