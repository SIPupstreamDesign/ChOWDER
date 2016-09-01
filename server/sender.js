/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Sender = function () {},
		operator,
		ws_connector = require('./ws_connector.js'),
		io_connector = require('./io_connector.js'),
		metabinary = require('./metabinary.js'),
		Command = require('./command.js');
	
	/**
	 * オペレータ(operator.js)設定
	 * @method setOperator
	 * @param {Object} ope オペレータインスタンス
	 */
	function setOperator(ope) {
		operator = ope;
	}
	
	/**
	 * updateWindowMetaData処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateWindowMetaData
	 */
	function post_updateWindowMetaData(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateWindowMetaData, reply);
			io_connector.broadcast(io, Command.UpdateWindowMetaData, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * updateMetaData処理実行後のブロードキャスト用ラッパー.
	 * @method post_updateMetaData
	 */
	function post_updateMetaData(ws, io, resultCallback) {
		return function (err, reply) {
			ws_connector.broadcast(ws, Command.UpdateMetaData, reply);
			io_connector.broadcast(io, Command.UpdateMetaData, reply);
			if (resultCallback) {
				resultCallback(err, reply);
			}
		};
	}
	
	/**
	 * WebSocketイベント登録
	 * @method registerWSEvent
	 * @param {String} socketid ソケットID
	 * @param {Socket} ws_connection WebSocketコネクション
	 * @param {Socket} io socket.io オブジェクト
	 * @param {Socket} ws WebSocketServerオブジェクト
	 */
	function registerWSEvent(socketid, ws_connection, io, ws) {
		var methods = {};
		
		ws_connector.on(Command.GetMetaData, function (data, resultCallback) {
			operator.commandGetMetaData(data, resultCallback);
		});

		ws_connector.on(Command.GetContent, function (data, resultCallback) {
			operator.commandGetContent(data, resultCallback);
		});
		
		ws_connector.on(Command.GetWindowMetaData, function (data, resultCallback) {
			operator.commandGetWindowMetaData(socketid, data, resultCallback);
		});
		
		ws_connector.on(Command.AddWindowMetaData, function (data, resultCallback) {
			operator.commandAddWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.UpdateWindowMetaData, function (data, resultCallback) {
			operator.commandUpdateWindowMetaData(socketid, data, post_updateWindowMetaData(ws, io, resultCallback));
		});
		
		ws_connector.on(Command.UpdateMetaData, function (data, resultCallback) {
			operator.commandUpdateMetaData(socketid, data, post_updateMetaData(ws, io, resultCallback));
		});

		ws_connector.registerEvent(ws, ws_connection);
	}
	
	Sender.prototype.registerWSEvent = registerWSEvent;
	Sender.prototype.setOperator = setOperator;
	module.exports = new Sender();
}());
