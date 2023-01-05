/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

/*jslint devel:true*/
/*global process, require, socket */
(()=>{
	let fs = require('fs'),
		path  = require('path'),
		http = require('http'),
		https = require('https'),
		WebSocket = require('websocket'),
		util = require('./util'),
		ws_connector = require('./ws_connector.js'),
		port = 80,
		sslport = 443,
		currentVersion = "v2",
		ws2_connections = {},
		id_counter = 0,
		Command = require('./command.js'),
		ws2, // web socket server operator instance
		ws2_s,
		settings;

	const Logger = require('./operator/PerformanceLogger.js');

	const CommandOperator = require('./operator/CommandOperator.js');
	const commandOperator = new CommandOperator;
	const executer = commandOperator.executer;

	const WebsocketInterface = require('./operator/WebSocketInterface.js');
	const wsInterface = new WebsocketInterface(commandOperator);

	// register server id
	executer.registerUUID("default");

	if (process.argv.length > 2) {
		port = parseInt(process.argv[2], 10);
		if (process.argv.length > 3) {
			sslport = parseInt(process.argv[3], 10);
		}
	}

	//----------------------------------------------------------------------------------------
	// websocket sender
	//----------------------------------------------------------------------------------------
	let options = {
		key: fs.readFileSync(path.join(__dirname, 'key.pem')),
		cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
	};

	//----------------------------------------------------------------------------------------
	// websocket operator
	//----------------------------------------------------------------------------------------

	function ws_request(ws2) { // for http or https
		return (request)=>{
			"use strict";
			let connection = null;
			if (request.resourceURL.pathname.indexOf(currentVersion) < 0) {
				console.log('invalid version');
				return;
			}

			connection = request.accept(null, request.origin);
			console.log((new Date()) + " ServerImager Connection accepted : " + id_counter);

			// save connection with id
			connection.id = util.generateUUID8() + String(id_counter);
			ws2_connections[connection.id] = connection;
			id_counter = id_counter + 1;

			wsInterface.registerWSEvent(connection, ws2, ws2_connections);

			connection.on('close', ((connection)=>{
				return ()=>{
					delete ws2_connections[connection.id];

					executer.decrWindowReferenceCount(connection.id, (err, meta)=>{
						ws_connector.broadcast(ws2, Command.UpdateWindowMetaData, meta);
					});

					console.log('connection closed :' + connection.id);
					//🐔このへんで分割受信解放処理
				};
			})(connection));
		}
	}

	//----------------------------------------------------------------------------------------
	// socket.io operator
	//----------------------------------------------------------------------------------------
	function opserver_http_request(req, res) {
		'use strict';
		//console.log('REQ>', req.url);
		let file,
			fname,
			ext,
			url = req.url,
			temp,
			data = "",
			contentID;

		if (settings && settings.hasOwnProperty('enableCORS') && settings.enableCORS) {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Request-Method', '*');
			res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
			res.setHeader('Access-Control-Allow-Headers', '*');
			if ( req.method === 'OPTIONS' ) {
				res.writeHead(200);
				res.end();
				return;
			}
		}

		if (url === '/') {
			file = fs.readFileSync(path.join(__dirname, '../public/index.html'));
			res.end(file);
		} else if (url.indexOf('/download?') === 0) {
			temp = url.split('?');
			if (temp.length > 1) {
				contentID = temp[1];
				if (contentID.length === 8) {
					commandOperator.getContent("master", {
						id : contentID,
						type : null
					}, (err, meta, reply)=>{
						if (reply && reply instanceof Array && reply.length > 0) {
							res.end(reply[0]);
						} else if (reply) {
							res.end(reply);
						} else {
							res.end(data);
						}
					});
				} else {
					res.end(data);
				}
			} else {
				res.end(data);
			}
		} else {
			let p = path.join(__dirname, '../public', path.join('/', url.match(/^[^?]+/)[0]));
			fs.readFile(p, (err, data)=>{
				//                                          ^^^^^^^^^^^^^ it's traversal safe!
				if (err) {
					res.writeHead(404, {'Content-Type': 'text/html', charaset: 'UTF-8'});
					res.end("<h1>not found<h1>");
					return;
				}
				ext = util.getExtention(url);
				if (ext === "css") {
					res.writeHead(200, {'Content-Type': 'text/css', charaset: 'UTF-8'});
				} else if (ext === "html" || ext === "htm") {
					res.writeHead(200, {'Content-Type': 'text/html', charaset: 'UTF-8'});
				} else if (ext === "svg") {
					res.writeHead(200, {'Content-Type': 'image/svg+xml', charaset: 'UTF-8'});
				} else if (ext === "js" || ext === "json") {
					res.writeHead(200, {'Content-Type': 'text/javascript', charaset: 'UTF-8'});
				} else {
					res.writeHead(200);
				}
				res.end(data);
			}); // fs.readFile
		}
	}

	/// http server instance for operation

	fs.readFile(path.join(__dirname, 'setting.json'), (err, data)=>{
		if (err) {
			console.error("Error: Failed to load setting.json.");
			return;
		}

		// 設定ファイルをパース
		try {
			settings = JSON.parse(String(data));
		} catch (e) {
			console.error(e);
			console.error("Failed to load setting.json");
			process.exit(-1);
		}

		// executerに設定ファイルをセット
		executer.setSettingJSON(settings);

		// パフォーマンス計測用の設定
		if (settings && settings.hasOwnProperty('enableMeasureTime') && String(settings.enableMeasureTime) === "true" ) {
			Logger.setExecuter(executer);
			Logger.setEnableMeasureTime(true);
		}

		// http/httpsサーバを有効にするかどうか
		const enableHTTP = settings.hasOwnProperty('enableHTTP') && settings.enableHTTP;
		const enableSSL = settings.hasOwnProperty('enableSSL') && settings.enableSSL;

		// http/httpsサーバのポートを設定ファイルから取得
		if (settings.hasOwnProperty('HTTPPort') && Number(settings.HTTPPort)) {
			port = Number(settings.HTTPPort)
		}
		if (settings.hasOwnProperty('SSLPort') && Number(settings.SSLPort)) {
			sslport = Number(settings.SSLPort);
		}

		let wsList = [];
		if (enableHTTP) {
			let opsever = http.createServer(opserver_http_request);
			opsever.listen(port);
			/// web socket server instance
			ws2 = new WebSocket.server({ httpServer : opsever,
					maxReceivedMessageSize: Number(settings.wsMaxMessageSize),
					maxReceivedFrameSize :Number(settings.wsMaxMessageSize),
					autoAcceptConnections : false});

			// 設定ファイルのメッセージサイズによる起動が失敗した場合、固定のサイズで起動する
			if (!ws2) {
				ws2 = new WebSocket.server({ httpServer : opsever,
					maxReceivedMessageSize: 64*1024*1024, // 64MB
					maxReceivedFrameSize : 64*1024*1024, // more receive buffer!! default 65536B
					autoAcceptConnections : false});
			}

			if (ws2) {
				wsList.push(ws2);
			}
		}
		if (enableSSL) {
			let opsever_s = https.createServer(options, opserver_http_request);
			opsever_s.listen(sslport);
			/// web socket server instance
			ws2_s = new WebSocket.server({ httpServer : opsever_s,
				maxReceivedMessageSize: Number(settings.wsMaxMessageSize),
				maxReceivedFrameSize : Number(settings.wsMaxMessageSize),
				autoAcceptConnections : false});

			// 設定ファイルのメッセージサイズによる起動が失敗した場合、固定のサイズで起動する
			if (!ws2_s)	{
				ws2_s = new WebSocket.server({ httpServer : opsever_s,
					maxReceivedMessageSize: 64*1024*1024, // 64MB
					maxReceivedFrameSize : 64*1024*1024, // more receive buffer!! default 65536B
					autoAcceptConnections : false});
			}

			if (ws2_s) {
				wsList.push(ws2_s);
			}
		}


		if (enableHTTP) {
			// リクエストを受け付けるコールバックを設定
			ws2.on('request', ws_request(wsList));
			// 開いたポートをコンソールにプリント
			const portSTR = (port===80) ? (":" + port) : ("");
			console.log('start server "http://localhost' + portSTR + '/"');
			console.log('start ws operate server "ws://localhost' + portSTR + '/"');
		}

		if (enableSSL) {
			// リクエストを受け付けるコールバックを設定
			ws2_s.on('request', ws_request(wsList));
			// 開いたポートをコンソールにプリント
			const portSTR = (sslport===443) ? (":" + sslport) : ("");
			console.log('start server "https://localhost' + portSTR + '/"');
			console.log('start ws operate server "wss://localhost' + portSTR + '/"');
		}
	});

	// unregister all window
	process.on('exit', ()=>{
		"use strict";
		console.log("exit");
	});

	process.on('SIGINT', ()=>{
		"use strict";
		console.log("SIGINT");
		//unregisterAllWindow();
		setTimeout(()=>{
			process.exit();
		}, 500);
	});

	console.log('start ChOWDER Server');
})();
