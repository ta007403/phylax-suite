# PHYLAX Suite

A fork of Trezor Suite for **PHYLAX Blocks**: snap-together n-of-n multisig built from Trezor One
boards (firmware: [ta007403/phylax-firmware](https://github.com/ta007403/phylax-firmware), branch
`phylax`). Personal project, not affiliated with Trezor / SatoshiLabs.

Everything added for PHYLAX is marked `PHYLAX Blocks (fork)` in the code.

## What it adds

- **PHYLAX page** (left menu, only while a PHYLAX main block is connected):
    - the stack: main block and key blocks, their seed fingerprints, ready / locked / no seed;
    - the saved wallets, each with its balance (mainnet or testnet4), its descriptor
      `wsh(sortedmulti(n,[fp/48h/coin'h/0h/2h]xpub/<0;1>/*,...))#checksum` with copy and QR code
      (for Sparrow), and Rename / Delete, both confirmed on the main block's buttons.
- **Connect methods** (privileged, Suite only): `phylaxGetBlocks`, `phylaxGetWallets`,
  `phylaxGetWallet`, `phylaxSetWalletName`, `phylaxDeleteWallet`, and the PHYLAX protobuf messages
  (7700-7708) in `@trezor/protobuf`.
- **Firmware checks**: connect asks a Trezor One once whether it is a PHYLAX main block
  (`PhylaxGetBlocks`). For such a device the firmware hash and revision checks are reported as
  `phylax-firmware` (skipped) instead of failed, Suite shows an amber "PHYLAX custom firmware"
  banner instead of "Device compromised", and no firmware update is offered (it would replace
  PHYLAX with stock firmware). Every other Trezor is checked exactly as before.
- **No reporting to Trezor**: Sentry and analytics are switched off in this fork.
- **Bitcoin only, no Trezor services**: other networks, Buy/Sell/Swap/Earn, Trezor's message system
  (announcements, banners, experiments), promotions, the guide/support button, Suite Sync, cloud
  labeling, NFTs, experimental features, connected apps and the analytics consent screen are all
  hidden or off. Switches are in `packages/suite/src/constants/suite/phylax.ts` and marked
  `PHYLAX Blocks (fork)` where they live elsewhere.
- **Never leaves the app**: no "Learn more" buttons and no links to websites (inline links become
  plain text, the rest are hidden). Opening a website is refused in the app and again in the
  desktop app's main process, and the Help menu has no "Trezor website". Switch:
  `PHYLAX_ARE_EXTERNAL_LINKS_ALLOWED` in `@suite/external-links` and in
  `suite/desktop-app-main/src/modules/external-links.ts`.
- **PHYLAX logo** in the sidebar instead of Trezor's; no MEV protection, network reserve or device
  wallpaper settings.
- **Never replaced by official Trezor Suite**: auto-updater off, no update feed, own app id, data
  folder, installer name, publisher and release notes.

## Balances

Addresses are derived in Suite from the wallet's xpubs and looked up on Suite's own Blockbook
backends, address by address, until 20 unused addresses in a row on the receive and change chains.
Suite has no signet; signet coins do not show.

## Builds

- `.github/workflows/phylax-build-desktop-win.yml`: Windows installer on every push to `phylax`
  (artifact `phylax-suite-desktop-win`). Enable Actions on the fork first.
- Web development as upstream: `yarn suite:dev`, plus the bridge in emulator mode for the PHYLAX
  emulators (`node packages/transport-bridge/dist/bin.js udp`).
