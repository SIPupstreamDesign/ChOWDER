import SelectList from "./select_list";

class CompareList extends EventEmitter {
    constructor(leftTitle,rightTitle){
        super();

        this.createDOM(leftTitle,rightTitle);
        this.data = {};

    }

    createDOM(leftTitle,rightTitle){
        this.dom = document.createElement('div');
        let frame = document.createElement('div');

        let uiArea = document.createElement('div');
        uiArea.classList.add("compare_list_ui_area");

        this.leftWrap = document.createElement('div');
        this.leftWrap.classList.add("compare_list_left_wrap");
        this.leftTitle = document.createElement('span');
        this.leftTitle.textContent = leftTitle;
        this.leftSelect = new SelectList();

        this.rightWrap = document.createElement('div');
        this.rightWrap.classList.add("compare_list_right_wrap");
        this.rightTitle = document.createElement('span');
        this.rightTitle.textContent = rightTitle;
        this.rightSelect = new SelectList();

        this.exchangeButton = this.exchangeButtonBuilder(()=>{
            this.exchangeItems();
        });

        this.applyButton = this.applyButtonBuilder(()=>{
            this.emit(CompareList.EVENT_APPLY,null,this.getData());
        });

        this.leftWrap.appendChild(this.leftTitle);
        this.leftWrap.appendChild(this.leftSelect.getDOM());
        this.rightWrap.appendChild(this.rightTitle);
        this.rightWrap.appendChild(this.rightSelect.getDOM());
        uiArea.appendChild(this.leftWrap);
        uiArea.appendChild(this.exchangeButton);
        uiArea.appendChild(this.rightWrap);

        frame.appendChild(uiArea);
        frame.appendChild(this.applyButton);
        this.dom.appendChild(frame);
    }

    convertStringToBoolean(object){
        // redisはboolを持てない
        for(let i in object){
            if(object[i] === "true"){
                object[i] = true;
            }
            if(object[i] === "false"){
                object[i] = false;
            }
        }
        return object;
    }

    convertBooleanToString(object){
        for(let i in object){
            if(object[i] === true){
                object[i] = "true";
            }
            if(object[i] === false){
                object[i] = "false";
            }
        }
        return object;
    }


    setData(object){
        let data = this.convertStringToBoolean(object)
        for(let i in data){
            if(data[i] === true){
                this.leftSelect.add(i,i);
            }else if(data[i] === false){
                this.rightSelect.add(i,i);
            }
        }
    }

    getData(){
        let result = {};
        let trueDisplays = this.leftSelect.getValues();
        for(let i in trueDisplays){
            result[trueDisplays[i]] = true;
        }
        let falseDisplays = this.rightSelect.getValues();
        for(let i in falseDisplays){
            result[falseDisplays[i]] = false;
        }
        result = this.convertBooleanToString(result);
        return result;
    }

    exchangeItems(){
        let leftValues = this.leftSelect.getValues();
        let leftSelected = this.leftSelect.getSelectedValues();

        let rightValues = this.rightSelect.getValues();
        let rightSelected = this.rightSelect.getSelectedValues();

        let resultLeft = [];
        for(let i of leftValues){
            if(!leftSelected.includes(i)){
                resultLeft.push(i)
            }
        }
        resultLeft = resultLeft.concat(rightSelected);

        let resultRight = [];
        for(let i of rightValues){
            if(!rightSelected.includes(i)){
                resultRight.push(i)
            }
        }
        resultRight = resultRight.concat(leftSelected);

        this.leftSelect.clear();
        this.rightSelect.clear();

        for(let i of resultLeft){
            this.leftSelect.add(i,i);
        }
        for(let i of resultRight){
            this.rightSelect.add(i,i);
        }
    }

    exchangeButtonBuilder(clickCallback){
        let buttonDOM = document.createElement("button");
        buttonDOM.classList.add("compare_list_exchange_button");
        buttonDOM.textContent = "<>";

        buttonDOM.addEventListener("click",clickCallback);
        return buttonDOM;
    }

    applyButtonBuilder(clickCallback){
        let buttonDOM = document.createElement("button");
        buttonDOM.classList.add("compare_list_apply_button");
        buttonDOM.textContent = "Apply";

        buttonDOM.addEventListener("click",clickCallback);
        return buttonDOM;
    }


    getDOM(){
        return this.dom;
    }
}
CompareList.EVENT_APPLY = "compare_list_event_apply";

export default CompareList;