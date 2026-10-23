import { type MouseEvent } from 'react';

import { Translation } from '@suite/intl';
import { TextButton } from '@trezor/components';
import { LightbulbIcon } from '@trezor/icons';

import { PHYLAX_IS_GUIDE_ENABLED } from 'src/constants/suite/phylax';
import { useGuideOpenNode } from 'src/hooks/guide';

type OpenGuideFromTooltipProps = {
    id: string;
};

export const OpenGuideFromTooltip = ({ id }: OpenGuideFromTooltipProps) => {
    const { openNodeById } = useGuideOpenNode();

    // PHYLAX Blocks (fork): no "Learn" buttons, the Trezor guide is not offered
    if (!PHYLAX_IS_GUIDE_ENABLED) return null;

    return (
        <TextButton
            intent="neutral"
            priority="secondary"
            onClick={(e: MouseEvent<any>) => {
                e.stopPropagation();
                openNodeById(id);
            }}
            size="small"
            iconLeft={LightbulbIcon}
        >
            <Translation id="TR_LEARN" />
        </TextButton>
    );
};
