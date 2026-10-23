import { configureStore } from '@reduxjs/toolkit';

import { mockActionType, mockReducer } from '@trezor/redux-utils/mocks';

import { selectAutodetectLanguage, selectLanguage, selectTheme } from './settingsSelectors';
import {
    prepareSuiteSettingsReducer,
    suiteSettingsActions,
    suiteSettingsInitialState,
} from './settingsSlice';

const suiteSettingsReducer = prepareSuiteSettingsReducer({
    actionTypes: { storageLoad: mockActionType('storageLoad') },
    reducers: { storageLoadSuiteSettings: mockReducer() },
});

const initStore = (preloadedState = suiteSettingsInitialState) =>
    configureStore({
        reducer: { suiteSettings: suiteSettingsReducer },
        preloadedState: { suiteSettings: preloadedState },
    });

// PHYLAX Blocks (fork): PHYLAX Suite is English only and always dark.
describe('settingsSlice', () => {
    it('returns English, dark and no autodetection through selectors', () => {
        const store = initStore();

        expect(selectLanguage(store.getState())).toBe('en-US');
        expect(selectTheme(store.getState())).toBe('dark');
        expect(selectAutodetectLanguage(store.getState())).toBe(false);
    });

    it('stays English after a language change', () => {
        const store = initStore();

        store.dispatch(suiteSettingsActions.setLanguage('cs-CZ'));

        expect(selectLanguage(store.getState())).toBe('en-US');
    });
});
