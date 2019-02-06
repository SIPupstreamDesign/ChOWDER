/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import Action from './action';
import GUI from './gui';
import Store from './store/store';
import Display from './display';

const action = new Action();
const store = new Store(action);
const gui = new GUI(store, action);
const display = new Display(store, action, gui);

window.onload = () => {
	action.connect();
	gui.init();
}
window.onunload = () => {
	store.release();
}
