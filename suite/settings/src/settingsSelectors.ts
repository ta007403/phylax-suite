import { type ExperimentalFeature } from '@suite/experimental';
import { defaultEarnYieldWorkerBaseUrl } from '@suite-common/earn-stablecoin-api';

import { type SuiteSettingsRootState } from './settingsSlice';

// PHYLAX Blocks (fork): PHYLAX Suite is English only and always dark (PHYLAX
// colours, packages/theme/src/colors.ts), whatever was saved or the OS uses.
const PHYLAX_LANGUAGE = 'en-US' as const;
const PHYLAX_THEME = 'dark' as const;

export const selectSuiteSettings = (state: SuiteSettingsRootState) => state.suiteSettings;
export const selectLanguage = (_state: SuiteSettingsRootState) => PHYLAX_LANGUAGE;
export const selectThemeSettings = (state: SuiteSettingsRootState) => state.suiteSettings.theme;
export const selectTheme = (_state: SuiteSettingsRootState) => PHYLAX_THEME;
export const selectDebugSettings = (state: SuiteSettingsRootState) => state.suiteSettings.debug;
export const selectAutodetectLanguage = (_state: SuiteSettingsRootState) => false;
export const selectAutodetectTheme = (_state: SuiteSettingsRootState) => false;
export const selectTorOnionLinks = (state: SuiteSettingsRootState) =>
    state.suiteSettings.torOnionLinks;
export const selectIsCoinjoinReceiveWarningHidden = (state: SuiteSettingsRootState) =>
    state.suiteSettings.isCoinjoinReceiveWarningHidden;
export const selectIsUnlockedBootloaderAllowed = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.isUnlockedBootloaderAllowed;
export const selectDebugTransports = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.transports;
export const selectShowConnectLogs = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.showConnectLogs;
export const selectDefinitionsChannel = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.definitionsChannel;
export const selectTradeServerEnvironment = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.tradeServerEnvironment;
export const selectEarnYieldWorkerBaseUrl = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.earnYieldWorkerBaseUrl ?? defaultEarnYieldWorkerBaseUrl;
export const selectOAuthServerEnvironment = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.oauthServerEnvironment;
export const selectExperimentalFeatures = (state: SuiteSettingsRootState) =>
    state.suiteSettings.experimental;
export const selectIsExperimentalEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.experimental !== undefined;
export const selectHasExperimentalFeature =
    (feature: ExperimentalFeature) => (state: SuiteSettingsRootState) =>
        state.suiteSettings.experimental?.includes(feature) ?? false;
export const selectIsTestnetNetworksEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.isTestnetNetworksEnabled;
export const selectIsNftSectionEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.isNftSectionEnabled;
export const selectIsDeviceAuthenticityCheckEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.enabledSecurityChecks.deviceAuthenticity;
export const selectIsEntropyCheckEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.enabledSecurityChecks.entropy;
export const selectIsFirmwareHashCheckEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.enabledSecurityChecks.firmwareHash;
export const selectIsFirmwareRevisionCheckEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.enabledSecurityChecks.firmwareRevision;
export const selectAreDeviceMetaChecksEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.enabledSecurityChecks.deviceMeta;
export const selectSidebarWidth = (state: SuiteSettingsRootState) =>
    state.suiteSettings.sidebarWidth;
export const selectIsCoinsFilterVisible = (state: SuiteSettingsRootState) =>
    state.suiteSettings.isCoinsFilterVisible;
export const selectIsN4w1BackupEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.isN4w1BackupEnabled;
export const selectShowTranslationKeys = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.showTranslationKeys;
export const selectIsAppsEmbeddingEnabled = (state: SuiteSettingsRootState) =>
    state.suiteSettings.debug.isAppsEmbeddingEnabled;
