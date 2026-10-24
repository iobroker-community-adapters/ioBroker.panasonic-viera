'use strict';

const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { tests } = require('@iobroker/testing');

const NS = 'panasonic-viera.0';

/**
 * A Viera without encryption on 127.0.0.1:55000 (the port is fixed in node-panasonic-viera): answers GetVolume,
 * GetMute and X_SendKey and records the keys.
 */
function startFakeTv(keys) {
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            const action = String(req.headers.soapaction || '');
            let answer = '';
            if (action.includes('#GetVolume')) {
                answer = '<CurrentVolume>17</CurrentVolume>';
            } else if (action.includes('#GetMute')) {
                answer = '<CurrentMute>1</CurrentMute>';
            } else if (action.includes('#X_SendKey')) {
                keys.push(/<X_KeyEvent>([^<]*)<\/X_KeyEvent>/.exec(body)[1]);
            } else if (action.includes('#X_GetAppList')) {
                // the format of the TV: one string, apostrophes escaped
                answer =
                    '<X_AppList>vc_app&apos;product_id=0070000200180001&apos;YouTube&apos;http://a/1.png&apos;' +
                    'vc_app&apos;product_id=0010000200000001&apos;Netflix&apos;http://a/2.png&apos;' +
                    'vc_app&apos;product_id=0387878700000050&apos;Multi Window&apos;http://a/3.png&apos;</X_AppList>';
            } else if (action.includes('#X_LaunchApp')) {
                // X_AppType must be a closed element (node-panasonic-viera 0.4.1 sends it unclosed)
                const launch = /<X_AppType>vc_app<\/X_AppType><X_LaunchKeyword>product_id=([0-9A-F]+)<\/X_LaunchKeyword>/.exec(
                    body,
                );
                keys.push(launch ? `APP:${launch[1]}` : 'APP:malformed');
            }
            res.writeHead(200, { 'Content-Type': 'text/xml' });
            res.end(`<?xml version="1.0"?><s:Envelope><s:Body>${answer}</s:Body></s:Envelope>`);
        });
    });
    return new Promise(resolve => server.listen(55000, '127.0.0.1', () => resolve(server)));
}

/**
 * An encrypted Viera on 127.0.0.1:55000 that supports only the PIN pairing (X_DisplayPinCode, X_RequestAuth).
 * The crypto follows the Python library panasonic-viera (checked against it in a separate run).
 */
function startPairingTv(pin, appId, keyword) {
    const crypto = require('node:crypto');
    const MASK = [
        0x15, 0xc9, 0x5a, 0xc2, 0xb0, 0x8a, 0xa7, 0xeb, 0x4e, 0x22, 0x8f, 0x81, 0x1e, 0x34, 0xd0, 0x4f, 0xa5, 0x4b,
        0xa7, 0xdc, 0xac, 0x98, 0x79, 0xfa, 0x8a, 0xcd, 0xa3, 0xfc, 0x24, 0x4f, 0x38, 0x54,
    ];
    let iv = null;
    const keys = () => {
        const key = Buffer.alloc(16);
        const hmacKey = Buffer.alloc(32);
        for (let i = 0; i < 16; i++) {
            // key: inverted IV, byte order reversed in every 4 byte word
            key[i] = ~iv[(i & ~3) + 3 - (i & 3)] & 0xff;
        }
        for (let i = 0; i < 32; i++) {
            hmacKey[i] = MASK[i] ^ iv[((i & ~3) + [2, 3, 0, 1][i & 3]) & 0xf];
        }
        return { key, hmacKey };
    };
    const fault = (code, text) =>
        `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><detail>` +
        `<UPnPError><errorCode>${code}</errorCode><errorDescription>${text}</errorDescription></UPnPError>` +
        `</detail></s:Fault></s:Body></s:Envelope>`;

    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            const action = String(req.headers.soapaction || '');
            let status = 200;
            let answer = '';
            if (action.includes('#X_DisplayPinCode')) {
                iv = crypto.randomBytes(16);
                answer = `<X_ChallengeKey>${iv.toString('base64')}</X_ChallengeKey>`;
            } else if (action.includes('#X_RequestAuth')) {
                const { key, hmacKey } = keys();
                const raw = Buffer.from(/<X_AuthInfo>([^<]*)<\/X_AuthInfo>/.exec(body)[1], 'base64');
                const ciphertext = raw.subarray(0, raw.length - 32);
                const sigOk = crypto
                    .createHmac('sha256', hmacKey)
                    .update(ciphertext)
                    .digest()
                    .equals(raw.subarray(raw.length - 32));
                const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv).setAutoPadding(false);
                const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                const length = plain.readUInt32BE(12);
                const sent = /<X_PinCode>([^<]*)<\/X_PinCode>/.exec(plain.toString('latin1', 16, 16 + length));
                if (!sigOk || !sent) {
                    status = 500;
                    answer = fault(401, 'Invalid Action');
                } else if (sent[1] !== pin) {
                    status = 500;
                    answer = fault(600, 'Invalid PIN');
                } else {
                    const data = Buffer.from(`<X_ApplicationId>${appId}</X_ApplicationId><X_Keyword>${keyword}</X_Keyword>`);
                    const header = Buffer.concat([crypto.randomBytes(12), Buffer.alloc(4)]);
                    header.writeUInt32BE(data.length, 12);
                    let payload = Buffer.concat([header, data]);
                    payload = Buffer.concat([payload, Buffer.alloc(16 - (payload.length % 16))]);
                    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv).setAutoPadding(false);
                    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
                    const sig = crypto.createHmac('sha256', hmacKey).update(encrypted).digest();
                    answer = `<X_AuthResult>${Buffer.concat([encrypted, sig]).toString('base64')}</X_AuthResult>`;
                }
            }
            res.writeHead(status, { 'Content-Type': 'text/xml' });
            res.end(status === 200 ? `<?xml version="1.0"?><s:Envelope><s:Body>${answer}</s:Body></s:Envelope>` : answer);
        });
    });
    return new Promise(resolve => server.listen(55000, '127.0.0.1', () => resolve(server)));
}

/** Waits until the adapter acknowledged `val` in `id` */
async function waitForState(harness, id, val, timeout = 20_000) {
    const start = Date.now();
    for (;;) {
        const state = await harness.states.getStateAsync(id);
        if (state && state.val === val && state.ack) {
            return state;
        }
        if (Date.now() - start > timeout) {
            throw new Error(`${id} is ${JSON.stringify(state && state.val)}, expected ${JSON.stringify(val)}`);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        // the harness is reset before every test, so every test starts the adapter itself
        suite('Type-detector', getHarness => {
            it('detects the channel tv as device type tv', async function () {
                this.timeout(60_000);
                const harness = getHarness();
                await harness.startAdapterAndWait();
                // the objects are created in onReady, give it a moment
                await new Promise(resolve => setTimeout(resolve, 2000));

                const list = await harness.objects.getObjectListAsync({ startkey: `${NS}.`, endkey: `${NS}.香` });
                const objects = {};
                for (const row of list.rows) {
                    objects[row.id] = row.value;
                }

                const { ChannelDetector } = require('@iobroker/type-detector');
                const controls = new ChannelDetector().detect({
                    objects,
                    id: `${NS}.tv`,
                    _keysOptional: Object.keys(objects),
                    _usedIdsOptional: [],
                });
                assert.ok(controls && controls.length, 'nothing detected');
                const tv = controls.find(control => control.type === 'tv');
                assert.ok(tv, `detected: ${controls.map(control => control.type).join(', ')}`);

                const found = {};
                for (const state of tv.states) {
                    if (state.id) {
                        found[state.name] = state.id.replace(`${NS}.`, '');
                    }
                }
                assert.deepStrictEqual(found, {
                    POWER: 'tv.power',
                    KEY: 'tv.key',
                    VOLUME: 'tv.volume',
                    MUTE: 'tv.muted',
                    VOLUME_UP: 'tv.volumeUp',
                    VOLUME_DOWN: 'tv.volumeDown',
                    INPUT: 'tv.input',
                    APP: 'tv.app',
                    UNREACH: 'tv.unreach',
                });
            });
        });

        suite('sendTo', getHarness => {
            const sendTo = (harness, command, message) =>
                new Promise(resolve => harness.sendTo(NS, command, message, resolve));

            it('discover answers with a list for the IP field', async function () {
                this.timeout(60_000);
                const harness = getHarness();
                await harness.startAdapterAndWait();
                const response = await sendTo(harness, 'discover', {});
                // no TV in the CI network, but the answer must be a list for autocompleteSendTo
                assert.ok(Array.isArray(response));
            });

            it('remote answers with an error while no TV is configured', async function () {
                this.timeout(60_000);
                const harness = getHarness();
                await harness.startAdapterAndWait();
                const response = await sendTo(harness, 'remote', { key: 'NRC_HOME-ONOFF' });
                assert.strictEqual(response.error, 'Please configure the Panasonic Viera adapter');
            });

            it('pairs an encrypted TV with the PIN', async function () {
                this.timeout(60_000);
                const server = await startPairingTv('4711', 'AppId42', 'S2V5d29yZEZyb21UVg==');
                try {
                    const harness = getHarness();
                    await harness.startAdapterAndWait();

                    // pair without a PIN shown first
                    let response = await sendTo(harness, 'pair', { ip: '127.0.0.1', pin: '4711' });
                    assert.strictEqual(response.error, 'Please let the TV show a PIN first');

                    response = await sendTo(harness, 'requestPin', { ip: '127.0.0.1' });
                    assert.deepStrictEqual(response, { result: 'pinShown' });

                    response = await sendTo(harness, 'pair', { ip: '127.0.0.1', pin: '1234' });
                    assert.strictEqual(response.error, 'Invalid PIN code');

                    // after a wrong PIN the same PIN request can be used again
                    response = await sendTo(harness, 'pair', { ip: '127.0.0.1', pin: '4711' });
                    assert.deepStrictEqual(response, {
                        native: { app_id: 'AppId42', encryption_key: 'S2V5d29yZEZyb21UVg==' },
                        saveConfig: true,
                        result: 'paired',
                    });
                } finally {
                    server.close();
                }
            });

            it('remote rejects keys that are no NRC codes', async function () {
                this.timeout(60_000);
                const harness = getHarness();
                await harness.startAdapterAndWait();
                const response = await sendTo(harness, 'remote', { key: 'basic.POWER' });
                assert.strictEqual(response.error, 'Invalid key basic.POWER');
            });
        });

        suite('With a simulated TV', getHarness => {
            let server;
            const keys = [];
            before(async () => {
                server = await startFakeTv(keys);
            });
            after(() => server && server.close());

            it('polls volume and mute and controls the TV via the channel tv', async function () {
                this.timeout(90_000);
                const harness = getHarness();
                await harness.changeAdapterConfig('panasonic-viera', { native: { ip: '127.0.0.1' } });
                await harness.startAdapterAndWait();

                // polling: ping 127.0.0.1, then GetMute / GetVolume
                await waitForState(harness, `${NS}.info.connection`, true);
                await waitForState(harness, `${NS}.tv.unreach`, false);
                await waitForState(harness, `${NS}.basic.volume`, 17);
                await waitForState(harness, `${NS}.tv.volume`, 17);
                await waitForState(harness, `${NS}.tv.muted`, true);
                await waitForState(harness, `${NS}.tv.power`, true);

                // a key of the type-detector list is sent as NRC code and acknowledged
                await harness.states.setStateAsync(`${NS}.tv.key`, { val: 'HOME', ack: false });
                await waitForState(harness, `${NS}.tv.key`, 'HOME');
                assert.ok(keys.includes('NRC_HOME-ONOFF'), `keys sent: ${keys.join(', ')}`);

                await harness.states.setStateAsync(`${NS}.tv.input`, { val: 'HDMI2', ack: false });
                await waitForState(harness, `${NS}.tv.input`, 'HDMI2');
                assert.ok(keys.includes('NRC_HDMI2-ONOFF'), `keys sent: ${keys.join(', ')}`);

                // the TV is on: switching it on again must not toggle it off
                await harness.states.setStateAsync(`${NS}.tv.power`, { val: true, ack: false });
                await new Promise(resolve => setTimeout(resolve, 1000));
                assert.ok(!keys.includes('NRC_POWER-ONOFF'), `keys sent: ${keys.join(', ')}`);

                // the apps of the TV replace the defaults in tv.app (Multi Window is none of TV_APPS)
                for (let i = 0; i < 40; i++) {
                    const obj = await harness.objects.getObjectAsync(`${NS}.tv.app`);
                    if (!obj.common.states.PRIME_VIDEO) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                const appObj = await harness.objects.getObjectAsync(`${NS}.tv.app`);
                assert.deepStrictEqual(appObj.common.states, { YOUTUBE: 'YouTube', NETFLIX: 'Netflix' });

                // YouTube is started by its product ID
                await harness.states.setStateAsync(`${NS}.tv.app`, { val: 'YOUTUBE', ack: false });
                await waitForState(harness, `${NS}.tv.app`, 'YOUTUBE');
                assert.ok(keys.includes('APP:0070000200180001'), `keys sent: ${keys.join(', ')}`);

                // the same from the remote control
                const response = await new Promise(resolve =>
                    harness.sendTo(NS, 'launchApp', { app: 'NETFLIX' }, resolve),
                );
                assert.deepStrictEqual(response, { result: 'ok' });
                assert.ok(keys.includes('APP:0010000200000001'), `keys sent: ${keys.join(', ')}`);

                // the old button states still work, basic.LEFT was broken before
                await harness.states.setStateAsync(`${NS}.basic.LEFT`, { val: true, ack: false });
                await new Promise(resolve => setTimeout(resolve, 1000));
                assert.ok(keys.includes('NRC_LEFT-ONOFF'), `keys sent: ${keys.join(', ')}`);
            });
        });
    },
});
