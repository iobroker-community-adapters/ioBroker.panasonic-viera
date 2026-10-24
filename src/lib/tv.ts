import { VieraKeys } from 'node-panasonic-viera';

/**
 * Channel `tv` for the device type `tv` of the ioBroker type-detector (@iobroker/type-detector >= 6.2.0), parallel
 * to the existing objects. Keys of `common.states` of `key` and `input` come from `TV_KEYS` / `TV_INPUTS` of the
 * type-detector - only these keys are allowed, the labels are the ones of the type-detector.
 *
 * There is no `app` (`media.app`): `sendAppCommand()` of node-panasonic-viera 0.4.1 sends malformed XML.
 */

/** `TV_KEYS` of the type-detector → NRC code */
export const TV_KEY_CODES: Record<string, { label: string; code: string }> = {
    UP: { label: 'Up', code: VieraKeys.up },
    DOWN: { label: 'Down', code: VieraKeys.down },
    LEFT: { label: 'Left', code: VieraKeys.left },
    RIGHT: { label: 'Right', code: VieraKeys.right },
    SELECT: { label: 'Select', code: VieraKeys.enter },
    BACK: { label: 'Back', code: VieraKeys.return_key },
    EXIT: { label: 'Exit', code: VieraKeys.cancel },
    HOME: { label: 'Home', code: VieraKeys.home },
    MENU: { label: 'Menu', code: VieraKeys.menu },
    INFO: { label: 'Info', code: VieraKeys.info },
    GUIDE: { label: 'Guide', code: VieraKeys.epg },
    CHANNEL_UP: { label: 'Channel up', code: VieraKeys.ch_up },
    CHANNEL_DOWN: { label: 'Channel down', code: VieraKeys.ch_down },
    NUMBER_0: { label: '0', code: VieraKeys.num_0 },
    NUMBER_1: { label: '1', code: VieraKeys.num_1 },
    NUMBER_2: { label: '2', code: VieraKeys.num_2 },
    NUMBER_3: { label: '3', code: VieraKeys.num_3 },
    NUMBER_4: { label: '4', code: VieraKeys.num_4 },
    NUMBER_5: { label: '5', code: VieraKeys.num_5 },
    NUMBER_6: { label: '6', code: VieraKeys.num_6 },
    NUMBER_7: { label: '7', code: VieraKeys.num_7 },
    NUMBER_8: { label: '8', code: VieraKeys.num_8 },
    NUMBER_9: { label: '9', code: VieraKeys.num_9 },
    PLAY: { label: 'Play', code: VieraKeys.play },
    PAUSE: { label: 'Pause', code: VieraKeys.pause },
    STOP: { label: 'Stop', code: VieraKeys.stop },
    REWIND: { label: 'Rewind', code: VieraKeys.rewind },
    FAST_FORWARD: { label: 'Fast forward', code: VieraKeys.fast_forward },
    RED: { label: 'Red', code: VieraKeys.red },
    GREEN: { label: 'Green', code: VieraKeys.green },
    YELLOW: { label: 'Yellow', code: VieraKeys.yellow },
    BLUE: { label: 'Blue', code: VieraKeys.blue },
};

/** `TV_INPUTS` of the type-detector → NRC code (the TV has direct keys only for these) */
export const TV_INPUT_CODES: Record<string, { label: string; code: string }> = {
    TV: { label: 'TV', code: VieraKeys.tv },
    HDMI1: { label: 'HDMI 1', code: VieraKeys.hdmi1 },
    HDMI2: { label: 'HDMI 2', code: VieraKeys.hdmi2 },
    HDMI3: { label: 'HDMI 3', code: VieraKeys.hdmi3 },
    HDMI4: { label: 'HDMI 4', code: VieraKeys.hdmi4 },
};

function labels(map: Record<string, { label: string }>): Record<string, string> {
    return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.label]));
}

/** Objects of the channel `tv`, relative to the namespace */
export const TV_OBJECTS: Record<string, ioBroker.SettableChannelObject | ioBroker.SettableStateObject> = {
    tv: {
        type: 'channel',
        common: { name: 'TV (type-detector)' },
        native: {},
    },
    'tv.power': {
        type: 'state',
        common: { name: 'Power', type: 'boolean', role: 'switch.power', read: true, write: true, def: false },
        native: {},
    },
    'tv.key': {
        type: 'state',
        common: {
            name: 'Remote key',
            type: 'string',
            role: 'media.key',
            read: false,
            write: true,
            states: labels(TV_KEY_CODES),
        },
        native: {},
    },
    'tv.volume': {
        type: 'state',
        common: {
            name: 'Volume',
            type: 'number',
            role: 'level.volume',
            read: true,
            write: true,
            min: 0,
            max: 100,
            unit: '%',
            def: 0,
        },
        native: {},
    },
    'tv.muted': {
        type: 'state',
        common: { name: 'Muted', type: 'boolean', role: 'media.mute', read: true, write: true, def: false },
        native: {},
    },
    'tv.volumeUp': {
        type: 'state',
        common: { name: 'Volume up', type: 'boolean', role: 'button.volume.up', read: false, write: true },
        native: {},
    },
    'tv.volumeDown': {
        type: 'state',
        common: { name: 'Volume down', type: 'boolean', role: 'button.volume.down', read: false, write: true },
        native: {},
    },
    'tv.input': {
        type: 'state',
        common: {
            name: 'Input',
            type: 'string',
            role: 'media.input',
            read: true,
            write: true,
            states: labels(TV_INPUT_CODES),
        },
        native: {},
    },
    'tv.unreach': {
        type: 'state',
        common: {
            name: 'TV not reachable',
            type: 'boolean',
            role: 'indicator.maintenance.unreach',
            read: true,
            write: false,
            def: true,
        },
        native: {},
    },
};
