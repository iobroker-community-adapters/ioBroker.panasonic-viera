/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const ping = require(__dirname + '/lib/ping');
const {VieraKeys, Viera} = require('node-panasonic-viera');

let viera = null;
let isConnected = null;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'panasonic-viera',
        stateChange: function (id, state) {
            if (id && state && !state.ack) {
                id = id.substring(id.lastIndexOf('.') + 1);
                sendCommand(id, state.val);
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

        // in this template all states changes inside the adapters namespace are subscribed
        adapter.subscribeStates('*');
        checkStatus();

        setInterval(checkStatus, 60000);
    } else {
        adapter.log.error('Please configure the Panasonic Viera adapter');
    }

}

function checkStatus() {
    ping.probe(adapter.config.ip, {log: adapter.log.debug}, function (err, result) {
        if (err) {
            adapter.log.error(err);
        }
        if (result) {
            setConnected(result.alive);
            if (result.alive) {
                sendCommand('getMute');
                sendCommand('getVolume');
            }
        }
    });
}

function sendCommand(cmd, val) {
    if (isConnected) {
        switch (cmd) {
            case 'getMute':
                viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
                    .then(() => {
                        return viera.getMute();
                    })
                    .then(mute => {
                        adapter.setState('mute', {val: data, ack: true});
                        adapter.setState('info.tv_on', {val: true, ack: true});
                    })
                    .catch(error => {
                        //adapter.log.error('getMute: ' + err);
                        adapter.setState('info.tv_on', {val: false, ack: true});
                    });
                break;

            case 'mute':
                viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
                    .then(() => {
                        return viera.setMute(val);
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
                        //adapter.log.error('getVolume: ' + error);
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
 
            case 'volume':
                viera.connect(adapter.config.ip, adapter.config.app_id, adapter.config.encryption_key)
                    .then(() => {
                        return viera.setVolume(val);
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
    // or start the instance directly
    startAdapter();
} 
