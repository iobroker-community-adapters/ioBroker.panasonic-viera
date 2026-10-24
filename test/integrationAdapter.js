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
            }
            res.writeHead(200, { 'Content-Type': 'text/xml' });
            res.end(`<?xml version="1.0"?><s:Envelope><s:Body>${answer}</s:Body></s:Envelope>`);
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

                // the old button states still work, basic.LEFT was broken before
                await harness.states.setStateAsync(`${NS}.basic.LEFT`, { val: true, ack: false });
                await new Promise(resolve => setTimeout(resolve, 1000));
                assert.ok(keys.includes('NRC_LEFT-ONOFF'), `keys sent: ${keys.join(', ')}`);
            });
        });
    },
});
