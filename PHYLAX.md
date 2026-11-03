# PHYLAX Suite

A fork of Trezor Suite for **PHYLAX Snap** (formerly PHYLAX Blocks): snap-together n-of-n multisig built from Trezor One
boards (firmware: [ta007403/phylax-firmware](https://github.com/ta007403/phylax-firmware), branch
`phylax`). Personal project, not affiliated with Trezor / SatoshiLabs.

Everything added for PHYLAX is marked `PHYLAX Blocks (fork)` in the code (the old product name, kept as a search tag).

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
- **PHYLAX logo** in the sidebar instead of Trezor's; no MEV protection, network reserve, device
  wallpaper or "Install custom firmware" settings (PHYLAX firmware is installed with trezorctl).
  Device and firmware authenticity checks are shown only for devices they apply to (real
  Trezors).
- **Wording**: "PHYLAX Suite" instead of "Trezor Suite", and "your device" instead of "your
  Trezor" in the English texts (`suite/intl/src/messages.ts`); real Trezor model and product
  names stay. Other languages still say Trezor.
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

## Backlog

Open items, newest first. Remind the owner of these at the start of the next session.

| Added      | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 2026-11-03 | **Firmware repo, "New key block found. Set it up?" screen** (main block, `phylax_setup.c` `show_prompt`): the last lines "You will choose a PIN / and write down 24 / words on the block." are cut at the bottom by the No / Set up buttons. Move the text up 2-3 px (or shorten it to two lines); check the other `layoutDialog` screens with three text lines and buttons.                                                                                                                                                                                                                                                                                                                                                                                              | To do (reported)          |
| 2026-11-03 | **Firmware repo, bootloader screen:** in bootloader mode "PHYLAX / Bootloader / 1.12.2" is centred at x = 90, so "Bootloader" (53 px wide) starts at x = 64, right against the logo (ends at x = 63). Move the three lines 4-5 px right (centre at x = 94-95; `legacy/bootloader/bootloader.c`, `bootloader_loop`). A bootloader change reaches only boards flashed with ST-Link afterwards (locked boards keep theirs); add the new bootloader hash to `phylax_bl_hashes.h`.                                                                                                                                                                                                                                                                                             | To do (reported)          |
| 2026-11-03 | **High priority.** "Your device may have been compromised - The security check (entropy verification) failed" on the main block (seen twice, both times with the key block attached). Found so far: this is Suite's _discovery_ entropy check (`discoverAccounts.ts` `checkEntropy`): the xpub the device returns during account discovery for `m/84'/0'/0'` does not match the hash Suite stored, per device id, when the wallet was created with the entropy check. The failure is persisted per device and also sent to `reportSecurityCheck` (Sentry): check that sink is off in PHYLAX Suite. Next: find why the main block's xpub differs from the one at creation (firmware reinstall, relay/select mode, coin/dice change), reproduce in the emulator with Suite. | Investigating             |
| 2026-11-03 | **Cannot eject the wallet** in PHYLAX Suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | To investigate (reported) |
| 2026-11-03 | **Cannot connect a wallet** with the button in the upper right corner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | To investigate (reported) |
| 2026-11-03 | A key block plugged into the PC directly shows "Firmware authenticity check failed": recognise it as "PHYLAX key block" and skip the Trezor check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Waiting: after RS485 test |
| 2026-11-03 | Device picture on the dashboard still shows "TREZOR"; yellow PHYLAX banner still mentions Trezor firmware authenticity checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Waiting for a decision    |
