/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 
'use strict';

// == load modules =============================================================
let fs = require('fs');
let path = require('path');
let argv = require('argv');
let readline = require('readline');

let WebSocketWrapper = require('./websocket');

// == prepare image processor ==================================================
let imageProcessor = null;

/*
try {
	imageProcessor = require('./image-processor-images');
} catch (e) {
	// do nothing
}
*/

if (!imageProcessor) {
	try {
		imageProcessor = require('./image-processor-sharp');
	} catch (e) {
		throw 'It seems both `images` and `sharp` are failed to be installed, one of these two is required at least';
	}
}

// == general utilities ========================================================
/**
 * ランダムな色を生成する
 * @returns {string} ランダムな色
 */
let getRandomColor = function() {
	return 'rgb(' + Math.floor(Math.random() * 128 + 127) + ','
	+ Math.floor(Math.random() * 128 + 127) + ','
	+ Math.floor(Math.random() * 128 + 127) + ')';
};

// == process argv =============================================================
let args = argv.option([
	{
		name: 'config',
		short: 'c',
		type: 'path'
	},
	{
		name: 'metadata',
		short: 'm',
		type: 'string'
	}
]).run();

if (args.targets.length === 0) {
	console.log( 'Usage: tileimage --metadata={\\"key\\":\\"value\\"} image.jpg' );
	process.exit();
}

let configPath = (args.options.config || path.resolve(__dirname, './config.json'));
console.log('Config file: ' + configPath);
let config = require(configPath);

let keyvalue = undefined;
if (args.options.metadata) {
	console.log('Metadata: ' + args.options.metadata);
	keyvalue = JSON.parse(args.options.metadata);
}

let imagePath = path.resolve(process.cwd(), args.targets[ 0 ]);
if (!fs.existsSync(imagePath)) {
	throw new Error('Image file not found: ' + imagePath);
}
console.log('Image file: ' + imagePath);

// == パフォーマンス計算用 ==============================================
let enableMeasureTime = false;
const OUTPUT_DIR = path.join(__dirname, "./log");
const MethodToMeaning = {
	StartGenerateThumbnail : "サムネイル取得開始",
	EndGenerateThumbnail : "サムネイル取得終了",
	Start_AddHistoricalContent : "時系列画像を追加開始",
	Start_ImageSplit : "画像分割開始",
	End_ImageSplit : "画像分割終了",
	Start_AddTileContent : "タイルの追加開始",
	End_AddTileContent : "タイルの追加終了",
	End_AddHistoricalContent : "時系列画像の追加終了",
	TotalDuration : "送信開始から終了までの時間",
};

// パフォーマンス計算用時間を生成して返す
function fetchMeasureTime() {
	return new Date().toISOString();
}
let startTime = fetchMeasureTime();
let logStream = null;
// 書き込みファイル準備
function prepareLogFile(fullFileName) {
	let filePath = path.join(OUTPUT_DIR, fullFileName);
	if (!fs.existsSync(filePath)) {
		return fs.createWriteStream(filePath);
	}
	let splits = fullFileName.split('.csv');
	let dotSplits = splits[0].split(".");
	let fileName = dotSplits[0];
	if (dotSplits.length > 1) {
		let num = Number(dotSplits[1]);
		fileName += "." + ('0000' + (num + 1)).slice(-4);
	} else {
		fileName += ".0001";
	}
	return prepareLogFile(fileName + ".csv");
}
// 書き込み
function savePerformanceLog(label, time, tileIndex) {
	if (!logStream) {
		if (!fs.existsSync(OUTPUT_DIR)) {
			fs.mkdirSync(OUTPUT_DIR);
		}
		const fileName = "tileimage_log" + "_"+ config.contentid + ".csv";
		logStream = prepareLogFile(fileName);
		logStream.write('\uFEFF');
		logStream.write("label,time,id,tileIndex,\n");
	}
	let row = MethodToMeaning[label];
	row += "," + time;
	row += "," + config.contentid;
	if (tileIndex !== undefined) {
		row += "," + String(tileIndex);
	}
	row += "," + "\n";
	logStream.write(row);
}

// == beginning of main procedure ==============================================
let wsWrapper = new WebSocketWrapper();

// == connect to the websocket server ==========================================
wsWrapper.connect(config.url).then(function() {
	console.log('WebSocket connection established');

	// == login as display =======================================================
	return wsWrapper.sendUTF('Login', {
		id: config.id,
		password: config.password
	});
}).then(function(parsed) {
	if (parsed.error) {
		throw new Error('Login failed: ' + parsed.error);
	}
	console.log('Logged in as ' + parsed.result.id);
	
	return wsWrapper.sendUTF('GetGlobalSetting', {});

}).then(function(parsed) {
	if (parsed.error) {
		throw new Error('Login failed: ' + parsed.error);
	}
	enableMeasureTime = String(parsed.result.enableMeasureTime) === "true";

	if (enableMeasureTime) {
		savePerformanceLog("StartGenerateThumbnail", fetchMeasureTime());
	}
	// == generate thumbnail =====================================================
	return imageProcessor.generateThumb(imagePath, config.thumbsize || 1920);
}).then(function(thumb) {
	console.log('Thumbnail generated');

	if (enableMeasureTime) {
		savePerformanceLog("EndGenerateThumbnail", fetchMeasureTime());
	}

	// == request group id =======================================================
	return wsWrapper.sendUTF('GetGroupList', {}).then(function(parsed) {
		let desiredGroup = parsed.result.grouplist.filter(function(group) {
			return group.name === config.contentgrp;
		});
		if (desiredGroup.length !== 0) { // if there already are desired group
			return desiredGroup[0].id;
		} else { // else then create the new group
			return wsWrapper.sendUTF('AddGroup', {
				name: config.contentgrp,
				color: getRandomColor()
			}).then(function(parsed) {
				if (parsed.error) {
					throw new Error('Error while creating new content group: ' + parsed.error);
				}

				return parsed.result;
			});
		}
	}).then(function(groupId) {
		console.log('Group id: ' + groupId);
		let metaData = {
			type: 'tileimage',
			id: config.contentid,
			content_id: config.contentid,
			group: groupId,
			posx: 0,
			posy: 0,
			width: thumb.width,
			height: thumb.height,
			xsplit: config.xsplit,
			ysplit: config.ysplit,
			visible : config.visible ? config.visible : false,
			reload_latest: config.reload_latest,
			keyvalue: keyvalue ? JSON.stringify(keyvalue) : undefined
		};
		if (enableMeasureTime) {
			metaData.time_register = new Date().toISOString();
			savePerformanceLog("Start_AddHistoricalContent", fetchMeasureTime());
		}
		// == send thumbnail =======================================================
		return wsWrapper.sendBinary('AddHistoricalContent', metaData, thumb.buffer);
	});
}).then(function(parsed) {
	if (parsed.error) {
		throw new Error('Error while sending thumbnail: ' + parsed.error);
	}
	console.log('Thumbnail sent');

	// == split the image ========================================================
	let historyId = parsed.result.history_id;
	let n = config.xsplit * config.ysplit;

	let isImageSplitting = true;
	imageProcessor.splitImage(imagePath, config.xsplit, config.ysplit, 8, function(buffer, i) {
		readline.cursorTo(process.stdout, 0);
		process.stdout.write('Tiled image processing: ' + ((i + 1) / n * 100.0).toFixed(0) + '%');

		let metaData = {
			id: config.contentid,
			history_id: historyId,
			tile_index: i
		};
		if (enableMeasureTime) {
			metaData.time_register = new Date().toISOString();
			savePerformanceLog("Start_AddTileContent", fetchMeasureTime());
		}
		
		// == send each image fragment =============================================
		return wsWrapper.sendBinary('AddTileContent', metaData, buffer);
	}, (i) => {
		if (enableMeasureTime) {
			savePerformanceLog("Start_ImageSplit", fetchMeasureTime(), i);
		}
	}, (i) => {
		if (enableMeasureTime) {
			savePerformanceLog("End_ImageSplit", fetchMeasureTime(), i);
		}
	}, (i) => {
		if (enableMeasureTime) {
			savePerformanceLog("End_AddTileContent", fetchMeasureTime(), i);
		}
	}).then(function() {
		console.log();
		console.log('Done');

		if (enableMeasureTime) {
			savePerformanceLog("End_AddHistoricalContent", fetchMeasureTime());
			savePerformanceLog("TotalDuration", (new Date(fetchMeasureTime()) - new Date(startTime)) / 1000 + "秒");
		}
		wsWrapper.disconnect();
	});
});