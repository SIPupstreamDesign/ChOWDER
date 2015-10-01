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
					ws_connector.broadcast(ws, Command.update);
					io.sockets.emit(Command.update);
					return resultCallback;
				};
			}(ws, io)),
			post_updateTransform = (function (ws, io) {
				return function (id, resultCallback) {
					//io_connector.broadcast(ws, io, Command.updateTransform, { id : id});
					ws_connector.broadcast(ws, Command.updateTransform, {id : id});
					io.sockets.emit(Command.updateTransform, id);
					return resultCallback;
				};
			}(ws, io)),
			post_updateWindow = (function (ws, io) {
				return function (resultCallback) {
					ws_connector.broadcast(ws, Command.updateWindow);
					io.sockets.emit(Command.updateWindow);
					return resultCallback;
				};
			}(ws, io));
		
		
		methods.GetMetaData = function (data, resultCallback) {
			operator.commandGetMetaData(null, ws_connection, data, resultCallback);
		};

		methods.GetContent = function (data, resultCallback) {
			operator.commandGetContent(null, ws_connection, data, resultCallback);
		};
		
		methods.GetWindow = function (data, resultCallback) {
			operator.commandGetWindow(null, ws_connection, data, resultCallback);
		};
		
		methods.reqAddWindow = function (data, resultCallback) {
			operator.commandAddWindow(null, ws_connection, data, post_update(resultCallback));
		};
		
		ws_connector.registerEvent(methods, ws, ws_connection);
	}
	
	Sender.prototype.registerWSEvent = registerWSEvent;
	Sender.prototype.setOperator = setOperator;
	module.exports = new Sender();
}());
