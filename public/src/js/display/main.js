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
