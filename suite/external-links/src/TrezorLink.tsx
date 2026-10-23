import { Link, type LinkProps } from '@trezor/components';

import { PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED } from './phylax';
import { useExternalLink } from './useExternalLink';

export const TrezorLink = ({ href, ...props }: LinkProps) => {
    const url = useExternalLink(href);

    // PHYLAX Blocks (fork): keep the words of the sentence, drop the link.
    if (!PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED) {
        return <>{props.children}</>;
    }

    return <Link {...props} href={url} />;
};
