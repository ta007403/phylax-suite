import {
    getPlaceholderCountryFromLocale,
    selectIsFinpromRestrictedForCountry,
} from '@suite-common/finprom';
import { type MessageSystemRootState } from '@suite-common/message-system';
import { type LocaleSliceRootState, selectSupportedLanguageLocale } from '@suite-native/intl';

type FinpromRootState = MessageSystemRootState & LocaleSliceRootState;

const selectPresenceCountry = (state: LocaleSliceRootState) =>
    getPlaceholderCountryFromLocale(selectSupportedLanguageLocale(state));

export const selectIsFinpromRestricted = (state: FinpromRootState): boolean =>
    selectIsFinpromRestrictedForCountry(state, selectPresenceCountry(state));
