var _path = require('path');
const CFG_FILE = _path.resolve(__dirname, 'config', 'config.json');
var _cfg = readJson(CFG_FILE);

var _logger = require(_path.resolve(__dirname, 'Node-Logger', 'app.js'));

var _wyze = require('wyze-node');
var _ping = require('ping').promise.probe;

_wyze = new _wyze({
    username: _cfg.wyze.username,
    password: _cfg.wyze.password
});

// kick off monitoring of each device
_cfg.devices.forEach((device, i) => {
    startMonitor(device);
});

async function startMonitor(device) {
    var alive;
    device.ping_fail_counter = 0;
    device.is_down = false;
    device.full_info = device.plug_name + ' (' + device.camera_IP + ')';
    device.ping_time_s = _cfg.ping.time_ms / 1000;

    _logger.Init.Async('Monitoring ' + device.full_info, 'Ping sent every ' + device.ping_time_s + ' second(s)');
    console.log('Monitoring ' + device.full_info + ' every ' + device.ping_time_s + ' second(s)');

    while (true) {
        alive = await _ping(device.camera_IP, {
            timeout: _cfg.ping.timeout_s
        });
        alive = alive.alive;

        if (!alive && !device.is_down) {
            if (++device.ping_fail_counter == _cfg.ping.consecutive_pings_before_down) {
                device.is_down = true;

                _logger.Info.Async('Device offline, rebooting', device.full_info);
                console.log(device.full_info + ' offline, rebooting');

                // reboot the plug
                await reboot(device.plug_name);

                _logger.Info.Async('Device rebooted', device.full_info);
                console.log(device.full_info + ' rebooted');
            }
        }
        else if (alive && device.is_down) {
            device.ping_fail_counter = 0;
            device.is_down = false;
        }

        await wait(_cfg.ping.time_ms);
    }
}

function reboot(device) {
    return new Promise(async (resolve, reject) => {
        var wyze_device = await _wyze.getDeviceByName(device);

        await _wyze.turnOff(wyze_device);
        await wait(_cfg.reboot.time_between_off_and_on_ms);
        await _wyze.turnOn(wyze_device);
        await wait(_cfg.reboot.time_after_reboot_ms);

        resolve();
    });
}

function wait(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

function readJson(filePath) {
    var fs = require('fs');
    var path = require('path');
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, filePath), 'utf8'));
}