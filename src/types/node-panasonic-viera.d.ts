// node-panasonic-viera has no typings. Only what this adapter uses is declared, as the library implements it.
declare module 'node-panasonic-viera' {
    /** Names of the remote keys, values are the NRC codes like `NRC_POWER-ONOFF` */
    export const VieraKeys: {
        readonly thirty_second_skip: string;
        readonly toggle_3d: string;
        readonly apps: string;
        readonly aspect: string;
        readonly back: string;
        readonly blue: string;
        readonly cancel: string;
        readonly cc: string;
        readonly chat_mode: string;
        readonly ch_down: string;
        readonly input_key: string;
        readonly network: string;
        readonly ch_up: string;
        readonly num_0: string;
        readonly num_1: string;
        readonly num_2: string;
        readonly num_3: string;
        readonly num_4: string;
        readonly num_5: string;
        readonly num_6: string;
        readonly num_7: string;
        readonly num_8: string;
        readonly num_9: string;
        readonly diga_control: string;
        readonly display: string;
        readonly down: string;
        readonly enter: string;
        readonly epg: string;
        readonly exit: string;
        readonly ez_sync: string;
        readonly favorite: string;
        readonly fast_forward: string;
        readonly game: string;
        readonly green: string;
        readonly guide: string;
        readonly hold: string;
        readonly hdmi1: string;
        readonly hdmi2: string;
        readonly hdmi3: string;
        readonly hdmi4: string;
        readonly home: string;
        readonly index: string;
        readonly info: string;
        readonly connect: string;
        readonly left: string;
        readonly menu: string;
        readonly mpx: string;
        readonly mute: string;
        readonly net_bs: string;
        readonly net_cs: string;
        readonly net_td: string;
        readonly off_timer: string;
        readonly pause: string;
        readonly pictai: string;
        readonly play: string;
        readonly p_nr: string;
        readonly power: string;
        readonly program: string;
        readonly record: string;
        readonly red: string;
        readonly return_key: string;
        readonly rewind: string;
        readonly right: string;
        readonly r_screen: string;
        readonly last_view: string;
        readonly sap: string;
        readonly toggle_sd_card: string;
        readonly skip_next: string;
        readonly skip_prev: string;
        readonly split: string;
        readonly stop: string;
        readonly subtitles: string;
        readonly option: string;
        readonly surround: string;
        readonly swap: string;
        readonly text: string;
        readonly tv: string;
        readonly tv_mute_on: string;
        readonly tv_mute_off: string;
        readonly dms_ch_up: string;
        readonly dms_ch_down: string;
        readonly up: string;
        readonly link: string;
        readonly volume_down: string;
        readonly volume_up: string;
        readonly vtools: string;
        readonly yellow: string;
        readonly reclist: string;
        readonly drive: string;
        readonly data: string;
        readonly bd: string;
        readonly vod: string;
        readonly eco: string;
    };

    export class Viera {
        /**
         * Sets IP and credentials and requests a session (encrypted TVs only).
         * Never rejects: an error is returned as resolved value.
         */
        connect(ipAddress: string, app_id?: string, encryption_key?: string): Promise<unknown>;
        requestPinCode(name: string): Promise<string>;
        /** Sends an NRC code (`NRC_POWER-ONOFF`). Resolves with the SOAP answer, also if the TV answers with an error */
        sendKey(command: string): Promise<string>;
        sendAppCommand(appID: string): Promise<string>;
        getVolume(): Promise<number>;
        setVolume(volume: number): Promise<string>;
        getMute(): Promise<boolean>;
        setMute(enable: boolean): Promise<string>;
    }
}
