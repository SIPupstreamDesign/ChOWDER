/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	/**
	 * Sender
	 * @method Sender
	 */
	var Sender = function () {},
		operator,
		metabinary = require('./metabinary.js'),
		Command = require('./command.js');
	
	/**
	 * オペレータ(operator.js)設定
	 * @method setOperator
	 * @param {} ope
	 */
	function setOperator(ope) {
		operator = ope;
	}
	
	/**
	 * WebSocketイベント登録
	 * @method registerWSEvent
	 * @param {Socket} ws_connection WebSocketコネクション
	 * @param {Socket} io socket.io オブジェクト
	 * @param {Socket} ws WebSocketServerオブジェクト
	 */
	function registerWSEvent(ws_connection, io, ws) {
		ws_connection.on('message', function (message) {
			var request;
			if (message.type === 'utf8' && message.utf8Data === 'view') { return; }
			
			function update() {
				ws.broadcast(Command.update);
				io.sockets.emit(Command.update);
			}

			if (message.type === 'utf8') {
				request = JSON.parse(message.utf8Data);

				if (request.command === Command.reqGetMetaData) {
					operator.commandGetMetaData(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqGetContent) {
					operator.commandGetContent(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqGetWindow) {
					operator.commandGetWindow(null, ws_connection, request, function () {});
				} else if (request.command === Command.reqAddWindow) {
					operator.commandAddWindow(null, ws_connection, request, update);
				}
			}
		});
	}
	
	Sender.prototype.registerWSEvent = registerWSEvent;
	Sender.prototype.setOperator = setOperator;
	module.exports = new Sender();
}());
