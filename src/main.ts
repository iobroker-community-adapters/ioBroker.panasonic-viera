import * as utils from '@iobroker/adapter-core';
import { promise as ping } from 'ping';
import { VieraKeys, Viera } from 'node-panasonic-viera';

import { discover } from './lib/discovery';
import { STATE_KEY_MAP } from './lib/keys';
import { getMute } from './lib/viera';

type MessageResponse = { value: string; label: string }[] | { result: 'ok' };

/** An NRC code like `NRC_POWER-ONOFF` */
const NRC_CODE_REGEX = /^NRC_[A-Z0-9_]+-ONOFF$/;

/** Polling interval of checkStatus() */
const STATUS_INTERVAL = 30_000;

class PanasonicVieraAdapter extends utils.Adapter {
    private viera: Viera | null = null;
    private isConnected: boolean | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'panasonic-viera' });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('message', obj => this.onMessage(obj));
    }

    /**
     * Commands of the settings:
     * - `discover` → `[{ value: ip, label }]`: TVs found via SSDP (`autocompleteSendTo` of the IP field)
     * - `remote` `{ key }`: an NRC code, from the remote control (src-admin/src/RemoteControlComponent.tsx)
     *
     * Every command answers with its result or `{ error }`.
     */
    private onMessage(obj: ioBroker.Message): void {
        if (!obj?.callback) {
            return;
        }
        this.handleMessage(obj)
            .then(response => this.sendTo(obj.from, obj.command, response, obj.callback))
            .catch(err =>
                this.sendTo(obj.from, obj.command, { error: (err as Error).message || String(err) }, obj.callback),
            );
    }

    private async handleMessage(obj: ioBroker.Message): Promise<MessageResponse> {
        switch (obj.command) {
            case 'discover': {
                const tvs = await discover(this);
                this.log.debug(`Discovery: ${JSON.stringify(tvs)}`);
                return tvs.map(tv => ({
                    value: tv.ip,
                    label: `${tv.friendlyName || tv.modelName || tv.modelNumber} (${tv.ip})`,
                }));
            }

            case 'remote': {
                const key = (obj.message as { key?: unknown } | undefined)?.key;
                if (typeof key !== 'string' || !NRC_CODE_REGEX.test(key)) {
                    throw new Error(`Invalid key ${String(key)}`);
                }
                await this.sendRemoteKey(key);
                return { result: 'ok' };
            }

            default:
                throw new Error(`Unknown command ${obj.command}`);
        }
    }

    /**
     * Sends a key of the remote control and refreshes volume or mute if the key changed them. Unlike the states
     * it is also sent while the TV does not answer the ping (power on via "Powered On by Apps"), and an error
     * answer of the TV is reported.
     */
    private async sendRemoteKey(key: string): Promise<void> {
        if (!this.viera) {
            throw new Error('Please configure the Panasonic Viera adapter');
        }
        const viera = await this.connect(this.viera);
        const answer = await viera.sendKey(key);
        const fault = /<errorDescription>([^<]*)<\/errorDescription>/.exec(answer || '');
        if (fault || (answer || '').includes('s:Fault')) {
            throw new Error(`The TV refused ${key}: ${fault?.[1] || 'unknown error'}`);
        }
        if (key === VieraKeys.volume_up || key === VieraKeys.volume_down) {
            await this.setState('basic.volume', { val: await viera.getVolume(), ack: true });
        } else if (key === VieraKeys.mute) {
            await this.setState('basic.mute', { val: await getMute(viera), ack: true });
        }
    }

    private onReady(): void {
        if (this.config.ip && this.config.ip !== '0.0.0.0') {
            this.viera = new Viera();

            // all state changes inside the adapters namespace are subscribed
            this.subscribeStates('*');
            void this.checkStatus();

            this.setInterval(() => void this.checkStatus(), STATUS_INTERVAL);
        } else {
            this.log.error('Please configure the Panasonic Viera adapter');
        }
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (id && state && !state.ack) {
            // e.g. `basic.POWER`
            let cmd = id.split('.').slice(-2).join('.');
            this.log.debug(`state triggered: ${cmd}: ${state.val}`);
            if (typeof STATE_KEY_MAP[cmd] !== 'undefined') {
                cmd = STATE_KEY_MAP[cmd];
            }

            this.log.debug(`sending command: ${cmd}`);
            void this.sendCommand(cmd, state.val);
        }
    }

    private setConnected(isConnected: boolean): void {
        if (this.isConnected !== isConnected) {
            this.isConnected = isConnected;
            void this.setState('info.connection', { val: isConnected, ack: true });
        }
    }

    private async checkStatus(): Promise<void> {
        try {
            const result = await ping.probe(this.config.ip);
            this.setConnected(result.alive);
            if (result.alive) {
                void this.sendCommand('getMute');
                void this.sendCommand('getVolume');
            }
        } catch (error) {
            this.log.error(String(error));
        }
    }

    /** Opens a session (a new one for every command, this was always like this) */
    private async connect(viera: Viera): Promise<Viera> {
        // never rejects, an error is returned as value and the following request fails
        await viera.connect(this.config.ip, this.config.app_id, this.config.encryption_key);
        return viera;
    }

    /**
     * Executes `cmd`: one of the special commands (`getMute`, `basic.mute`, `getVolume`, `VOLUP`, `VOLDOWN`,
     * `basic.volume`) or any NRC code. Only while the TV answers the ping.
     */
    private async sendCommand(cmd: string, value?: ioBroker.StateValue): Promise<void> {
        if (!this.isConnected || !this.viera) {
            return;
        }
        const viera = this.viera;
        switch (cmd) {
            case 'getMute':
                try {
                    await this.connect(viera);
                    const mute = await getMute(viera);
                    await this.setState('basic.mute', { val: mute, ack: true });
                    await this.setState('info.tv_on', { val: true, ack: true });
                } catch (error) {
                    this.log.debug(`getMute: ${error}`);
                    await this.setState('info.tv_on', { val: false, ack: true });
                }
                break;

            case 'basic.mute':
                try {
                    await this.connect(viera);
                    await viera.setMute(!!value);
                    const mute = await getMute(viera);
                    await this.setState('basic.mute', { val: mute, ack: true });
                } catch (error) {
                    this.log.error(`getMute: ${error}`);
                }
                break;

            case 'getVolume':
                try {
                    await this.connect(viera);
                    const volume = await viera.getVolume();
                    await this.setState('basic.volume', { val: volume, ack: true });
                    await this.setState('info.tv_on', { val: true, ack: true });
                } catch (error) {
                    this.log.debug(`getVolume: ${error}`);
                    await this.setState('info.tv_on', { val: false, ack: true });
                }
                break;

            case 'VOLUP':
            case 'VOLDOWN':
                try {
                    await this.connect(viera);
                    await viera.sendKey(cmd === 'VOLUP' ? VieraKeys.volume_up : VieraKeys.volume_down);
                    const volume = await viera.getVolume();
                    await this.setState('basic.volume', { val: volume, ack: true });
                    await this.setState('info.tv_on', { val: true, ack: true });
                } catch (error) {
                    this.log.error(`getVolume: ${error}`);
                }
                break;

            case 'basic.volume':
                try {
                    await this.connect(viera);
                    await viera.setVolume(value as number);
                    const volume = await viera.getVolume();
                    await this.setState('basic.volume', { val: volume, ack: true });
                    await this.setState('info.tv_on', { val: true, ack: true });
                } catch (error) {
                    this.log.error(`getVolume: ${error}`);
                }
                break;

            default:
                try {
                    await this.connect(viera);
                    await viera.sendKey(cmd);
                } catch (error) {
                    this.log.error(`sendCommand[${cmd}]: ${error}`);
                }
                break;
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new PanasonicVieraAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new PanasonicVieraAdapter())();
}
