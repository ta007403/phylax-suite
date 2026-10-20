import {
    Feature as FeatureDefinitions,
    type MessageSystemState,
    messageSystemInitialState,
} from '@suite-common/message-system';
import { type Feature } from '@suite-common/suite-types';

const FINPROM_MESSAGE_ID = 'mock-finprom-presence-restriction';

export type MockFinpromFeature = Pick<Feature, 'flag' | 'payload'>;

export const mockFinpromMessageSystemState = (
    finpromFeature?: MockFinpromFeature,
): MessageSystemState => {
    if (finpromFeature === undefined) {
        return messageSystemInitialState;
    }

    return {
        ...messageSystemInitialState,
        validMessages: {
            ...messageSystemInitialState.validMessages,
            feature: [FINPROM_MESSAGE_ID],
        },
        config: {
            version: 1,
            sequence: 1,
            timestamp: '2026-01-01T00:00:00.000Z',
            actions: [
                {
                    conditions: [],
                    message: {
                        id: FINPROM_MESSAGE_ID,
                        priority: 1,
                        dismissible: false,
                        variant: 'info',
                        category: 'feature',
                        content: { en: '', es: '', cs: '', de: '', fr: '', pt: '' },
                        feature: [
                            {
                                domain: FeatureDefinitions.finprom.presenceRestriction,
                                ...finpromFeature,
                            },
                        ],
                    },
                },
            ],
        },
    };
};
