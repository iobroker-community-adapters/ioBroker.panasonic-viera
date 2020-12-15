/* jshint -W097 */// jshint strict:false
/* jslint node: true */
'use strict';

// You have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const ping = require('ping');
const {VieraKeys, Viera} = require('node-panasonic-viera');

// Mapping table for state <> VieraKeys mapping
const stateKeyMap = {
  'others.30S_SKIP': VieraKeys.thirty_second_skip,
  'others.3D': VieraKeys.toggle_3d,
  'others.APPS': VieraKeys.apps,
  'others.ASPECT': VieraKeys.aspect,
  'basic.BACK': VieraKeys.back,
  'basic.BLUE': VieraKeys.blue,
  'basic.CANCEL': VieraKeys.cancel,
  'others.CC': VieraKeys.cc,
  'others.CHAT': VieraKeys.chat_mode,
  'channel.CH_DOWN': VieraKeys.ch_down,
  'input.CHG_INPUT': VieraKeys.input_key,
  'others.CHG_NETWORK': VieraKeys.network,
  'channel.CH_UP': VieraKeys.ch_up,
  'channel.D0': VieraKeys.num_0,
  'channel.D1': VieraKeys.num_1,
  'channel.D2': VieraKeys.num_2,
  'channel.D3': VieraKeys.num_3,
  'channel.D4': VieraKeys.num_4,
  'channel.D5': VieraKeys.num_5,
  'channel.D6': VieraKeys.num_6,
  'channel.D7': VieraKeys.num_7,
  'channel.D8': VieraKeys.num_8,
  'channel.D9': VieraKeys.num_9,
  'others.DIGA_CTL': VieraKeys.diga_control,
  'others.DISP_MODE': VieraKeys.display,
  'basic.DOWN': VieraKeys.down,
  'basic.ENTER': VieraKeys.enter,
  'info.EPG': VieraKeys.epg,
  'basic.EXIT': VieraKeys.exit,
  'others.EZ_SYNC': VieraKeys.ez_sync,
  'others.FAVORITE': VieraKeys.favorite,
  'player.FF': VieraKeys.fast_forward,
  'others.GAME': VieraKeys.game,
  'basic.GREEN': VieraKeys.green,
  'info.GUIDE': VieraKeys.guide,
  'others.HOLD': VieraKeys.hold,
  'others.HOME': VieraKeys.home,
  'info.INDEX': VieraKeys.index,
  'info.INFO': VieraKeys.info,
  'others.INTERNET': VieraKeys.connect,
  'basic.left': VieraKeys.left,
  'info.MENU': VieraKeys.menu,
  'others.MPX': VieraKeys.mpx,
  // 'basic.mute':         VieraKeys.mute,
  'others.NET_BS': VieraKeys.net_bs,
  'others.NET_CS': VieraKeys.net_cs,
  'others.NET_TD': VieraKeys.net_td,
  'others.OFFTIMER': VieraKeys.off_timer,
  'player.PAUSE': VieraKeys.pause,
  'others.PICTAI': VieraKeys.pictai,
  'player.PLAY': VieraKeys.play,
  'others.P_NR': VieraKeys.p_nr,
  'basic.POWER': VieraKeys.power,
  'others.PROG': VieraKeys.program,
  'player.REC': VieraKeys.record,
  'basic.RED': VieraKeys.red,
  'basic.RETURN': VieraKeys.return_key,
  'player.REW': VieraKeys.rewind,
  'basic.RIGHT': VieraKeys.right,
  'others.R_SCREEN': VieraKeys.r_screen,
  'others.R_TUNE': VieraKeys.last_view,
  'others.SAP': VieraKeys.sap,
  'others.SD_CARD': VieraKeys.toggle_sd_card,
  'player.SKIP_NEXT': VieraKeys.skip_next,
  'player.SKIP_PREV': VieraKeys.skip_prev,
  'others.SPLIT': VieraKeys.split,
  'player.STOP': VieraKeys.stop,
  'others.STTL': VieraKeys.subtitles,
  'others.SUBMENU': VieraKeys.option,
  'others.SURROUND': VieraKeys.surround,
  'others.SWAP': VieraKeys.swap,
  'info.TEXT': VieraKeys.text,
  'others.TV': VieraKeys.tv,
  'basic.UP': VieraKeys.up,
  'others.VIERA_LINK': VieraKeys.link,
  // 'basic.VOLDOWN':      VieraKeys.volume_down,
  // 'basic.VOLUP':        VieraKeys.volume_up,
  'info.VTOOLS': VieraKeys.vtools,
  'basic.YELLOW': VieraKeys.yellow
};

let viera = null;
let isConnected = null;

// You have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
let adapter;
function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'panasonic-viera',
    stateChange(id, state) {
      if (id && state && !state.ack) {
        let cmd = id.split('.').slice(-2).join('.');
        adapter.log.debug('state triggered: ' + cmd + ': ' + state.val);
        if (typeof (stateKeyMap[cmd]) !== 'undefined') {
          cmd = stateKeyMap[cmd];
        }

        adapter.log.debug('sending command: ' + cmd);
        sendCommand(cmd, state.val);
      }
    },
    ready: main
  });

  adapter = new utils.Adapter(options);

  return adapter;
}

function setConnected(_isConnected) {
  if (isConnected !== _isConnected) {
    isConnected = _isConnected;
    adapter.setState('info.connection', {val: isConnected, ack: true});
  }
}

function main() {
  if (adapter.config.ip && adapter.config.ip !== '0.0.0.0') {
    viera = new Viera();

    // In this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');
    checkStatus();

    setInterval(checkStatus, 60000);
  } else {
    adapter.log.error('Please configure the Panasonic Viera adapter');
  }
}

function checkStatus() {
  ping.promise.probe(adapter.config.ip)
    .then(isAlive => {
      setConnected(isAlive);
      if (isAlive) {
        sendCommand('getMute');
        sendCommand('getVolume');
      }
    })
    .catch(error => {
      adapter.log.error(error);
    });
}

function sendCommand(cmd, value) {
  if (isConnected) {
    switch (cmd) {
      case 'getMute':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.getMute();
          })
          .then(mute => {
            adapter.setState('mute', {val: mute, ack: true});
            adapter.setState('info.tv_on', {val: true, ack: true});
          })
          .catch(error => {
            adapter.log.error('getMute: ' + error);
            adapter.setState('info.tv_on', {val: false, ack: true});
          });
        break;

      case 'basic.mute':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.setMute(value);
          })
          .then(() => {
            return viera.getMute();
          })
          .then(data => {
            adapter.setState('mute', {val: data, ack: true});
          })
          .catch(error => {
            adapter.log.error('getMute: ' + error);
          });
        break;

      case 'getVolume':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.getVolume();
          })
          .then(volume => {
            adapter.setState('volume', {val: volume, ack: true});
            adapter.setState('info.tv_on', {val: true, ack: true});
          })
          .catch(error => {
            adapter.log.error('getVolume: ' + error);
            adapter.setState('info.tv_on', {val: false, ack: true});
          });
        break;

      case 'VOLUP':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.sendKey(VieraKeys.volume_up);
          })
          .then(() => {
            return viera.getVolume();
          })
          .then(volume => {
            adapter.setState('volume', {val: volume, ack: true});
            adapter.setState('info.tv_on', {val: true, ack: true});
          })
          .catch(error => {
            adapter.log.error('getVolume: ' + error);
          });
        break;

      case 'VOLDOWN':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.sendKey(VieraKeys.volume_down);
          })
          .then(() => {
            return viera.getVolume();
          })
          .then(volume => {
            adapter.setState('volume', {val: volume, ack: true});
            adapter.setState('info.tv_on', {val: true, ack: true});
          })
          .catch(error => {
            adapter.log.error('getVolume: ' + error);
          });
        break;

      case 'basic.volume':
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.setVolume(value);
          })
          .then(() => {
            return viera.getVolume();
          })
          .then(volume => {
            adapter.setState('volume', {val: volume, ack: true});
            adapter.setState('info.tv_on', {val: true, ack: true});
          })
          .catch(error => {
            adapter.log.error('getVolume: ' + error);
          });
        break;

      default:
        viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
          .then(() => {
            return viera.sendKey(cmd);
          })
          .catch(error => {
            adapter.log.error('sendCommand[' + cmd + ']: ' + error);
          });
        break;
    }
  }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
  module.exports = startAdapter;
} else {
  // Or start the instance directly
  startAdapter();
}
