/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var controller = require('viera.js');
var ping = require("ping");

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('panasonic-viera');

var ip;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {    
    if (id && state && !state.ack){
	id = id.substring(adapter.namespace.length + 1);
	sendCommand(id, state.val);
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function main() {

    ip = adapter.config.ip;
    
    if(ip) {
        // in this template all states changes inside the adapters namespace are subscribed
        adapter.subscribeStates('*');
        
        setInterval(checkStatus, 60000);

    } else {
        adapter.log.error("Please configure the Panasonic Viera adapter");
    }

}

function checkStatus() {
    ping.sys.probe(ip, function (isAlive) {
        adapter.setState("connected", {val: isAlive, ack: true});
        if (isAlive) {
            adapter.setState("mute", {val: sendCommand('getMute'), ack: true});
            adapter.setState("volume", {val: sendCommand('getVolume'), ack: true});
        }
    });
}

function sendCommand(cmd, val) {
    var device = new controller(adapter.config.ip);
    switch (cmd){
        case 'getMute':
            device.getMute(function(data) {
                return data;
            });
            break;
        case 'mute':
            device.setMute(val);
            break;
        case 'getVolume':
            device.getVolume(function(data) {
                return data;
            });
            break;
        case 'VOLUP':
        case 'VOLDOWN':
            device.sendCommand(cmd);
            device.getVolume(function(data) {
                return data;
            });
            break;
        case 'volume':
            device.setVolume(val);
            break;
        default:
            device.sendCommand(cmd);
            break;
    }
    
}
