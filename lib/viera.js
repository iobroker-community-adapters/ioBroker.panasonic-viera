// Viera.js 0.1.4
// (c) 2014 Samuel Matis
// Viera.js may be freely distributed or modified under the MIT license.
//
// The MIT License (MIT)
//
// Copyright (c) 2014 Samuel Matis
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function() {

    var http = require('http');

    /**
     * Constructor
     *
     * @param {String} ipAddress The IP Address of the TV
     */
    var Viera = function (ipAddress) {
        // Check if ipAddress is valid IP address
        var ipRegExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

        if(ipRegExp.test(ipAddress)) {
            this.ipAddress = ipAddress;
        } else {
            throw new TypeError('You entered invalid IP address!');
        }
    };

    /**
     * Create and send request to the TV
     *
     * @param {String} type    Type of your request                        
     * @param {String} action  The xml action type to perform
     * @param {String} command The command from codes.txt you want to perform
     * @param {function} callback called when finished
     */
     Viera.prototype.sendRequest = function (type, action, command, callback) {
        var url, urn;
        if(type === 'command') {
            url = '/nrc/control_0';
            urn = 'panasonic-com:service:p00NetworkControl:1';
        } else if (type === 'render') {
            url = '/dmr/control_0';
            urn = 'schemas-upnp-org:service:RenderingControl:1';
        }

        var body = '<?xml version="1.0" encoding="utf-8"?> \
                    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"> \
                    <s:Body> \
                     <u:' + action + ' xmlns:u="urn:'+urn+'"> \
                      ' + command + ' \
                     </u:' + action + '> \
                    </s:Body> \
                    </s:Envelope>';

        var postRequest = {
            host: this.ipAddress,
            path: url,
            port: 55000,
            method: 'POST',
            headers: {
                'Content-Length': body.length,
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPACTION': '"urn:' + urn + '#' + action + '"'
            }
        };

        var req = http.request(postRequest, function (res) {
            var result = '';
            res.setEncoding('utf8');
            res.on('data', function (data) {
                result += (data || '').toString();
            });
            res.on('end', function () {
                callback(null, result);
            });
        });

        req.on('error', function(e) {
            callback && callback(e);
        }.bind(this));

        req.write(body);
        req.end();

        return this;
    };

    /**
     * Send a command to the TV
     *
     * @param {String} command Command from codes.txt
     * @param {function} callback called when the command is called
     */
    Viera.prototype.sendCommand = function (command, callback) {
        this.sendRequest('command', 'X_SendKey', '<X_KeyEvent>NRC_' + command.toUpperCase() + '-ONOFF</X_KeyEvent>', callback);
        return this;
    };

    /**
     * Get volume from TV
     *
     * @param {Function} callback 
     */
    Viera.prototype.getVolume = function (callback) {
        this.sendRequest('render', 'GetVolume', '<InstanceID>0</InstanceID><Channel>Master</Channel>', function (error, data) {
            var match = /<CurrentVolume>(\d*)<\/CurrentVolume>/gm.exec(data || '');
            if (match) {
                var volume = match[1];
                callback(null, parseFloat(volume));
            } else {
                callback(error || 'No data found');
            }
        }.bind(this));
    };

    /**
     * Set volume
     *
     * @param {number} volume Desired volume in range from 0 to 100
     * @param {function} callback called when the command is called
     */
    Viera.prototype.setVolume = function (volume, callback) {
        if (volume < 0 || volume > 100) {
            throw new Error('Volume must be in range from 0 to 100');
        }

        this.sendRequest('render', 'SetVolume', '<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>' + volume + '</DesiredVolume>', callback);
        return this;
    };

    /**
     * Get the current mute setting
     *
     * @param {Function} callback
     */
    Viera.prototype.getMute = function (callback) {
        this.sendRequest('render', 'GetMute', '<InstanceID>0</InstanceID><Channel>Master</Channel>', function (error, data) {
            var regex = /<CurrentMute>([0-1])<\/CurrentMute>/gm;
            var match = regex.exec(data || '');
            if (match) {
                var mute = (match[1] === '1');
                callback && callback(null, mute);
            } else {
                callback(error || 'No data found');
            }
        });
    };

    /**
     * Set mute to on/off
     *
     * @param {Boolean} enable The value to set mute to
     * @param {function} callback called when the command is called
     */
    Viera.prototype.setMute = function (enable, callback) {
        var mute = (enable)? '1' : '0';
        this.sendRequest('render', 'SetMute', '<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>' + mute + "</DesiredMute>", callback);
        return this;
    };

    // Export the constructor
    module.exports = Viera;

}).call(this);
