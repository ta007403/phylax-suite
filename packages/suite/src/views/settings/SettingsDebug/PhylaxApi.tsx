// PHYLAX Blocks (fork): the PHYLAX API used for scans of PHYLAX wallets (phylaxApi.ts), instead of
// the built-in one: e.g. one running on a laptop for testing. Empty: the built-in one.

import { useState } from 'react';

import { selectDebugSettings, suiteSettingsActions } from '@suite/settings';
import { Button, Input } from '@trezor/components';
import { useServices } from '@trezor/dependency-injection';
import { SectionItem } from '@trezor/product-components';
import { injectDispatch } from '@trezor/redux-utils';

import { PHYLAX_API_DEFAULT_URL } from 'src/constants/suite/phylax';
import { useSelector } from 'src/hooks/suite';

export const PhylaxApi = () => {
    const storedUrl = useSelector(state => selectDebugSettings(state).phylaxApiUrl ?? '');
    const { dispatch } = useServices(injectDispatch);
    const [inputValue, setInputValue] = useState(storedUrl);

    const save = (url: string) => {
        setInputValue(url);
        dispatch(suiteSettingsActions.setDebugMode({ phylaxApiUrl: url || undefined }));
    };

    return (
        <SectionItem
            title="PHYLAX API URL"
            description={`Scans of PHYLAX wallets (any network). Empty: ${
                PHYLAX_API_DEFAULT_URL || 'none built in'
            } (mainnet). Without an answer, scans use the coin's backend. The desktop app reaches only the built-in host and localhost.`}
            actions={
                <Input
                    data-testid="@settings/debug/phylax-api/url-input"
                    value={inputValue}
                    placeholder="http://127.0.0.1:8095"
                    onChange={e => setInputValue(e.target.value)}
                    rightContent={
                        inputValue.trim() === storedUrl ? (
                            <Button
                                data-testid="@settings/debug/phylax-api/reset-button"
                                onClick={() => save('')}
                                size="small"
                                intent="neutral"
                                isDisabled={!storedUrl}
                            >
                                Reset
                            </Button>
                        ) : (
                            <Button
                                data-testid="@settings/debug/phylax-api/save-button"
                                onClick={() => save(inputValue.trim())}
                                size="small"
                            >
                                Save
                            </Button>
                        )
                    }
                />
            }
        />
    );
};
