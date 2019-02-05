import Controller from './controller'
import State from './state'
import Action from './action';
import GUI from './gui/gui';
import Store from './store/store';
import cookie from './cookie.js';

const state = new State();
const action = new Action();
const store = new Store(state, action, cookie);
const gui = new GUI(store, action);

const controller = new Controller(store, action, gui);

window.onload = () => { action.connect(); }
window.onunload = () => {
	gui.clearContentProperty(true);
	controller.release();
	store.release();
};
window.onblur = () => {
	//gui.clearContentProperty(true);
	state.setCtrlDown(false);
	state.setShiftDown(false);
	state.setSpaceDown(false);
};
window.onkeydown = (evt) => {
	if (evt.keyCode === 17) {
		state.setCtrlDown(true);
	}
	if (evt.keyCode === 16) {
		state.setShiftDown(true);
	}
	if (evt.keyCode === 32) {
		state.setSpaceDown(true);
	}
	if (evt.keyCode === 37) { // ←
		let history_up = document.getElementById('history_up');
		if (history_up && history_up.style.display !== "none") {
			history_up.click();
		}
	}
	if (evt.keyCode === 39) {
		let history_down  = document.getElementById('history_down');
		if (history_down && history_down.style.display !== "none") {
			history_down.click();
		}
	}
};
window.onkeyup = (evt) => {
	if (evt.keyCode === 17) {
		state.setCtrlDown(false);
	}
	if (evt.keyCode === 16) {
		state.setShiftDown(false);
	}
	if (evt.keyCode === 32) {
		state.setSpaceDown(false);
	}
};
