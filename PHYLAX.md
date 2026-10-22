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

## Balances

Addresses are derived in Suite from the wallet's xpubs and looked up on Suite's own Blockbook
backends, address by address, until 20 unused addresses in a row on the receive and change chains.
Suite has no signet; signet coins do not show.

## Builds

- `.github/workflows/phylax-build-desktop-win.yml`: Windows installer on every push to `phylax`
  (artifact `phylax-suite-desktop-win`). Enable Actions on the fork first.
- Web development as upstream: `yarn suite:dev`, plus the bridge in emulator mode for the PHYLAX
  emulators (`node packages/transport-bridge/dist/bin.js udp`).
