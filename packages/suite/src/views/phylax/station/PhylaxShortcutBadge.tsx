// PHYLAX Blocks (fork): the keyboard shortcut badge in tooltips, hidden on the PHYLAX wallet station
// (trackpad only, no keyboard to press the shortcuts with). Elsewhere it is Trezor's ShortcutBadge.

import { ShortcutBadge, type ShortcutBadgeProps } from '@trezor/components';

import { usePhylaxStationInfo } from './usePhylaxStationInfo';

export const PhylaxShortcutBadge = (props: ShortcutBadgeProps) => {
    const isPhylaxStation = usePhylaxStationInfo() !== null;

    return isPhylaxStation ? null : <ShortcutBadge {...props} />;
};
