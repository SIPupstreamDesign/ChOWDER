/*jslint devel:true*/
/*global process, require, socket */

var fs = require('fs'),
	http = require('http'),
	https = require('https'),
	WebSocket = require('websocket'),
	util = require('./util'),
	operator = require('./operator.js'),
	sender = require('./sender.js'),
	ws_connector = require('./ws_connector.js'),
	io_connector = require('./io_connector.js'),
	port = 8080,
	sslport = 9090,
	currentVersion = "v2",
	ws2_connections = {},
	id_counter = 0,
	Command = require('./command.js'),
	io,   // socket io server operator instance
	io_s,
	ws2, // web socket server operator instance
	ws2_s;  

console.log(operator);

// register server id
operator.registerUUID("default");

if (process.argv.length > 2) {
	port = parseInt(process.argv[2], 10);
	if (process.argv.length > 3) {
		sslport = parseInt(process.argv[3], 10);
	}
}
//----------------------------------------------------------------------------------------
// websocket sender
//----------------------------------------------------------------------------------------
var options= {
	key: fs.readFileSync('server.key'),
	cert: fs.readFileSync('server.crt')
};

//----------------------------------------------------------------------------------------
// websocket operator
//----------------------------------------------------------------------------------------
/// http server instance for websocket operator
var wsopserver = http.createServer(function (req, res) {
	'use strict';
	console.log('REQ>', req.url);
	res.end("websocket operator");
});
wsopserver.listen(port + 1);

var wsopserver_s = https.createServer(options, function (req, res) {
	'use strict';
	console.log('REQ>', req.url);
	res.end("websocket operator");
});
wsopserver_s.listen(sslport + 1);

/// web socket server instance
ws2 = new WebSocket.server({ httpServer : wsopserver,
		maxReceivedMessageSize: 64*1024*1024, // 64MB
		maxReceivedFrameSize : 64*1024*1024, // more receive buffer!! default 65536B
		autoAcceptConnections : false});
		
ws2_s = new WebSocket.server({ httpServer : wsopserver_s,
	maxReceivedMessageSize: 64*1024*1024, // 64MB
	maxReceivedFrameSize : 64*1024*1024, // more receive buffer!! default 65536B
	autoAcceptConnections : false});

function ws_request(io, ws2) { // for http or https
	return function (request) {
		"use strict";
		var connection = null;
		if (request.resourceURL.pathname.indexOf(currentVersion) < 0) {
			console.log('invalid version');
			return;
		}
		
		connection = request.accept(null, request.origin);
		console.log((new Date()) + " ServerImager Connection accepted : " + id_counter);
		
		// save connection with id
		connection.id = id_counter;
		ws2_connections[id_counter] = connection;
		id_counter = id_counter + 1;
		
		operator.registerWSEvent(connection, io, ws2);
		
		connection.on('close', (function (connection) {
			return function () {
				delete ws2_connections[connection.id];
	
				operator.decrWindowReferenceCount(connection.id, function (err, meta) {
					io_connector.broadcast(io, Command.UpdateWindowMetaData, meta);
					//ws_connector.broadcast(ws2, Command.UpdateWindowMetaData, meta);
				});
	
				console.log('connection closed :' + connection.id);
			};
		}(connection)));
	}
}

//----------------------------------------------------------------------------------------
// socket.io operator
//----------------------------------------------------------------------------------------
function opserver_http_request(req, res) {
	'use strict';
	console.log('REQ>', req.url);
	var file,
		fname,
		ext,
		url = req.url,
		temp,
		data = "",
		contentID;
	if (url === '/') {
		file = fs.readFileSync('../client/index.html');
		res.end(file);
	} else if (url.indexOf('/download?') === 0) {
		temp = url.split('?');
		if (temp.length > 1) {
			contentID = temp[1];
			if (contentID.length === 8) {
				operator.commandGetContent("master", {
					id : contentID,
					type : null
				}, function (err, meta, reply) {
					res.end(reply);
				});
			} else {
				res.end(data);
			}
		} else {
			res.end(data);
		}
	} else {
		fs.readFile('../client/' + url, function (err, data) {
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
var opsever = http.createServer(opserver_http_request);
opsever.listen(port);

var opsever_s = https.createServer(options, opserver_http_request);
opsever_s.listen(sslport);

/// socekt.io server instance
io = require('socket.io').listen(opsever).of(currentVersion);
io_s = require('socket.io').listen(opsever_s, options).of(currentVersion);

function io_request(io, ws2) {
	"use strict";
	return function (socket) {
		console.log("[CONNECT] ID=" + socket.id);

		operator.registerEvent(io, socket, ws2, ws2_connections);
		io_connector.broadcast(io, Command.Update);

		socket.on('disconnect', function () {
			console.log("disconnect:" + socket.id);
			ws_connector.broadcast(ws2, Command.UpdateMouseCursor, { id : socket.id });
		});
		socket.on('error', function (err) {
			console.log('trace.. ' + err.stack);
			console.error('trace.. ' + err.stack);
		});
	};
}

ws2.on('request', ws_request(io, ws2));
ws2_s.on('request', ws_request(io_s, ws2_s));

io.on('connection', io_request(io, ws2));
io_s.on('connection', io_request(io_s, ws2_s));


//----------------------------------------------------------------------------------------

/*
function unregisterAllWindow(endCallback) {
	"use strict";
	var id;
	for (id in ws_connections) {
		if (ws_connections.hasOwnProperty(id)) {
			operator.unregisterWindow(id);
		}
	}
	for (id in ws2_connections) {
		if (ws2_connections.hasOwnProperty(id)) {
			operator.commandDeleteWindowMetaData(id);
		}
	}
}
*/

// unregister all window
process.on('exit', function () {
	"use strict";
	console.log("exit");
});

process.on('SIGINT', function () {
	"use strict";
	console.log("SIGINT");
	//unregisterAllWindow();
	setTimeout(function () {
		process.exit();
	}, 500);
});

//----------------------------------------------------------------------------------------

console.log('start server "http://localhost:' + port + '/"');
console.log('start ws operate server "ws://localhost:' + (port + 1) + '/"');
console.log('start server "https://localhost:' + sslport + '/"');
console.log('start ws operate server "wss://localhost:' + (sslport + 1) + '/"');
//console.log('start ws operate server "ws://localhost:' + (port + 2) + '/"');

