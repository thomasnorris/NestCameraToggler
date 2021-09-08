var _path = require('path');

var _wyze = require('wyze-node');
var _ping = require('ping').promise.probe;

const CFG_FILE = _path.resolve(__dirname, 'config', 'config.json');
var _cfg = readJson(CFG_FILE);

_wyze = new _wyze({
    username: _cfg.wyze.username,
    password: _cfg.wyze.password
});

_cfg.devices.forEach((device, i) => {
    startMonitor(device);
});

async function startMonitor(device) {
    var alive;
    device.ping_fail_counter = 0;
    device.is_down = false;

    console.log('Monitoring ' + device.plug_name + ' every ' + _cfg.ping.time_ms + ' seconds...');

    while (true) {
        alive = await _ping(device.camera_IP, {
            timeout: _cfg.ping.timeout_s
        });
        alive = alive.alive;

        if (!alive && !device.is_down) {
            if (++device.ping_fail_counter == _cfg.ping.consecutive_pings_before_down) {
                device.is_down = true;
                console.log(device.plug_name + ' is down!');
                await reboot(device.plug_name);
                console.log(device.plug_name + ' rebooted!');
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
        device = await _wyze.getDeviceByName(device);

        await _wyze.turnOff(device);
        await wait(_cfg.reboot.time_between_off_and_on_ms);
        await _wyze.turnOn(device);
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