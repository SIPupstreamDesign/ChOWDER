/* global Promise */
'use strict';

var WebSocketClient = require('websocket').client;

var metabinary = require('./metabinary.js');

/**
 * 簡易WebSocketラッパー
 */
var WebSocketWrapper = function() {
	/**
	 * @type {WebSocket.client}
	 */
	this.client = new WebSocketClient();

	/**
	 * @type {WebSocket.connection}
	 */
	this.connection = null;

	/**
	 * メッセージIDをkeyとして、コールバック関数を格納するObject
	 * @type {Object<number,Function>}
	 */
	this.resResolves = {};

	/**
	 * メッセージを送るたびに増加させる。コールバックを受け取る際に必要
	 * @type {number}
	 */
	this.id = 1;
};

/**
 * WebSocketサーバに接続を行う
 * @returns {Promise<void>} 接続完了後、resolve
 */
WebSocketWrapper.prototype.connect = function(url) {
	return new Promise(function(resolve) {
		this.client.on('connect', function(connection) {
			this.connection = connection;
			
			connection.on('error', function(error) {
				throw new Error('Connection error: ' + error.toString());
			});
			
			connection.on('close', function () {
				console.log('Connection has been closed');
			});

			connection.on('message', function(message) {
				if (message.type === 'utf8') {
					var parsed = JSON.parse(message.utf8Data);
					if (this.resResolves[parsed.id] && parsed.method !== 'Update') {
						this.resResolves[parsed.id](parsed);
					}
				} else { // binary
					var data = message.binaryData;
					metabinary.loadMetaBinary(data, function (parsed, contentData) {
						if (this.resResolves[parsed.id]) {
							this.resResolves[parsed.id]({
								metadata: parsed,
								buffer: contentData
							});
						}
					});
				}
			}.bind(this));

			resolve();
		}.bind(this));
		this.client.connect(url);
	}.bind(this));
};

/**
 * WebSocketサーバとの接続を終了する
 */
WebSocketWrapper.prototype.disconnect = function() {
	if (!(this.connection && this.connection.connected)) {
		throw new Error('Connection is not established yet');
	}

	this.connection.close();
};

/**
 * バイナリメッセージを送信する
 * @param {string} method JSONRPCメソッド
 * @param {Object} params パラメータ
 * @param {Buffer} buffer バイナリ
 * @returns {Promise.<Object>} サーバから返信が帰ってきたらresolve
 */
WebSocketWrapper.prototype.sendBinary = function(method, params, buffer) {
	if (!(this.connection && this.connection.connected)) {
		throw new Error('Connection is not established yet');
	}

	return new Promise(function(resolve) {
		var json = {
			jsonrpc: '2.0',
			id: this.id,
			method: method,
			to: 'master',
			params: params
		};
		this.resResolves[this.id] = resolve;

		var content = metabinary.createMetaBinary(json, buffer);
		this.connection.sendBytes(content);

		this.id ++;
	}.bind(this));
};

/**
 * UTFメッセージを送信する
 * @param {string} method JSONRPCメソッド
 * @param {Object} params パラメータ
 * @returns {Promise.<Object>} サーバから返信が帰ってきたらresolve
 */
WebSocketWrapper.prototype.sendUTF = function(method, params) {
	if (!(this.connection && this.connection.connected)) {
		throw new Error('Connection is not established yet');
	}

	return new Promise(function(resolve) {
		var json = {
			jsonrpc: '2.0',
			id: this.id,
			method: method,
			to: 'master',
			params: params
		};
		this.resResolves[this.id] = resolve;

		this.connection.sendUTF(JSON.stringify(json));

		this.id ++;
	}.bind(this));
};

module.exports = WebSocketWrapper;