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
  `phylax-firmware` (skipped) instead of failed, Suite shows no "Device compromised" warning
  (and no banner), and no firmware update is offered (it would replace
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

| Added      | Item                                                                                                                                                                                                                                                                                                                                                  | Status                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 2026-11-03 | **Cannot eject the wallet** / **Connect device does nothing** (PHYLAX Suite on Windows). Both work in the web app (eject asks "Eject this wallet?", then the wallet is ejected; Connect device opens the connect screen). Possibly the "compromised" state at the time. Next: owner retests with the new build; if still nothing, a screen recording. | Waiting for owner's test |
| 2026-11-03 | Device check screen on the dashboard: Trezor One picture without the logo (still picture instead of the rotating video). Other Trezor animations (bootloader, reconnect) still show the logo.                                                                                                                                                         | Partly done              |

### Done

| Added      | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Fixed in         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 2026-11-04 | "Can't encode address" / safety check "different key (960d89fe)" on Show on main block: a second Trezor (the owner's signing Trezor One) was plugged in, and Suite's requests reached it instead of the main block. The main block's seed was right all along (fresh session: dc3b2d16, as saved). Suite now asks the device who it is before every PHYLAX request and only goes on if it is the main block of that wallet, forgets the page's data when another device is selected, and warns when more than one Trezor is connected. Probably also behind "entropy verification failed"; owner to confirm. | Suite 3331187a3a |
| 2026-11-03 | Wallet created by a button press with no prompt on screen; screen jumped to the home screen every 2-3 s with Suite open. The PHYLAX prompt/status is the main block's home screen; prompts take only a press started while they are on screen (test_screen.py).                                                                                                                                                                                                                                                                                                                                              | firmware 4491f8f |
| 2026-11-03 | Locked key block shown as "Attach"; it could not be unlocked over RS485. It keeps reporting its fingerprint; the main block asks "Key block ... is locked. Unlock it ...?" and the PIN goes on the key block's own buttons (test_unlock.py).                                                                                                                                                                                                                                                                                                                                                                 | firmware e14b051 |
| 2026-11-03 | "Attach key block 2b69c617" ran off the screen: now two lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | firmware e14b051 |
| 2026-11-03 | "Set it up?" text cut by the buttons: five lines at most with buttons.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | firmware e14b051 |
| 2026-11-03 | Bootloader text touching the logo: centred at x = 94 (only boards flashed with ST-Link afterwards).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | firmware e14b051 |
| 2026-11-03 | Balance "Websocket closed unexpectedly": four lookups at a time, with retries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Suite 0f49e27b0f |
| 2026-11-03 | A key block plugged in directly showed "Firmware authenticity check failed": now "PHYLAX key block", checks skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Suite b48d550379 |
| 2026-11-03 | Yellow "PHYLAX custom firmware" banner removed; plain device picture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Suite ed2ce3a171 |
