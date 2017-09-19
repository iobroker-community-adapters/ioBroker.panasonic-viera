/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

var Controller = require(__dirname + '/lib/viera.js');
var ping       = require('ping');

// you have to require the utils module and call adapter function
var utils      = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('panasonic-viera');

var device;
var isConnected = null;

// is called if a subscribed object changes
/*adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});
*/
// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {    
    if (id && state && !state.ack){
        id = id.substring(adapter.namespace.length + 1);
        sendCommand(id, state.val);
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', main);

function setConnected(_isConnected) {
    if (isConnected !== _isConnected) {
        isConnected = _isConnected;
        adapter.setState('info.connection', {val: isConnected, ack: true});
    }
}

function main() {
    if (adapter.config.ip && adapter.config.ip !== '0.0.0.0') {
        device = new Controller(adapter.config.ip);
        // in this template all states changes inside the adapters namespace are subscribed
        adapter.subscribeStates('*');
        checkStatus();
	    
        setInterval(checkStatus, 60000);
    } else {
        adapter.log.error('Please configure the Panasonic Viera adapter');
    }

}

function checkStatus() {
    ping.sys.probe(adapter.config.ip, function (isAlive) {
        setConnected(isAlive);
        if (isAlive) {
            sendCommand('getMute');
            sendCommand('getVolume');
        }
    });
}

function sendCommand(cmd, val) {
    switch (cmd){
        case 'getMute':
            device.getMute(function (err, data) {
                if (err) {
                    adapter.log.error('getMute: ' + err);
                } else {
                    adapter.setState('mute', {val: data, ack: true});
                }
            });
            break;

        case 'mute':
            device.setMute(val, function (err) {
                if (err) {
                    adapter.log.error('setMute: ' + err);
                }
                device.getMute(function (err, data) {
                    if (err) {
                        adapter.log.error('getMute: ' + err);
                    } else {
                        adapter.setState('mute', {val: data, ack: true});
                    }
                });
            });
            break;

        case 'getVolume':
            device.getVolume(function (err, data) {
                if (err) {
                    adapter.log.error('getVolume: ' + err);
                } else {
                    adapter.setState('volume', {val: data, ack: true});
                }
            });
            break;

        case 'VOLUP':
        case 'VOLDOWN':
            device.sendCommand(cmd, function (err) {
                if (err) {
                    adapter.log.error('sendCommand[' + cmd + ']: ' + err);
                }
                device.getVolume(function (err, data) {
                    if (err) {
                        adapter.log.error('getVolume: ' + err);
                    } else {
                        adapter.setState('volume', {val: data, ack: true});
                    }
                });
            });

            break;

        case 'volume':
            device.setVolume(val);
            device.getVolume(function (err, data) {
                if (err) {
                    adapter.log.error('getVolume: ' + err);
                } else {
                    adapter.setState('volume', {val: data, ack: true});
                }
            });
            break;

        default:
            device.sendCommand(cmd, function (err) {
                if (err) {
                    adapter.log.error('sendCommand[' + cmd + ']: ' + err);
                }
            });
            break;
    }
}