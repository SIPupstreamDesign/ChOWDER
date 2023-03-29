/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Action from './action';
import GUI from './gui/gui';
import Store from './store/store';
import ContentHandler from './content_handler';

const action = new Action();
const store = new Store(action);
const gui = new GUI(store, action);
const content_handler = new ContentHandler(store, action, gui);

window.addEventListener('load', async() => {
	action.connect();
	await gui.init();
});
window.onunload = () => {
	store.release();
}
