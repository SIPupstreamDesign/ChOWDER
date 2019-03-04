const exec = require('child_process').exec;
const os = require('os');
const path = require('path');

const packagerPath = path.join(__dirname, './node_modules/.bin/electron-packager');
const winCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=win32 --arch=x64 --electron-version=2.0.2 --overwrite";
const linuxCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=linux --arch=x64 --electron-version=2.0.2 --overwrite";
const macCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=darwin --arch=x64 --electron-version=2.0.2 --overwrite";

let cmd = macCmd;
if (os.platform() === 'win32') {
    cmd = winCmd;
} else if (os.platform() === 'linux') {
    cmd = linuxCmd;
}

exec(cmd, (err, stdout, stderr) => {
    if (stdout) {
        console.log(stdout);
    }
    if (stderr) {
        console.log(stderr);
    }
    if (err !== null) {
        console.log('Exec error: ' + err);
    }
});
