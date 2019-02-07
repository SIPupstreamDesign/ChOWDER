/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Constants from '../../common/constants.js';
import Store from './store';
import Action from '../action';
import Validator from '../../common/validator';

"use strict";


class ManipulatorStore {
	constructor(connector, state, store, action, cookie) {
        this.connector = connector;
        this.state = state;
        this.store = store;
		this.action = action;

		this.initEvents();
    }

	initEvents() {
		for (let i in Action) {
			if (i.indexOf('EVENT') >= 0) {
				this.action.on(Action[i], ((method) => {
					return (err, data) => {
						if (this[method]) {
							this[method](data);
						}
					};
				})('_' + Action[i]));
			}
		}
	};
    
	/**
	 * マニピュレータにマウスダウンした
	 */
    _changeManipulatorMouseDownPos(data) {
        this.store.getState().setMousedownPos([
			data.x,
			data.y
        ]);
    }

	/**
	 * マニピュレータの星がトグルされた
	 */
    _toggleManipulatorStar(data) {
        let isActive = data.isActive;
		let id = this.store.getState().getSelectedID();
		if (this.store.hasMetadata(id)) {
			let metaData = this.store.getMetaData(id);
            metaData.mark = isActive;
            this.store.operation.updateMetadata(metaData);
		}
    }
    
	/**
	 * マニピュレータのmemoがトグルされた
	 */
    _toggleManipulatorMemo(data) {
        let isActive = data.isActive;
        let id = this.store.getState().getSelectedID();
		if (this.store.hasMetadata(id)) {
			let metaData = this.store.getMetaData(id);
			if (Validator.isWindowType(metaData)) {
				//gui.toggle_display_id_show(false);
			} else {
				metaData.mark_memo = isActive;
                this.store.operation.updateMetadata(metaData);
			}
		}
    }

	/**
	 * マニピュレータ: pdfページ送り
	 */
    _movePDFPageOnManipulator(data) {
        let id = data.id;
        let delta = data.delta;
		let callback = Store.extractCallback(data);
        
		let metaData = this.store.getMetaData(id);
		let page = metaData.pdfPage ? parseInt(metaData.pdfPage) : 1;
		page = Math.min(Math.max(page + delta, 1), parseInt(metaData.pdfNumPages));
		metaData.pdfPage = page;
		this.store.operation.updateMetadata(metaData, () => {
            if (callback) { callback(page); }
        });
    }

	/**
	 * マニピュレータ: 動画再生
	 */
    _playVideoOnManipulator(data) {
        let id = data.id;
        let play = data.id;
        this.store.operation.sendMessage({ids: [id], command: 'playVideo', play: play});
    }
}

export default ManipulatorStore;