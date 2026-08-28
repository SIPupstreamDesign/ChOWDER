/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

"use strict";

const DEFAULT_CONTROLLER_ID = "__default";

/**
 * cookie取得
 * @method getCookie
 * @param {String} key cookieIDキー
 * @return {String} cookie
 */
function getCookie (key) {
	let i,
		pos,
		cookies;
	if (document.cookie.length > 0) {
		// console.log("all cookie", document.cookie);
		cookies = [document.cookie];
		if (document.cookie.indexOf(';') >= 0) {
			cookies = document.cookie.split(';');
		}
		for (i = 0; i < cookies.length; i = i + 1) {
			pos = cookies[i].indexOf(key + "=");
			if (pos >= 0) {
				return unescape(cookies[i].substring(pos + key.length + 1));
			}
		}
	}
	return "";
}

class Cookie 
{
	constructor() {
		this.loginkey = {}
		this.language = 'en_US';
	}
	
	load() {
		this.getLoginKey();
		this.getLanguage();
	}
	
	/**
	 * cookie保存
	 * @method save
	 */
	save() {
		document.cookie = 'controller_id_to_session='+JSON.stringify(this.loginkey);
		document.cookie = 'controller_language='+String(this.language);
	}

	setLoginKey(controllerID, key) {
		this.load(); // 最初に全部読み込んでから対象のものだけ上書きする
		if (controllerID && controllerID.length > 0) {
			this.loginkey[controllerID] = key;
		} else {
			this.loginkey[DEFAULT_CONTROLLER_ID] = key;
		}
		this.save();
	}

	getLoginKey(controllerID, withoutLoad) {
		let key = controllerID;
		if (!controllerID || controllerID.length === 0) {
			key = DEFAULT_CONTROLLER_ID
		}
		if (!withoutLoad) {
			try {
				this.loginkey = JSON.parse(getCookie("controller_id_to_session"));
			} catch (e) {
				this.loginkey = {};
			}
		}
		
		if (this.loginkey.hasOwnProperty(key)) {
			return this.loginkey[key];
		} else {
			return "not found"
		}
	}
	
	setLanguage(lang) {
		this.load(); // 最初に全部読み込んでから対象のものだけ上書きする
		this.language = lang;
		this.save();
	}
	
	getLanguage() {
		let lang = getCookie("controller_language");
		if (lang) {
			this.language = lang;
		}
		return this.language;
	}
}

export default new Cookie;
