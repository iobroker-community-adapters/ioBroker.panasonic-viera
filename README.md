![logo](admin/panasonic-viera.png)
# ioBroker.panasonic-viera

[![Build Status](https://github.com/iobroker-community-adapters/ioBroker.panasonic-viera/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/iobroker-community-adapters/ioBroker.panasonic-viera/actions/workflows/test-and-release.yml) ![Number of Installations](http://iobroker.live/badges/panasonic-viera-installed.svg) ![Number of Installations](http://iobroker.live/badges/panasonic-viera-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.panasonic-viera.svg)](https://www.npmjs.com/package/iobroker.panasonic-viera) [![Downloads](https://img.shields.io/npm/dm/iobroker.panasonic-viera.svg)](https://www.npmjs.com/package/iobroker.panasonic-viera)

[![NPM](https://nodei.co/npm/iobroker.panasonic-viera.png?downloads=true)](https://nodei.co/npm/iobroker.panasonic-viera/)

## A Panasonic Viera Smart-TV adapter for ioBroker

This is an ioBroker adapter for your Panasonic Viera Smart-TV.

## Setup and pairing

### 1. Prepare the TV

1. Switch the TV on.
2. Open `Menu -> Network -> TV Remote App Settings` and switch **all** of these **ON**:
    - **TV Remote**
    - **Powered On by Apps**
    - **Networked Standby**
3. Open `Menu -> Network -> Network Status -> Status Details` and note the IP address of the TV.
   Best give the TV a fixed IP address in your router, so it does not change later.

### 2. Find out whether your TV needs pairing

- **Older TVs (roughly before 2019)** talk to the adapter unencrypted. They need **no pairing**: enter only the IP
  address and leave **Application ID** and **Encryption Key** empty.
- **Newer TVs** only accept encrypted commands. They need an **Application ID** and an **Encryption Key**, which you
  get once by pairing with a PIN shown on the TV (step 3).

If you are not sure, try without pairing first: enter only the IP address, save, and press a key in the
**Remote control** tab. If the TV reacts, you are done. If not, pair it.

### 3. Pair the TV (newer TVs only)

The adapter cannot do the pairing itself yet. You do it once with the small Python tool
[panasonic-viera](https://github.com/florianholzapfel/panasonic-viera) on any computer in the same network as the TV
(Python 3 is required):

1. Install the tool:

    ```shell
    pip3 install panasonic-viera
    ```

    On Windows the commands are `pip` and `python` instead of `pip3` and `python3`.

2. Save the following script as `viera_pair.py` and replace `192.168.1.50` with the IP address of your TV:

    ```python
    import panasonic_viera

    rc = panasonic_viera.RemoteControl("192.168.1.50")
    # the TV shows a 4-digit PIN now, "ioBroker" is the name of the remote shown on the TV
    rc.request_pin_code(name="ioBroker")
    pin = input("Enter the PIN shown on the TV: ")
    rc.authorize_pin_code(pincode=pin)
    print("Application ID:", rc.app_id)
    print("Encryption Key:", rc.enc_key)
    ```

3. Make sure the TV is **on**, then run the script:

    ```shell
    python3 viera_pair.py
    ```

4. A PIN appears on the TV. Type it in and press Enter. Do it quickly: the PIN is only valid for a short time.
5. The script prints the **Application ID** and the **Encryption Key**. Keep them, you need them in the next step.

If it does not work:

- **No PIN appears** or the script ends with `Connection refused` / `timed out`: the TV must be **on** (not in standby),
  **TV Remote** must be switched on (step 1) and the IP address in the script must be the one of the TV.
- **The PIN is rejected**: it was typed wrong or too late. Run the script again, the TV shows a new PIN.
- **An error right after starting** on an older TV: older TVs do not support pairing - they need none (step 2).

### 4. Configure the adapter

1. Open the settings of the `panasonic-viera` instance.
2. **IP**: click into the field. TVs found in your network are offered for selection (the instance must be
   running for this). Otherwise type the IP address.
3. **Application ID** and **Encryption Key**: paste the values from step 3 (leave both empty for older TVs).
4. Save. The instance restarts with the new settings.
5. Check that it works: `panasonic-viera.0.info.connection` becomes `true` while the TV answers, and the
   **Remote control** tab of the settings controls the TV.

If the TV stops reacting after a firmware update or a factory reset, pair it again (step 3) and enter the new values.

## Channel `tv` (type-detector)

In addition to the existing objects the adapter creates the channel `panasonic-viera.0.tv`, which the ioBroker
type-detector (>= 6.2.0) recognizes as device type `tv`. Visualizations and the devices adapter can control the TV
with it:

| State            | Role                            | Description                                                         |
|------------------|---------------------------------|---------------------------------------------------------------------|
| `tv.power`       | `switch.power`                  | on / off (the TV has only a toggle key, it is sent only if needed)  |
| `tv.key`         | `media.key`                     | a key: `UP`, `DOWN`, `SELECT`, `BACK`, `HOME`, `NUMBER_1`, `RED`, ...   |
| `tv.volume`      | `level.volume`                  | volume 0-100                                                        |
| `tv.muted`       | `media.mute`                    | mute                                                                |
| `tv.volumeUp`    | `button.volume.up`              | volume up                                                           |
| `tv.volumeDown`  | `button.volume.down`            | volume down                                                         |
| `tv.input`       | `media.input`                   | `TV`, `HDMI1` ... `HDMI4`                                           |
| `tv.unreach`     | `indicator.maintenance.unreach` | the TV does not answer the ping                                     |

Switching the TV on via the network requires **Networked Standby** and **Powered On by Apps** on the TV.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
- (bluefox) The adapter was refactored to TypeScript and JsonConfig
- (bluefox) Fixed the buttons basic.VOLUP, basic.VOLDOWN and basic.LEFT, they sent an invalid key
- (bluefox) The adapter no longer restarts when the TV answers the ping but not the mute request
- (bluefox) The IP field offers the TVs found in the network
- (bluefox) Added a remote control to the instance settings (tab "Remote control", requires admin 8)
- (bluefox) Added the channel `tv` for the device type `tv` of the type-detector, so visualizations and the devices adapter can control the TV
- (copilot) Adapter requires node.js >= 22 now
- (iobroker-bot) Adapter requires node.js >= 20 now.
- (copilot) Adapter requires admin >= 7.7.22 now
- (copilot) Adapter requires js-controller >= 6.0.11 now
- (copilot) Adapter requires admin >= 7.6.17 now
- (copilot) **CI/CD**: Updated GitHub Copilot instructions template to v0.5.7

### 2.1.0 (2024-04-25)
* (mcm1957) Adapter requires node.js >= 18 and js-controller >= 5 now
* (mcm1957) Dependencies have been updated

### 2.0.0 (2021-05-09)
* (jens-maus) added support to set Application and Encryption Key in adapter admin
* (jens-maus) changed adapter to use node-panasonic-viera to support modern TV models

### 1.0.2
* (cyberindy) some fixes

### 1.0.1
* (ldittmar) compact mode compatibility added
* (ldittmar) add chinese support

### 1.0.0
* (ldittmar) Support of admin3

### 0.1.0
* (ldittmar) Test phase terminated. Adapter enabled.

### 0.0.5
* (ldittmar) Open beta test phase - please test it and give me feedback here as a issue or in the forum http://forum.iobroker.net/viewtopic.php?f=23&t=3854

### 0.0.1
* (ldittmar) initial release

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
The MIT License (MIT)

Copyright (c) 2023-2026 iobroker-community-adapters <iobroker-community-adapters@gmx.de>  
Copyright (c) 2018-2021 ldittmar <iobroker@lmdsoft.de>, Jens Maus <mail@jens-maus.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
