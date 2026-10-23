// PHYLAX Blocks (fork): Trezor Suite features this Bitcoin-only fork does not offer.
// The code stays (so upstream updates merge easily); these switches only hide the entry points.

/** Buy, sell and swap (Trezor's trading partners). */
export const PHYLAX_IS_TRADING_ENABLED: boolean = false;

/** Earn: staking and yield. */
export const PHYLAX_IS_EARN_ENABLED: boolean = false;

/** Trezor's promotional cards (referral, desktop app, trading and DeFi banners). */
export const PHYLAX_ARE_PROMOTIONS_ENABLED: boolean = false;
