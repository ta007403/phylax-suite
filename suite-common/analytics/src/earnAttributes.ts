import { type AttributeDef } from './eventDefinition';

export const deviceConnectionRequiredAttribute = {
    description:
        "Snapshot on a transaction-submit continue click, before the device connection guard. True when the selected device does not satisfy that platform's connection guard (including a connected but unavailable desktop device). False when it does. Blocked clicks are reported too; repeated attempts are separate clicks. Omitted on education, skips, simulation decisions and transaction outcomes. Does not track dismissal of the connection prompt or guarantee that signing can succeed.",
    changelog: [{ version: '26.11.0', notes: 'added for Desktop and Mobile Earn submit attempts' }],
} satisfies AttributeDef<boolean>;
