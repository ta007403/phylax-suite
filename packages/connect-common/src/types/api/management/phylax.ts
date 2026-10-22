/**
 * PHYLAX Blocks: snap-together multisig built on Trezor One firmware (fork, not upstream Trezor).
 * The main block answers these; a stock Trezor answers Failure_UnexpectedMessage.
 */

import type { MessagesSchema as PROTO } from '@trezor/protobuf';

import type { CommonParams, Params, Response } from '../../params';

/** The blocks in the stack, the main block first. */
export declare function phylaxGetBlocks(params?: CommonParams): Response<PROTO.PhylaxBlocks>;

/** The saved wallets (summaries, without xpubs). */
export declare function phylaxGetWallets(params?: CommonParams): Response<PROTO.PhylaxWallets>;

/** One saved wallet with its xpubs, enough to build its descriptor. */
export declare function phylaxGetWallet(
    params: Params<PROTO.PhylaxGetWallet>,
): Response<PROTO.PhylaxWallet>;

/** Rename a saved wallet; the user confirms on the main block. */
export declare function phylaxSetWalletName(
    params: Params<PROTO.PhylaxSetWalletName>,
): Response<PROTO.Success>;

/** Delete a saved wallet from every block; the user confirms on the main block. */
export declare function phylaxDeleteWallet(
    params: Params<PROTO.PhylaxDeleteWallet>,
): Response<PROTO.Success>;
