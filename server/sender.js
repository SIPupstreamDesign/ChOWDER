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
		ws_connector = require('./ws_connector.js'),
		io_connector = require('./io_connector.js'),
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
		var methods = {},
			post_update = (function (ws, io) {
				return function (resultCallback) {
					ws_connector.broadcast(ws, Command.Update);
					io_connector.broadcast(io, Command.Update);
					return resultCallback;
				};
			}(ws, io)),
			post_updateTransform = (function (ws, io) {
				return function (id, resultCallback) {
					ws_connector.broadcast(ws, Command.UpdateTransform, {id : id});
					io_connector.broadcast(io, Command.UpdateTransform, {id : id});
					return resultCallback;
				};
			}(ws, io)),
			post_updateWindow = (function (ws, io) {
				return function (resultCallback) {
					ws_connector.broadcast(ws, Command.UpdateWindow);
					io_connector.broadcast(io, Command.UpdateWindow);
					return resultCallback;
				};
			}(ws, io));
		
		
		ws_connector.on(Command.GetMetaData, function (data, resultCallback) {
			operator.commandGetMetaData(null, ws_connection, data, resultCallback);
		});

		ws_connector.on(Command.GetContent, function (data, resultCallback) {
			operator.commandGetContent(null, ws_connection, data, resultCallback);
		});
		
		ws_connector.on(Command.GetWindow, function (data, resultCallback) {
			operator.commandGetWindow(null, ws_connection, data, resultCallback);
		});
		
		ws_connector.on(Command.AddWindow, function (data, resultCallback) {
			console.log("Command.AddWindow");
			operator.commandAddWindow(null, ws_connection, data, post_update(resultCallback));
		});
		
		ws_connector.registerEvent(ws, ws_connection);
	}
	
	Sender.prototype.registerWSEvent = registerWSEvent;
	Sender.prototype.setOperator = setOperator;
	module.exports = new Sender();
}());
