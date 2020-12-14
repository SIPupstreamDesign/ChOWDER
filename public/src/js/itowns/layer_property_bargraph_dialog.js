
import Store from "./store.js";
import PopupBackground from "../components/popup_background";
import Input from "../components/input";
import Button from "../components/button"

class LayerPropertyBargraphDialog extends EventEmitter {
    constructor(store, action, title) {
        super();

        this.store = store;
        this.action = action;
        this.setting = {};

		this.init(title);
	}
	
    init(title) {
        this.dom = document.createElement('div');
        this.dom.className = "layer_dialog";

        this.wrap = document.createElement('div');
        this.wrap.className = "layer_dialog_wrap";

        this.title = document.createElement('p');
        this.title.className = "layer_dialog_title";
		this.wrap.appendChild(this.title);
		
        this.exprInput = document.createElement('textarea');
        this.exprInput.className = "layer_dialog_url_input";
        this.exprInput.value = "expr"
		this.wrap.appendChild(this.exprInput);

        this.endCallback = null;
        this.createPopupBackground();
        
        this.dom.appendChild(this.wrap);
	}

    createPopupBackground() {
        this.okButton = new Button();
        this.okButton.setDataKey("OK");
        this.okButton.getDOM().className = "layer_dialog_ok_button btn btn-primary";
        this.dom.appendChild(this.okButton.getDOM());

        this.cancelButton = new Button();
        this.cancelButton.setDataKey("Cancel");
        this.cancelButton.getDOM().className = "layer_dialog_cancel_button btn btn-light";
        this.dom.appendChild(this.cancelButton.getDOM());

        let isOK = false;
        this.background = new PopupBackground();
        this.background.on('close', () => {
            if (this.endCallback) {
                this.endCallback(isOK, this.exprInput.value);
                this.endCallback = null;
            }
            this.close();
		});
        this.okButton.on('click', () => {
            isOK = true;
            this.background.close();
        });

        this.cancelButton.on('click', () => {
            isOK = false;
            this.background.close();
        });
	}

    close() {
        this.dom.style.display = "none";
    }

    show(title, initialExpr, endCallback) {
        this.title.innerText = i18next.t(title);
        this.exprInput.value = initialExpr;
        // this.idInput.setValue("Layer_" + Math.floor(Math.random() * 100));

        this.endCallback = endCallback;
        this.dom.style.display = "block";
        this.background.show(this.setting.opacity, this.setting.zIndex);
    }

    getDOM() {
        return this.dom;
    }
}
export default LayerPropertyBargraphDialog;