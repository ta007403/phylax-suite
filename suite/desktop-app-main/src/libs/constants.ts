import { isDevEnv } from '@suite-common/suite-utils';

// PHYLAX Blocks (fork)
export const APP_NAME_BARE = 'PHYLAX Suite';
export const APP_NAME = `${APP_NAME_BARE}${isDevEnv ? ' Local' : ''}`;
