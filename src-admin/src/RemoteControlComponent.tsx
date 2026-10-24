import React from 'react';

import { Box, ButtonBase, CircularProgress, Tooltip, Typography } from '@mui/material';
import {
    Add,
    Apps,
    ArrowBack,
    Close,
    Dialpad,
    FastForward,
    FastRewind,
    Home,
    Info,
    Input,
    KeyboardArrowDown,
    KeyboardArrowLeft,
    KeyboardArrowRight,
    KeyboardArrowUp,
    ListAlt,
    Menu,
    Pause,
    PlayArrow,
    PowerSettingsNew,
    Remove,
    Stop,
    Tune,
    VolumeOff,
} from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

/** How long a command may take before the remote reports that the instance does not answer, in ms */
const SEND_TIMEOUT = 15_000;

/** NRC codes of the keys (the same as `VieraKeys` of node-panasonic-viera, used by the button states) */
const NRC = {
    Power: 'NRC_POWER-ONOFF',
    Input: 'NRC_CHG_INPUT-ONOFF',
    Tv: 'NRC_TV-ONOFF',
    Hdmi1: 'NRC_HDMI1-ONOFF',
    Hdmi2: 'NRC_HDMI2-ONOFF',
    Hdmi3: 'NRC_HDMI3-ONOFF',
    Hdmi4: 'NRC_HDMI4-ONOFF',
    Home: 'NRC_HOME-ONOFF',
    Menu: 'NRC_MENU-ONOFF',
    Apps: 'NRC_APPS-ONOFF',
    Info: 'NRC_INFO-ONOFF',
    Guide: 'NRC_EPG-ONOFF',
    Option: 'NRC_SUBMENU-ONOFF',
    Up: 'NRC_UP-ONOFF',
    Down: 'NRC_DOWN-ONOFF',
    Left: 'NRC_LEFT-ONOFF',
    Right: 'NRC_RIGHT-ONOFF',
    Enter: 'NRC_ENTER-ONOFF',
    Return: 'NRC_RETURN-ONOFF',
    Exit: 'NRC_CANCEL-ONOFF',
    Mute: 'NRC_MUTE-ONOFF',
    VolumeUp: 'NRC_VOLUP-ONOFF',
    VolumeDown: 'NRC_VOLDOWN-ONOFF',
    ChannelUp: 'NRC_CH_UP-ONOFF',
    ChannelDown: 'NRC_CH_DOWN-ONOFF',
    Red: 'NRC_RED-ONOFF',
    Green: 'NRC_GREEN-ONOFF',
    Yellow: 'NRC_YELLOW-ONOFF',
    Blue: 'NRC_BLUE-ONOFF',
    Rewind: 'NRC_REW-ONOFF',
    Play: 'NRC_PLAY-ONOFF',
    Pause: 'NRC_PAUSE-ONOFF',
    Stop: 'NRC_STOP-ONOFF',
    Forward: 'NRC_FF-ONOFF',
    Num0: 'NRC_D0-ONOFF',
    Num1: 'NRC_D1-ONOFF',
    Num2: 'NRC_D2-ONOFF',
    Num3: 'NRC_D3-ONOFF',
    Num4: 'NRC_D4-ONOFF',
    Num5: 'NRC_D5-ONOFF',
    Num6: 'NRC_D6-ONOFF',
    Num7: 'NRC_D7-ONOFF',
    Num8: 'NRC_D8-ONOFF',
    Num9: 'NRC_D9-ONOFF',
} as const;

/** The inputs shown as buttons */
const INPUTS: { code: string; label: string }[] = [
    { code: NRC.Tv, label: 'TV' },
    { code: NRC.Hdmi1, label: 'HDMI 1' },
    { code: NRC.Hdmi2, label: 'HDMI 2' },
    { code: NRC.Hdmi3, label: 'HDMI 3' },
    { code: NRC.Hdmi4, label: 'HDMI 4' },
];

/** Keyboard keys that work while the remote has the focus */
const KEYBOARD: Record<string, string> = {
    ArrowUp: NRC.Up,
    ArrowDown: NRC.Down,
    ArrowLeft: NRC.Left,
    ArrowRight: NRC.Right,
    Enter: NRC.Enter,
    Backspace: NRC.Return,
    Escape: NRC.Exit,
    Home: NRC.Home,
    '+': NRC.VolumeUp,
    '-': NRC.VolumeDown,
    m: NRC.Mute,
    ' ': NRC.Play,
    '0': NRC.Num0,
    '1': NRC.Num1,
    '2': NRC.Num2,
    '3': NRC.Num3,
    '4': NRC.Num4,
    '5': NRC.Num5,
    '6': NRC.Num6,
    '7': NRC.Num7,
    '8': NRC.Num8,
    '9': NRC.Num9,
};

const COLORS = {
    body: 'linear-gradient(180deg, #2b2f36 0%, #1c1f24 100%)',
    key: '#3a3f47',
    keyHover: '#4a505a',
    keyActive: '#5b626e',
    text: '#e8eaed',
    textDim: '#9aa0a6',
    power: '#c62828',
    powerHover: '#e53935',
    ring: '#30343b',
    ok: '#454b54',
    red: '#d32f2f',
    green: '#388e3c',
    yellow: '#fbc02d',
    blue: '#1976d2',
};

interface RemoteControlComponentState extends ConfigGenericState {
    /** Key that is being sent right now */
    busy: string | null;
    /** Text of the last error, empty if the last key went through */
    error: string;
    /** `info.connection`: the TV answers the ping */
    online: boolean | null;
    /** `info.tv_on`: the TV answers the volume / mute requests */
    power: boolean | null;
    volume: number | null;
    muted: boolean | null;
    numbers: boolean;
}

/**
 * A remote control in the settings, so a user sees right away whether the TV answers.
 *
 * Every press goes as `sendTo` `remote` `{ key }` to the running instance, which answers once the TV got it - or
 * with an error that is shown below the remote. It works with the IP and keys of the running instance, not with
 * unsaved settings.
 */
export default class RemoteControlComponent extends ConfigGeneric<ConfigGenericProps, RemoteControlComponentState> {
    private mounted = false;

    private subscribed: string[] = [];

    constructor(props: ConfigGenericProps) {
        super(props);
        this.state = {
            ...this.state,
            busy: null,
            error: '',
            online: null,
            power: null,
            volume: null,
            muted: null,
            numbers: false,
        };
    }

    get target(): string {
        return `${this.props.oContext.adapterName}.${this.props.oContext.instance}`;
    }

    /**
     * The TV is known to be off: only the power key works then.
     * While the state is unknown the keys stay usable.
     */
    get isOff(): boolean {
        return this.state.power === false || this.state.online === false;
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        this.mounted = true;
        this.subscribe();
    }

    componentWillUnmount(): void {
        this.mounted = false;
        super.componentWillUnmount();
        this.unsubscribe();
    }

    /** Follow connection, power, volume and mute of the TV */
    subscribe(): void {
        this.subscribed = [
            `${this.target}.info.connection`,
            `${this.target}.info.tv_on`,
            `${this.target}.basic.volume`,
            `${this.target}.basic.mute`,
        ];
        for (const id of this.subscribed) {
            void this.props.oContext.socket.subscribeState(id, this.onStateChanged);
        }
    }

    unsubscribe(): void {
        for (const id of this.subscribed) {
            this.props.oContext.socket.unsubscribeState(id, this.onStateChanged);
        }
        this.subscribed = [];
    }

    onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (!this.mounted || !this.subscribed.includes(id)) {
            return;
        }
        if (id.endsWith('.basic.volume')) {
            this.setState({ volume: typeof state?.val === 'number' ? state.val : null });
        } else if (id.endsWith('.basic.mute')) {
            this.setState({ muted: state ? !!state.val : null });
        } else if (id.endsWith('.info.connection')) {
            this.setState({ online: state ? !!state.val : null });
        } else {
            this.setState({ power: state ? !!state.val : null });
        }
    };

    async send(code: string): Promise<void> {
        if (this.state.busy || !this.props.alive) {
            return;
        }
        this.setState({ busy: code, error: '' });

        let error = '';
        try {
            const response = (await Promise.race([
                this.props.oContext.socket.sendTo(this.target, 'remote', { key: code }),
                new Promise(resolve =>
                    setTimeout(() => resolve({ error: I18n.t('custom_panasonicviera_no_answer') }), SEND_TIMEOUT),
                ),
            ])) as { error?: string } | null;
            error = response?.error || '';
        } catch (e) {
            error = (e as Error).message || String(e);
        }

        if (this.mounted) {
            this.setState({ busy: null, error });
        }
    }

    onKeyDown = (event: React.KeyboardEvent): void => {
        const key = KEYBOARD[event.key];
        if (key && !this.isOff) {
            event.preventDefault();
            void this.send(key);
        }
    };

    /** One key of the remote control by its NRC code */
    code(code: string, content: React.ReactNode, title: string, sx: Record<string, unknown> = {}): React.JSX.Element {
        const busy = this.state.busy === code;
        return (
            <Tooltip
                title={title}
                placement="top"
                enterDelay={600}
            >
                <span>
                    <ButtonBase
                        aria-label={title}
                        disabled={
                            !this.props.alive || (!!this.state.busy && !busy) || (code !== NRC.Power && this.isOff)
                        }
                        onClick={() => void this.send(code)}
                        sx={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            backgroundColor: COLORS.key,
                            color: COLORS.text,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                            transition: 'background-color 120ms, transform 80ms',
                            '&:hover': { backgroundColor: COLORS.keyHover },
                            '&:active': { backgroundColor: COLORS.keyActive, transform: 'scale(0.95)' },
                            '&.Mui-disabled': { opacity: 0.45 },
                            ...sx,
                        }}
                    >
                        {busy ? (
                            <CircularProgress
                                size={20}
                                sx={{ color: COLORS.text }}
                            />
                        ) : (
                            content
                        )}
                    </ButtonBase>
                </span>
            </Tooltip>
        );
    }

    /** A vertical rocker like the volume and channel keys of a real remote */
    renderRocker(
        up: string,
        down: string,
        label: string,
        upTitle: string,
        downTitle: string,
        icons: [React.ReactNode, React.ReactNode],
    ): React.JSX.Element {
        const half = { width: 52, height: 52, backgroundColor: 'transparent', boxShadow: 'none' };
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRadius: 26,
                    backgroundColor: COLORS.key,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
            >
                {this.code(up, icons[0], upTitle, half)}
                <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textDim, letterSpacing: 1 }}>
                    {label}
                </Typography>
                {this.code(down, icons[1], downTitle, half)}
            </Box>
        );
    }

    renderDpad(): React.JSX.Element {
        const arrow = { position: 'absolute', backgroundColor: 'transparent', boxShadow: 'none' };
        return (
            <Box
                sx={{
                    position: 'relative',
                    width: 190,
                    height: 190,
                    borderRadius: '50%',
                    backgroundColor: COLORS.ring,
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05)',
                    my: 1,
                }}
            >
                {this.code(NRC.Up, <KeyboardArrowUp fontSize="large" />, I18n.t('custom_panasonicviera_up'), {
                    ...arrow,
                    top: 4,
                    left: 69,
                })}
                {this.code(NRC.Down, <KeyboardArrowDown fontSize="large" />, I18n.t('custom_panasonicviera_down'), {
                    ...arrow,
                    bottom: 4,
                    left: 69,
                })}
                {this.code(NRC.Left, <KeyboardArrowLeft fontSize="large" />, I18n.t('custom_panasonicviera_left'), {
                    ...arrow,
                    left: 4,
                    top: 69,
                })}
                {this.code(NRC.Right, <KeyboardArrowRight fontSize="large" />, I18n.t('custom_panasonicviera_right'), {
                    ...arrow,
                    right: 4,
                    top: 69,
                })}
                {this.code(NRC.Enter, <span style={{ fontWeight: 'bold', fontSize: 16 }}>OK</span>, 'OK', {
                    position: 'absolute',
                    top: 55,
                    left: 55,
                    width: 80,
                    height: 80,
                    backgroundColor: COLORS.ok,
                })}
            </Box>
        );
    }

    /** The four color keys as flat bars */
    renderColorKeys(): React.JSX.Element {
        const bar = { width: 44, height: 18, borderRadius: '9px' };
        return (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                {this.code(NRC.Red, null, I18n.t('custom_panasonicviera_red'), { ...bar, backgroundColor: COLORS.red })}
                {this.code(NRC.Green, null, I18n.t('custom_panasonicviera_green'), {
                    ...bar,
                    backgroundColor: COLORS.green,
                })}
                {this.code(NRC.Yellow, null, I18n.t('custom_panasonicviera_yellow'), {
                    ...bar,
                    backgroundColor: COLORS.yellow,
                })}
                {this.code(NRC.Blue, null, I18n.t('custom_panasonicviera_blue'), {
                    ...bar,
                    backgroundColor: COLORS.blue,
                })}
            </Box>
        );
    }

    renderNumbers(): React.JSX.Element {
        const keys = [NRC.Num1, NRC.Num2, NRC.Num3, NRC.Num4, NRC.Num5, NRC.Num6, NRC.Num7, NRC.Num8, NRC.Num9];
        const digit = (code: string, label: string): React.JSX.Element =>
            this.code(code, <span style={{ fontSize: 16 }}>{label}</span>, label, { width: 44, height: 44 });
        return (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, justifyItems: 'center' }}>
                {keys.map((code, i) => (
                    <React.Fragment key={code}>{digit(code, String(i + 1))}</React.Fragment>
                ))}
                <span />
                {digit(NRC.Num0, '0')}
                <span />
            </Box>
        );
    }

    /** The inputs as rounded text buttons */
    renderInputs(): React.JSX.Element {
        return (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, width: '100%' }}>
                {INPUTS.map(input => {
                    const busy = this.state.busy === input.code;
                    return (
                        <ButtonBase
                            key={input.code}
                            aria-label={input.label}
                            disabled={!this.props.alive || (!!this.state.busy && !busy) || this.isOff}
                            onClick={() => void this.send(input.code)}
                            sx={{
                                height: 34,
                                borderRadius: '17px',
                                border: `1px solid ${COLORS.textDim}`,
                                color: COLORS.text,
                                fontSize: 12,
                                fontWeight: 'bold',
                                px: 1,
                                whiteSpace: 'nowrap',
                                transition: 'background-color 120ms, transform 80ms',
                                '&:hover': { backgroundColor: COLORS.keyHover },
                                '&:active': { transform: 'scale(0.96)' },
                                '&.Mui-disabled': { opacity: 0.45 },
                            }}
                        >
                            {busy ? (
                                <CircularProgress
                                    size={16}
                                    sx={{ color: COLORS.text }}
                                />
                            ) : (
                                input.label
                            )}
                        </ButtonBase>
                    );
                })}
            </Box>
        );
    }

    renderStatus(): React.JSX.Element {
        const { online, power, volume, muted } = this.state;
        let color = '#5f6368';
        let text = I18n.t('custom_panasonicviera_state_unknown');
        if (!this.props.alive) {
            text = I18n.t('custom_panasonicviera_not_alive');
        } else if (online === false) {
            text = I18n.t('custom_panasonicviera_state_offline');
        } else if (power === true) {
            color = '#34a853';
            text = I18n.t('custom_panasonicviera_state_on');
        } else if (power === false) {
            color = '#ea4335';
            text = I18n.t('custom_panasonicviera_state_off');
        }
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: color,
                            boxShadow: power ? `0 0 6px ${color}` : 'none',
                        }}
                    />
                    <Typography sx={{ fontSize: 12, color: COLORS.textDim }}>{text}</Typography>
                </Box>
                {power && volume !== null ? (
                    <Typography sx={{ fontSize: 12, color: COLORS.text }}>
                        {muted
                            ? I18n.t('custom_panasonicviera_muted')
                            : `${I18n.t('custom_panasonicviera_volume')}: ${volume}`}
                    </Typography>
                ) : null}
            </Box>
        );
    }

    renderItem(): React.JSX.Element {
        if (!this.props.alive) {
            return (
                <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    {I18n.t('custom_panasonicviera_not_alive')}
                </Typography>
            );
        }

        const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' };
        const small = { width: 40, height: 40 };
        // while the TV is off only power works
        const off = this.isOff;

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 2 }}>
                <Box
                    tabIndex={0}
                    onKeyDown={this.onKeyDown}
                    sx={{
                        width: 260,
                        px: 3,
                        py: 3,
                        borderRadius: '44px',
                        background: COLORS.body,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        outline: 'none',
                        '&:focus-visible': { boxShadow: '0 0 0 2px #1976d2, 0 10px 30px rgba(0,0,0,0.45)' },
                    }}
                >
                    <Box sx={off ? { ...row, justifyContent: 'center' } : row}>
                        {this.code(NRC.Power, <PowerSettingsNew />, I18n.t('custom_panasonicviera_power'), {
                            backgroundColor: COLORS.power,
                            '&:hover': { backgroundColor: COLORS.powerHover },
                        })}
                        {off ? null : this.code(NRC.Input, <Input />, I18n.t('custom_panasonicviera_input'))}
                    </Box>

                    {this.renderStatus()}

                    {off ? null : (
                        <>
                            {this.renderInputs()}

                            <Box sx={row}>
                                {this.code(NRC.Home, <Home />, I18n.t('custom_panasonicviera_home'))}
                                {this.code(NRC.Apps, <Apps />, I18n.t('custom_panasonicviera_apps'))}
                                {this.code(NRC.Menu, <Menu />, I18n.t('custom_panasonicviera_menu'))}
                            </Box>

                            <Box sx={row}>
                                {this.code(NRC.Option, <Tune />, I18n.t('custom_panasonicviera_option'))}
                                {this.code(NRC.Info, <Info />, I18n.t('custom_panasonicviera_info'))}
                                {this.code(NRC.Guide, <ListAlt />, I18n.t('custom_panasonicviera_guide'))}
                            </Box>

                            {this.renderDpad()}

                            <Box sx={row}>
                                {this.code(NRC.Return, <ArrowBack />, I18n.t('custom_panasonicviera_back'))}
                                {this.code(NRC.Exit, <Close />, I18n.t('custom_panasonicviera_exit'))}
                                {this.code(NRC.Mute, <VolumeOff />, I18n.t('custom_panasonicviera_mute'))}
                            </Box>

                            <Box sx={{ ...row, alignItems: 'stretch' }}>
                                {this.renderRocker(
                                    NRC.VolumeUp,
                                    NRC.VolumeDown,
                                    'VOL',
                                    I18n.t('custom_panasonicviera_volume_up'),
                                    I18n.t('custom_panasonicviera_volume_down'),
                                    [<Add key="up" />, <Remove key="down" />],
                                )}
                                <ButtonBase
                                    aria-label={I18n.t('custom_panasonicviera_numbers')}
                                    onClick={() => this.setState({ numbers: !this.state.numbers })}
                                    sx={{
                                        alignSelf: 'center',
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        color: this.state.numbers ? COLORS.text : COLORS.textDim,
                                        backgroundColor: this.state.numbers ? COLORS.keyActive : 'transparent',
                                    }}
                                >
                                    <Dialpad />
                                </ButtonBase>
                                {this.renderRocker(
                                    NRC.ChannelUp,
                                    NRC.ChannelDown,
                                    'CH',
                                    I18n.t('custom_panasonicviera_channel_up'),
                                    I18n.t('custom_panasonicviera_channel_down'),
                                    [<KeyboardArrowUp key="up" />, <KeyboardArrowDown key="down" />],
                                )}
                            </Box>

                            {this.state.numbers ? this.renderNumbers() : null}

                            {this.renderColorKeys()}

                            <Box sx={{ ...row, gap: 0.5 }}>
                                {this.code(
                                    NRC.Rewind,
                                    <FastRewind fontSize="small" />,
                                    I18n.t('custom_panasonicviera_rewind'),
                                    small,
                                )}
                                {this.code(
                                    NRC.Play,
                                    <PlayArrow fontSize="small" />,
                                    I18n.t('custom_panasonicviera_play'),
                                    small,
                                )}
                                {this.code(
                                    NRC.Pause,
                                    <Pause fontSize="small" />,
                                    I18n.t('custom_panasonicviera_pause'),
                                    small,
                                )}
                                {this.code(
                                    NRC.Stop,
                                    <Stop fontSize="small" />,
                                    I18n.t('custom_panasonicviera_stop'),
                                    small,
                                )}
                                {this.code(
                                    NRC.Forward,
                                    <FastForward fontSize="small" />,
                                    I18n.t('custom_panasonicviera_forward'),
                                    small,
                                )}
                            </Box>
                        </>
                    )}

                    <Typography
                        sx={{
                            mt: 1,
                            fontSize: 13,
                            fontWeight: 'bold',
                            letterSpacing: 4,
                            color: COLORS.textDim,
                            userSelect: 'none',
                        }}
                    >
                        Panasonic
                    </Typography>
                </Box>

                <Typography
                    role="status"
                    sx={{
                        mt: 2,
                        minHeight: 24,
                        maxWidth: 420,
                        textAlign: 'center',
                        color: this.state.error ? 'error.main' : 'text.secondary',
                        fontSize: 14,
                    }}
                >
                    {this.state.error ||
                        I18n.t(off ? 'custom_panasonicviera_switch_on_first' : 'custom_panasonicviera_hint')}
                </Typography>
            </Box>
        );
    }
}
