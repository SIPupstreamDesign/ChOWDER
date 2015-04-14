/*jslint devel:true*/
/*global process, require, socket */

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('websocket'),
	util = require('./util'),
	operator = require('./operator.js'),
	sender = require('./sender.js'),
	port = 8080,
	currentVersion = "v1",
	ws_connections = {},
	ws2_connections = {},
	id_counter = 0,
	Command = require('./command.js'),
	io,   // socket io server operator instance
	ws,   // web socket server sender instance
	ws2;  // web socket server operator instance

console.log(operator);

// register server id
operator.registerUUID("default");

//----------------------------------------------------------------------------------------
// websocket sender
//----------------------------------------------------------------------------------------
/// http server instance for sender
var seserver = http.createServer(function (req, res) {
	'use strict';
	console.log('REQ>', req.url);
	res.end("websocket sender");
});
seserver.listen(port + 1);

/// web socket server instance
ws = new WebSocket.server({ httpServer : seserver,
		maxReceivedFrameSize : 0x1000000, // more receive buffer!! default 65536B
		autoAcceptConnections : false});

ws.on('request', function (request) {
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
	ws_connections.id_counter = connection;
	id_counter = id_counter + 1;
	
	connection.on('message', function (message) {
		if (message.type === 'utf8') {
			//console.log("got text" + data);
			if (message.utf8Data === "view") {
				sender.setOperator(operator);
				console.log("register" + message.utf8Data);
				sender.registerWSEvent(connection, io, ws);
				ws.broadcast("update");
			}
		}
	});
	
	connection.on('close', function () {
		delete ws_connections[connection.id];
		operator.commandDeleteWindow(null, connection, null, function () {
			io.sockets.emit(Command.update);
			ws2.broadcast(Command.update);
			console.log("broadcast update");
		});
		console.log('connection closed :' + connection.id);
	});
	
});

//----------------------------------------------------------------------------------------
// socket.io operator
//----------------------------------------------------------------------------------------
/// http server instance for operation
var opsever = http.createServer(function (req, res) {
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
				operator.getContent(null, contentID, function (reply) {
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
});
if (process.argv.length > 2) {
	port = process.argv[2];
}
opsever.listen(port);

/// socekt.io server instance
io = require('socket.io').listen(opsever);

io.sockets.on('connection', function (socket) {
	"use strict";
	console.log("[CONNECT] ID=" + socket.id);
	
	socket.on('reqRegisterEvent', function (apiVersion) {
		if (apiVersion === currentVersion) {
			operator.registerEvent(socket, io, ws);
			io.sockets.emit(Command.update);
		}
	});
	socket.on('disconnect', function () {
		console.log("disconnect:" + socket.id);
	});
});


//----------------------------------------------------------------------------------------
// websocket operator
//----------------------------------------------------------------------------------------
/// http server instance for websocket operator
var wsopserver = http.createServer(function (req, res) {
	'use strict';
	console.log('REQ>', req.url);
	res.end("websocket operator");
});
wsopserver.listen(port + 2);

/// web socket server instance
ws2 = new WebSocket.server({ httpServer : wsopserver,
		maxReceivedFrameSize : 0x1000000, // more receive buffer!! default 65536B
		autoAcceptConnections : false});

ws2.on('request', function (request) {
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
	ws2_connections.id_counter = connection;
	id_counter = id_counter + 1;
	
	operator.registerWSEvent(connection, io, ws);
	
	connection.on('message', function (message) {
		if (message.type === 'utf8') {
			//console.log("got text" + data);
			if (message.utf8Data === "view") {
				console.log("register" + message.utf8Data);
			}
		}
	});
	
	connection.on('close', function () {
		delete ws2_connections[connection.id];
		operator.commandDeleteWindow(null, connection, null, function () {
			console.log("broadcast update");
			io.sockets.emit(Command.update);
			ws2.broadcast(Command.update);
		});
		console.log('connection closed :' + connection.id);
	});
	
});

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
			operator.commandDeleteWindow(id);
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
console.log('start ws sender server "ws://localhost:' + (port + 1) + '/"');
console.log('start ws operate server "ws://localhost:' + (port + 2) + '/"');

