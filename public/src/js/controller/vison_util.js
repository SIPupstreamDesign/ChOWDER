
import State from './state'
import Action from './action';
import GUI from './gui/gui';
import Store from './store/store';
import cookie from './cookie.js';

const state = new State();
const action = new Action();
const store = new Store(state, action, cookie);
const gui = new GUI(store, action);

const getUrlList = [];

window.sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

window.onload = async() => {     
    await action.connect();

    store.on(Store.EVENT_DONE_GET_METADATA, (err, reply, endCallback) => {
        let json = reply;
        let metaData = json;
        if(metaData.type == "url"){
            console.log(JSON.parse(metaData.user_data_text).text);
            getUrlList.push(JSON.parse(metaData.user_data_text).text);
        }
    });

    await sleep(500);

    let data ={};

    action.login({
        userid : "APIuser",
        password : "apiuser"
    });

    //store.getControllerData().set(data.controllerData);

    action.reloadAll({
                callback: (data) => {             
                    console.log("access vision pro page..");
 
                    // getUrlList  の配列の中に、表示すべきURLリストが入ってくる

                }
            }
        );

}
