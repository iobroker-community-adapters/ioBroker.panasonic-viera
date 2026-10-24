import * as utils from '@iobroker/adapter-core';
import { promise as ping } from 'ping';
import { VieraKeys, Viera } from 'node-panasonic-viera';

import { STATE_KEY_MAP } from './lib/keys';

/** Polling interval of checkStatus() */
const STATUS_INTERVAL = 30_000;

class PanasonicVieraAdapter extends utils.Adapter {
    private viera: Viera | null = null;
    private isConnected: boolean | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'panasonic-viera' });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
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
                    const mute = await viera.getMute();
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
                    const mute = await viera.getMute();
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
