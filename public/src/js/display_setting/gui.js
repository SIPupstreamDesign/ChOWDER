/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

import Store from './store';
import Menu from '../components/menu';
import LoginMenu from '../components/login_menu';
import Select from '../components/select';
import Button from '../components/button.js';
import Translation from '../common/translation';

function getBaseURL() {
    let baseURL;
    if (window.location.href.indexOf('https') >= 0) {
        baseURL = "https://" + window.location.hostname + ":" + window.location.port;
    } else {
        baseURL = "http://" + window.location.hostname + ":" + window.location.port;
    }
    return baseURL;
}

class GUI extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;


        this.scannedData = [];
        // setIntervalのハンドルリスト
        this.scanIntervalHandle = [];
        this.scanFlagList = [];
        this.displayNumber = 0;
        this.displayNumberX = 0;
        this.displayNumberY = 0;

        // ページの状態
        this.pageState = GUI.STATE_START;

    }

    init() {
        this.dom = document.getElementById('gui');

        // ARjsのカメラ初期化イベントらしい
        window.addEventListener('arjs-video-loaded', (data) => {
            // 初期化完了後, ログイン完了するまで非表示にしておく
            document.getElementById('arjs-video').style.display = "none";
        })

        // ログイン完了するまで非表示にしておく
        this.dom.style.display = "none"

        this.initLoginMenu();
        this.initScanButton();
        this.initSendButton();
        this.initAdjustmentButton();
        this.initCompleteButton();
        this.updateDescription("準備ができたら[スキャン開始]ボタンを押してください");
        this.initScanStartButtonPopUp();
        this.initSiteSelect();
        Translation.translate(function () { });

        this.store.on(Store.EVENT_CONNECT_SUCCESS, () => {
            console.log("CONNECT_SUCCESS");
        });

        this.store.on(Store.EVENT_CLOSE_ELECTRON, (err, reply) => {
            console.log("close");
        });

        this.store.on(Store.EVENT_DONE_GET_DATA_LIST, (err, reply) => {
            this.updateScanStatusText(reply);
        });

        this.store.on(Store.EVENT_DONE_STORE_SCANNED_DATA, (err, reply) => {
            console.log("store");
        });

        this.store.on(Store.EVENT_DONE_SET_DATA_LIST, (err, reply) => {
            if (!err) {
                this.pageState = GUI.STATE_COMPLETE;
                this.changeGUIToComplete(reply);
                this.action.getDataList();
            } else {
                console.error(err);
            }
        });
        this.store.on(Store.EVENT_DONE_SEND_DATA, (err, reply) => {
            console.log("send");
        });
        this.store.on(Store.EVENT_DELETE_DATA_LIST, (err, reply) => {
            console.log("delete");
        });
        this.store.on(Store.EVENT_START_SCAN, (err, markerList) => {
            //this.setScanStartButtonPopUp(err);
            if (!err) {
                this.changeGUIToScanning();

                let vd = this.store.getVirtualDisplay();
                this.displayNumber = vd.splitX * vd.splitY;
                this.displayNumberX = vd.splitX;
                this.displayNumberY = vd.splitY;

                this.scanIntervalHandle.push(
                    setInterval((flag) => {
                        for (let i = 0; i < this.displayNumber; i++) {
                            let marker = document.getElementsByTagName("a-marker")[i + 1];
                            this.scannedData[i] = [marker.id, this.scanFlagList[marker.id], marker.object3D.position];
                        }

                        console.log(this.scannedData);
                        console.log(this.scanFlagList);
                        let sendData = this.scannedData;
                        console.log(sendData);
                        this.action.storeScannedData(sendData);
                        this.action.getDataList();
                    }, 100, this.scanFlagList));
                console.log(markerList);

                this.setArMarkerImg(markerList);
                this.showSendButton(false);
                this.showAjustmentButton(false);
                this.showDescription(false);
            } else {
                // エラーダイアログを出す
                document.getElementById('start_popup').classList.toggle('is_show');
                console.error(err);
            }
        });

        this.store.on(Store.EVENT_ADJUSTMENT_EVENT, (err, reply) => {
            console.log("ADJUSTMENT");
        });

        //スキャン開始完了ボタン
        this.scanToggleButton.on('click', () => {
            if (this.pageState === GUI.STATE_START ||
                this.pageState === GUI.STATE_COMPLETE) {

                // スキャン開始 または 再スキャン.
                // GUIはEVENT_START_SCANを受け取った後切り替える.
                console.log("Scanning..")

                this.action.deleteDataList();
                this.action.getVirtualDisplay();
                this.action.startScan();
            }
            else if (this.pageState === GUI.STATE_SCANNING) {
                // スキャン完了
                // GUIはEVENT_DONE_SET_DATA_LISTを受け取った後切り替える.
                console.log("Scan Complete")

                this.clearScanInterval();
                this.action.setDataList();
                this.action.getDataList();
            }
        });
        
        // ログイン成功
        this.store.on(Store.EVENT_LOGIN_SUCCESS, (err, data) => {
            // ログインメニューを削除
            document.body.removeChild(this.loginMenu.getDOM());
            this.changeGUIToStart();
        });

        // ログイン失敗
        this.store.on(Store.EVENT_LOGIN_FAILED, (err, data) => {
            this.loginMenu.showInvalidLabel(true);
        });

        // ディスプレイリスト取得
        this.store.on(Store.EVENT_DONE_GET_DISPLAY_LIST, (err, data) => {
            this.updateSiteSelect(data);
        });
    }

    /// ログインメニューの初期化
    initLoginMenu() {
        this.loginMenu = new LoginMenu("ChOWDER DisplaySetting");
        this.loginMenu.getDOM().style.zIndex = 20000000;
        document.body.insertBefore(this.loginMenu.getDOM(), document.body.childNodes[0]);
        
        this.loginMenu.show(true);

        // ログインが実行された場合
        this.loginMenu.on(LoginMenu.EVENT_LOGIN, () => {
            let userSelect = this.loginMenu.getUserSelect();
            // ログイン実行
            this.action.login({
                id: "APIUser",
                password: this.loginMenu.getPassword()
            });
        });

        let select = this.loginMenu.getUserSelect();
        select.addOption("APIUser", "APIUser");
    }

    /// ログイン時のディスプレイsite選択ボックスの初期化
    initSiteSelect() {
        let wrapDom = document.createElement('div');
        wrapDom.innerHTML = "DisplaySite :"
        this.siteSelect = new Select();
        this.siteSelect.getDOM().className = "site_select";
        this.siteSelect.addOption("group_default", "default");

        wrapDom.appendChild(this.siteSelect.getDOM())

        document.getElementsByClassName('loginframe')[0].appendChild(wrapDom);
    }

    /**
     * ログイン時のディスプレイsite選択ボックスの更新
     * @param siteList ディスプレイsiteのリスト 
     */ 
    updateSiteSelect(siteList) {
        this.siteSelect.clear();
        for (let i = 0; i < siteList.length; ++i) {
            this.siteSelect.addOption(siteList[i].id, siteList[i].name);
        }
    }

    /// スキャンIntervalのクリア
    clearScanInterval() {
        console.log("clearScanInterval", this.scanIntervalHandle);
        for (let i in this.scanIntervalHandle) {
            clearInterval(this.scanIntervalHandle[i]);
        }
        this.scanIntervalHandle = [];
    }

    /// GUIをスキャン開始ページの状態に切り替える
    changeGUIToStart() {
        // 動画, GUI表示
        document.getElementById('arjs-video').style.display = "block";
        this.dom.style.display = "block";

        // メニュー表示
        let menuSetting = [];
        this.headMenu = new Menu("display_setting", menuSetting);
        document.getElementsByClassName('head_menu')[0].appendChild(this.headMenu.getDOM());
    }

    /// GUIをスキャン中の状態に切り替える
    changeGUIToScanning() {
        this.pageState = GUI.STATE_SCANNING;
        // スキャンボタンの名前を変更
        this.scanToggleButton.getDOM().value = "スキャン完了";
    }

    /// GUIをスキャン完了状態に切り替える
    changeGUIToComplete(reply) {
        const hasScanData = Object.keys(reply).length > 0;

        this.pageState = GUI.STATE_COMPLETE;

        // 説明文を表示
        this.showDescription(true);

        // 調整モードボタンを表示
        this.showAjustmentButton(true);

        // 設定完了ボタンを表示
        this.showCompleteButton(hasScanData);

        // データ送信ボタンを表示
        this.showSendButton(hasScanData);

        // スキャンボタンの名前を変更
        this.scanToggleButton.getDOM().value = "再スキャン";

        if (hasScanData) {
            this.updateDescription("検出されたマーカーIDの並び順が正しければ、[データ送信]ボタンを押してください。スキャンし直す場合は、もう一度カメラをDisplayに向けて[再スキャン]ボタンを押してください。");
        } else {
            this.updateDescription("マーカーIDが検出されていません。もう一度カメラをDisplayに向けて[再スキャン]ボタンを押してください。");
        }

        this.updateVirtualScreen(reply);
    }

    /// データ送信ボタンを表示
    showSendButton(isShow) {
        let elem = document.getElementById("send_button");
        if (elem) {
            elem.style.display = isShow ? "block" : "none";
        }
    }

    /// 調整モードボタンを表示
    showAjustmentButton(isShow) {
        let elem = document.getElementById("adjustment_button");
        if (elem) {
            elem.style.display = isShow ? "block" : "none";
        }
    }

    /// 設定完了ボタンを表示
    showCompleteButton(isShow) {
        let elem = document.getElementById("complete_button");
        if (elem) {
            elem.style.display = isShow ? "block" : "none";
        }
    }

    /// 説明文のを表示
    showDescription(isShow) {
        let elem = document.getElementById("text");
        if (elem) {
            elem.style.display = isShow ? "block" : "none";
        }
    }

    /// 説明文の更新
    updateDescription(text) {
        document.getElementById("text").innerHTML = text;
    }

    closePopUp(elem, popUp) {
        console.log(elem);
        if (!elem) return;
        elem.onclick = () => {
            popUp.classList.toggle('is_show');
        };
    }

    /// スキャン開始ボタンを押したときの警告用ポップアップの初期化
    initScanStartButtonPopUp() {
        let popup = document.getElementById('start_popup');
        if (!popup) return;

        let blackBg = document.getElementById('start_black_bg');
        let closeBtn = document.getElementById('start_close_btn');

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
    }

    /// 検出されたマーカーを表示
    updateScanStatusText(data) {
        console.log("updateScanStatusText", data);
        let pointSum = {};
        for (let i in data) {
            let point = [data[i].upPoint, data[i].downPoint, data[i].rightPoint, data[i].leftPoint]
            console.log("point[j]", point)
            for (let j in point) {
                for (let k in point[j]) {
                    if (point[j][k] !== -1) {
                        if (pointSum[k]) {
                            pointSum[k] += point[j][k];
                        }
                        else {
                            pointSum[k] = point[j][k];
                        }
                    }
                }
            }
        }

        let text = "検出されたマーカ:"
        let count = 0;
        for (let i in pointSum) {
            if (pointSum[i] > 30) {
                text += i + ",";
                count++;
            }
        }
        console.log(text)
        document.getElementById("scanned_markerID").innerHTML = text;
        document.getElementById("scanned_markerID_number").innerHTML = count + "/" + this.displayNumber;
    }

    /// 検出済マーカーの枠を更新(スキャン完了後に出る)
    updateVirtualScreen(reply) {
        console.log("updateVirtualScreen", reply);
        let ids = []
        for (let i in reply) {
            ids.push(i);
        }
        console.log(ids);
        let text = ""
        for (let i in ids) {
            text += "<option>" + ids[i] + "</option>"
        }
        document.getElementById("marker_id_1").innerHTML = text;
        document.getElementById("marker_id_2").innerHTML = text;

        let screen = document.getElementById("screen");
        const replyLength = Object.keys(reply).length;
        const width = 50;
        const height = 50;

        for (let i in reply) {
            //const column = Math.ceil((i + 1) / replyLength); NaN!
            //const line = Math.ceil(i + 1 - (column - 1) * replyLength); NaN!
            const unitWidth = 100 / this.displayNumberX;
            const unitHeight = 100 / this.displayNumberY;
            const translateX = this.displayNumberX * (reply[i].relativeCoord[0]) * unitWidth - this.displayNumberX * width;
            const translateY = this.displayNumberY * height - this.displayNumberY * (reply[i].relativeCoord[1] + 1) * unitHeight;//height / 2 - (reply[i].relativeCoord[1] + 1) * unitHeight;

            let newVirtualDisplay = document.createElement("div");
            newVirtualDisplay.className = "whole_sub_window"
            //newVirtualDisplay.id = "whole_sub_window:" + column + ":" + line;
            newVirtualDisplay.style.width = unitWidth + "%";
            newVirtualDisplay.style.height = unitHeight + "%";
            newVirtualDisplay.style.transform = "translate(" + translateX + "%," + translateY + "%)";
            newVirtualDisplay.innerHTML = String(i);
            screen.appendChild(newVirtualDisplay);
        }
    }

    /// スキャン開始/完了ボタンの初期化
    initScanButton() {
        this.scanToggleButton = new Button();
        this.scanToggleButton.getDOM().value = 'スキャン開始';
        this.scanToggleButton.getDOM().className = "scan_toggle_button btn btn-primary"
        this.dom.appendChild(this.scanToggleButton.getDOM());
    }

    /// データ送信ボタンの初期化
    initSendButton() {
        this.sendButton = new Button();
        let btn = this.sendButton.getDOM();
        this.dom.appendChild(btn);
        btn.id = "send_button";
        btn.className = "send_button btn btn-primary";
        btn.value = "データ送信";

        this.sendButton.on(Button.EVENT_CLICK, (evt) => {
            this.action.sendData();
            this.updateDescription("Displayに表示されているマーカーIDの並び順がただしければ、設定完了ボタンを押してください。検出されたマーカーIDの並び順が正しければ、[データ送信]ボタンを押してください。スキャンし直す場合は、もう一度カメラをDisplayに向けて[再スキャン]ボタンを押してください。");
        });
    }

    /// 完了ボタン押したときに出るボタンとダイアログの初期化
    initCompleteButton() {
        this.completeButton = new Button;
        let btn = this.completeButton.getDOM();
        this.dom.appendChild(btn);
        btn.id = "complete_button";
        btn.className = "complete_button btn btn-primary";
        btn.value = "設定完了";

        let popup = document.getElementById('popup');
        if (!popup) {
            conosle.error("not found popup");
            return;
        }

        let blackBg = document.getElementById('black_bg');
        let closeBtn = document.getElementById('close_btn');
        let popNo = document.getElementById("pop_no");

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
        this.closePopUp(popNo, popup);

        let popYes = document.getElementById("pop_yes");
        console.log(popYes);
        popYes.onclick = () => {
            console.log(this);
            this.action.closeElectron("a");
            console.log("yes")
            window.location.href = getBaseURL();
        };
    }

    /// 調整モードボタンとダイアログの初期化
    initAdjustmentButton() {
        this.adjustmentButton = new Button;
        let btn = this.adjustmentButton.getDOM();
        this.dom.appendChild(btn);
        btn.id = "adjustment_button";
        btn.className = "adjustment_button btn btn-primary";
        btn.value = "調整モード";

        let popup = document.getElementById('adjustment_popup');
        if (!popup) return;

        let blackBg = document.getElementById('adjustment_black_bg');
        let closeBtn = document.getElementById('adjustment_close_btn');

        this.closePopUp(blackBg, popup);
        this.closePopUp(closeBtn, popup);
        this.closePopUp(btn, popup);

        let send = document.getElementById('pop_send');
        let marker1 = document.getElementById('exchange_marker');
        let marker2 = document.getElementById('marker_id_2');

        send.onclick = () => {
            let index1 = marker1.selectedIndex;
            let markerId1 = marker1.options[index1].value;
            let index2 = marker2.selectedIndex;
            let markerId2 = marker2.options[index2].value;
            console.log(markerId1);
            console.log(markerId2);
            let sendData = ["Adjustment event occuured", markerId1, markerId2]
            this.action.adjustmentEvent(sendData)
        }
    }

    /**
     *  マーカーリストを元にARjsにマーカーを設定
     * これを行うことで検出可能になる
     */
    setArMarkerImg(markerList) {
        let arEntry = document.getElementById("ar_entry");
        let cameraElem = document.getElementById("camera");
        let baseURL;
        for (let i = 1; i <= this.displayNumber; i++) {
            // 一度作ったマーカーを消すと同じマーカーが再登録できないようなので
            // 前回作ったものは消さず、新規に検出したディスプレイを追加していく
            const marker = markerList[i - 1];
            if (!document.getElementById(marker)) {
                // HTML標準タグではないのでsetAttributeする必要がある
                let newMarker = document.createElement("a-marker");
                newMarker.setAttribute("id", marker);
                newMarker.className = "display_setting_marker"
                newMarker.addEventListener("markerFound", (evt) => {
                    this.scanFlagList[marker] = 1;
                    console.log("ar_marker" + marker + "found")
                });
                newMarker.addEventListener("markerLost", (evt) => {
                    this.scanFlagList[marker] = 0;
                    console.log("ar_marker" + marker + "lost");
                });
                newMarker.setAttribute("preset", "custom");
                newMarker.setAttribute("type", "pattern");
                newMarker.setAttribute("Url", getBaseURL() + "/src/image/markers/marker" + marker + ".patt");
                let boxModelOrigin = document.getElementsByClassName("hiro_marker_text");
                console.log("boxModelOrigin", boxModelOrigin)
                let boxModelClone = boxModelOrigin[0].cloneNode(true);
                boxModelClone.setAttribute("value", "Marker" + String(marker));
                arEntry.insertBefore(newMarker, cameraElem);
                newMarker.appendChild(boxModelClone);
            }
        }
    }
}

GUI.STATE_START = "start";
GUI.STATE_SCANNING = "scanning";
GUI.STATE_COMPLETE = "complete";

export default GUI;