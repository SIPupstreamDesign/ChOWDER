/**
 * Copyright (c) 2021 National Institute of Information and Communications Technology (NICT). All rights reserved.
 */

 import Action from './action';
 import GUI from './gui';
 import Store from './store';
 
 const action = new Action();
 const store = new Store(action);
 const gui = new GUI(store, action);
 
 window.addEventListener('load', () => {
     console.log("[main]:load")
     action.connect();
     gui.init();
 });
 window.onunload = () => {
     store.release();
 };
 