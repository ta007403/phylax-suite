import { type SuiteSettingsRootState, selectLanguage } from '@suite/settings';
import {
    getPlaceholderCountryFromLocale,
    selectIsFinpromRestrictedForCountry,
} from '@suite-common/finprom';
import { type MessageSystemRootState } from '@suite-common/message-system';

type FinpromRootState = MessageSystemRootState & SuiteSettingsRootState;

const selectPresenceCountry = (state: SuiteSettingsRootState) =>
    getPlaceholderCountryFromLocale(selectLanguage(state));

export const selectIsFinpromRestricted = (state: FinpromRootState): boolean =>
    selectIsFinpromRestrictedForCountry(state, selectPresenceCountry(state));
