var exec = require('child_process').exec,
    os = require('os'),
    opt = '';

function msvs_version() {
	if (process.env.hasOwnProperty('VS140COMNTOOLS')) {
		return "2015"
	} else if (process.env.hasOwnProperty('VS120COMNTOOLS')) {
		return "2013"
	}
}

if (os.platform() === 'win32') {
    opt = ' --msvs_version=' + msvs_version();
}

var cmds =[ 'cd node_modules/nanomsg && node-gyp rebuild --target=2.0.2 --arch=x64 --dist-url=https://atom.io/download/atom-shell rebuild ' + opt],
    cmd;

for (i in cmds) {
    cmd = cmds[i];
    exec(cmd, function (err, stdout, stderr) {
	if(stdout){
	    console.log('stdout: ' + stdout);
	}
	if(stderr){
	    console.log('stderr: ' + stderr);
	}
	if (err !== null) {
	    console.log('Exec error: ' + err);
	}
    });
}