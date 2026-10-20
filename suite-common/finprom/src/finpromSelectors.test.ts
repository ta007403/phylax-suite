import { type CountryCode } from '@suite-common/geolocation';

import { selectIsFinpromRestrictedForCountry } from './finpromSelectors';
import { type MockFinpromFeature, mockFinpromMessageSystemState } from '../mocks';

describe(selectIsFinpromRestrictedForCountry.name, () => {
    it.each([
        ['not restricted: no finprom entry', undefined, 'GB', false],
        ['not restricted: flag off', { flag: false, payload: { countries: ['GB'] } }, 'GB', false],
        ['not restricted: flag on without payload', { flag: true }, 'GB', false],
        [
            'not restricted: flag on with empty countries',
            { flag: true, payload: { countries: [] } },
            'GB',
            false,
        ],
        [
            'not restricted: flag on with only invalid countries',
            { flag: true, payload: { countries: ['ZZ', 1] } },
            'GB',
            false,
        ],
        [
            'not restricted: unknown user country',
            { flag: true, payload: { countries: ['GB'] } },
            null,
            false,
        ],
        [
            'not restricted: user country not listed',
            { flag: true, payload: { countries: ['GB'] } },
            'CZ',
            false,
        ],
        [
            'restricted: user country listed',
            { flag: true, payload: { countries: ['CZ', 'GB'] } },
            'GB',
            true,
        ],
    ] as const satisfies [string, MockFinpromFeature | undefined, CountryCode | null, boolean][])(
        '%s',
        (_description, finpromFeature, country, expected) => {
            const state = { messageSystem: mockFinpromMessageSystemState(finpromFeature) };

            expect(selectIsFinpromRestrictedForCountry(state, country)).toBe(expected);
        },
    );
});
