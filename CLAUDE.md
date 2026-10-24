# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What it is

ioBroker adapter for Panasonic Viera Smart-TVs. It uses [node-panasonic-viera](https://github.com/jens-maus/node-panasonic-viera)
(SOAP on port 55000, encrypted for 2018+ TVs with Application ID + Encryption Key), pings the TV for
`info.connection`, polls volume and mute, and sends remote keys (NRC codes) when button states are written.

## Commands

```bash
npm run build              # tsc -p tsconfig.build.json: src/ -> build/ (gitignored, common.nogit: true)
npm run check              # type check only
npm run lint               # eslint (@iobroker/eslint-config); fix with: npx eslint -c eslint.config.mjs --fix src
npm test                   # = test:package
npm run test:integration   # starts a real js-controller, fails if one is already running on the machine
npm run translate          # translate admin/i18n/en.json into the other languages
```

There is no `prepare` script on purpose: the build only runs via `npm run build` and in CI (`build: true`).

## Architecture

- `src/main.ts` — `PanasonicVieraAdapter extends utils.Adapter`, compact-mode export at the end.
  - `onReady`: only starts if `ip` is set (not `0.0.0.0`); subscribes `*`, polls `checkStatus()` every 30 s.
  - `checkStatus()`: `ping` → `info.connection`; if alive `getMute` / `getVolume` → `basic.mute`, `basic.volume`,
    `info.tv_on` (false if the TV does not answer the SOAP request).
  - `onStateChange` (only `ack: false`): the last two ID parts (`basic.POWER`) are mapped via `STATE_KEY_MAP`
    (`src/lib/keys.ts`) to an NRC code; `basic.mute` / `basic.volume` set mute / volume; everything else is sent
    as key. Commands are only sent while the ping answers.
  - Every command opens a new session (`viera.connect()`), this was always like this.
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
