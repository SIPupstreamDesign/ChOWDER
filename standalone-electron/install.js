const exec = require('child_process').exec;
const os = require('os');
const path = require('path');
const fs = require('fs');

const packagerPath = path.join(__dirname, './node_modules/.bin/electron-packager');
const winCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=win32 --arch=x64 --electron-version=4.1.1 --overwrite";
const linuxCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=linux --arch=x64 --electron-version=4.1.1 --overwrite";
const macCmd = packagerPath + " . ChOWDER-Standalone-Electron --platform=darwin --arch=x64 --electron-version=4.1.1 --overwrite";

let folder = "ChOWDER-Standalone-Electron-darwin-x64";
let cmd = macCmd;
if (os.platform() === 'win32') {
    cmd = winCmd;
    folder = "ChOWDER-Standalone-Electron-win32-x64";
} else if (os.platform() === 'linux') {
    cmd = linuxCmd;
    folder = "ChOWDER-Standalone-Electron-linux-x64";
}

exec(cmd, (err, stdout, stderr) => {
    if (stdout) {
        console.log(stdout);
    }
    if (stderr) {
        console.log(stderr);
    }
    if (!err) {
        fs.copyFile('conf.json', path.join(folder, 'conf.json'), (err) => {
            if (err) {
                console.log(err);
            }
        });
    } else {
        console.log('Exec error: ' + err);
    }
});
