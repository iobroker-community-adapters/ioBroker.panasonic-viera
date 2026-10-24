# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What it is

ioBroker adapter for Panasonic Viera Smart-TVs. It uses [node-panasonic-viera](https://github.com/jens-maus/node-panasonic-viera)
(SOAP on port 55000, encrypted for 2018+ TVs with Application ID + Encryption Key), pings the TV for
`info.connection`, polls volume and mute, and sends remote keys (NRC codes) when button states are written.

## Commands

```bash
npm run build              # build-backend + build-admin
npm run build-backend      # tsc -p tsconfig.build.json: src/ -> build/ (gitignored, common.nogit: true)
npm run build-admin        # tsx tasks.ts: src-admin/ (vite, module federation) -> admin/custom/ (gitignored)
npm run 0-clean|1-npm|2-build|3-copy   # single steps of build-admin
npm run check              # type check only
npm run lint               # eslint (@iobroker/eslint-config); fix with: npx eslint -c eslint.config.mjs --fix src
npm test                   # = test:package
npm run test:integration   # starts a real js-controller, fails if one is already running on the machine
npm run translate          # translate admin/i18n/en.json into the other languages
```

There is no `prepare` script on purpose: the build only runs via `npm run build` and in CI (`build: true`).
`src-admin/` is not linted / type-checked by the root config; check it with `cd src-admin && npx tsc`.
The integration test caches the test installation in `%TEMP%/test-iobroker.panasonic-viera`: after changing
`io-package.json` delete that folder, otherwise the old instance object is used.

## Architecture

- `src/main.ts` — `PanasonicVieraAdapter extends utils.Adapter`, compact-mode export at the end.
  - `onReady`: only starts if `ip` is set (not `0.0.0.0`); subscribes `*`, polls `checkStatus()` every 30 s.
  - `checkStatus()`: `ping` → `info.connection`; if alive `getMute` / `getVolume` → `basic.mute`, `basic.volume`,
    `info.tv_on` (false if the TV does not answer the SOAP request).
  - `onStateChange` (only `ack: false`): the last two ID parts (`basic.POWER`) are mapped via `STATE_KEY_MAP`
    (`src/lib/keys.ts`) to an NRC code; `basic.mute` / `basic.volume` set mute / volume; everything else is sent
    as key. Commands are only sent while the ping answers.
  - Every command opens a new session (`viera.connect()`), this was always like this.
  - `onMessage` (`common.messagebox: true`): `discover` → `[{ value: ip, label }]` for the `autocompleteSendTo` of the
    IP field (`src/lib/discovery.ts`: SSDP `urn:panasonic-com:device:p00RemoteController:1`, description via `fetch`).
  - `remote` `{ key }` (NRC code) from the remote control: sent also while the ping fails (power on), SOAP faults
    are reported, volume / mute are read back after their keys.
- `src-admin/src/RemoteControlComponent.tsx` — remote control in the "Remote control" tab (custom JsonConfig
  component, `guiApi: 2`, needs admin 8). Status via subscriptions of `info.connection`, `info.tv_on`,
  `basic.volume`, `basic.mute`. Texts in `src-admin/src/i18n` (`custom_panasonicviera_*`).
- `src/lib/tv.ts` — channel `tv` for the device type `tv` of the type-detector (>= 6.2.0), parallel to the old
  objects: `power` (`switch.power`), `key` (`media.key`, `TV_KEYS` → NRC), `volume` (`level.volume`), `muted`
  (`media.mute`), `volumeUp` / `volumeDown`, `input` (`media.input`, `TV_INPUTS` → NRC), `unreach`. Keys and
  labels of `common.states` must stay a subset of `TV_KEYS` / `TV_INPUTS`. No `app`: `sendAppCommand()` of the
  library sends malformed XML. `onStateChange` handles `.tv.` before the button states (their names are sent as
  keys). `updateVolume` / `updateMute` / `updatePower` keep `basic.*`, `info.tv_on` and `tv.*` in sync.
  The integration test checks the detection and runs against a simulated TV on 127.0.0.1:55000.
- `src/lib/viera.ts` — `getMute()` replacement: the one of the library never settles on errors (unhandled rejection).
- `src/types/node-panasonic-viera.d.ts` — the library has no typings. Note: `connect()` never rejects.
- `src/lib/adapter-config.d.ts` — typed `this.config`; must match `native` in `io-package.json` and
  `admin/jsonConfig.json`.

## Conventions

- Object IDs, roles, `native` keys and defaults must not change — existing installations depend on them.
- Timers only via `this.setTimeout` / `this.setInterval` so they are cleared on unload.
- `app_id` / `encryption_key` are plain text fields stored unencrypted in `native` (was always like this).

## Release

`npm run release-patch|minor|major` (`@alcalzone/release-script`, plugins `iobroker`, `license`, `manual-review`).
Add changelog lines under `### **WORK IN PROGRESS**` in `README.md`; do not edit `common.news` by hand.
