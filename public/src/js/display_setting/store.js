/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
import Action from './action'
import Connector from '../common/ws_connector.js';
import Command from '../common/command';

class Store extends EventEmitter {
    constructor(action) {
        super();
        this.action = action;
        this.displayIndexes = [{ trueIndex: 0, scannedIndex: 0 }];

        this.isInitialized_ = false;
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

    // デバッグ用. release版作るときは消す
    emit() {
        if (arguments.length > 0) {
            if (!arguments[0]) {
                console.error("Not found EVENT NAME!", arguments[0])
            }
        }
        super.emit(...arguments);
    }

    _connect() {
        console.log("_connect")
        let isDisconnect = false;
        let client = Connector.connect(() => {
            if (!this.isInitialized_) {
                //this.initOtherStores(() => {
                this.emit(Store.EVENT_CONNECT_SUCCESS, null);
                //});
            } else {
                this.emit(Store.EVENT_CONNECT_SUCCESS, null);
            }
        }, (() => {
            return (ev) => {
                this.emit(Store.EVENT_CONNECT_FAILED, null);

                if (!isDisconnect) {
                    setTimeout(() => {
                        this._connect();
                    }, reconnectTimeout);
                }
            };
        })());

        Connector.on("Disconnect", ((client) => {
            return () => {
                isDisconnect = true;
                client.close();
                this.emit(Store.EVENT_DISCONNECTED, null);
            };
        })(client));
    }

    _getVirtualDisplay() {
        Connector.send(Command.GetVirtualDisplay, {}, (err, reply) => {
            this.virtualDisplay = reply;
            this.emit(Store.EVENT_DONE_GET_VIRTUAL_DISPLAY, err, reply);//GUIにイベントを投げる
        });
    }

    _setDisplayIndexes(data) {
        //console.log(this.displayIndexes)
        this.displayIndexes.push([data["trueIndex"], data["scannedIndex"]]);
//        return this.displayIndexes;
        this.emit(Store.EVENT_DONE_SET_DISPLAY_INDEXES, null, this.displayIndexes);
        /* Connector.send(Command.SetDisplayIndexes,this.displayIndexes , (err, reply) => {
         });*/
    }

}

Store.EVENT_DISCONNECTED = "disconnected";
Store.EVENT_CONNECT_SUCCESS = "connect_success";
Store.EVENT_CONNECT_FAILED = "connect_failed";
Store.EVENT_DONE_GET_VIRTUAL_DISPLAY = "get_virtual_display";
Store.EVENT_DONE_SET_DISPLAY_INDEXES = "set_display_indexes";
export default Store;