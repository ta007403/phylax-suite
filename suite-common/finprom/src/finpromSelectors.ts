import { type CountryCode } from '@suite-common/geolocation';
import {
    Feature,
    type MessageSystemRootState,
    getFeaturePayloadCountries,
    selectFeatureConfig,
} from '@suite-common/message-system';

export const selectIsFinpromRestrictedByCountry = (
    state: MessageSystemRootState,
    country: CountryCode | null,
): boolean => {
    if (country === null) {
        return false;
    }

    const feature = selectFeatureConfig(state, Feature.finprom.presenceRestriction);

    if (!feature?.flag) {
        return false;
    }

    return getFeaturePayloadCountries(feature, 'countries').includes(country);
};
