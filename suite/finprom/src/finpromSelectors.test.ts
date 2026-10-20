import { suiteSettingsInitialState } from '@suite/settings';
import { mockFinpromMessageSystemState } from '@suite-common/finprom/mocks';
import { type Locale } from '@suite-common/locale';

import { selectIsFinpromRestricted } from './finpromSelectors';

describe(selectIsFinpromRestricted.name, () => {
    it.each([
        ['restricted: Czech language with CZ listed', 'cs-CZ', true],
        ['not restricted: English language with CZ listed', 'en-US', false],
    ] as const satisfies [string, Locale, boolean][])('%s', (_description, language, expected) => {
        const state = {
            messageSystem: mockFinpromMessageSystemState({
                flag: true,
                payload: { countries: ['CZ'] },
            }),
            suiteSettings: { ...suiteSettingsInitialState, language },
        };

        expect(selectIsFinpromRestricted(state)).toBe(expected);
    });
});
