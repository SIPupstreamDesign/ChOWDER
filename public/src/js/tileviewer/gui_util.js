import Input from "../components/input"
import LayerList from './layer_list'


/**
 * Propertyタブに入力プロパティを追加する
 * @method addCheckProperty
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addCheckProperty(parent, isEditable, className, leftLabel, value, changeCallback) {
    /*
    	<div class="input-group">
    		<span class="input-group-addon">x</span>
    		<input type="text" class="form-control" id="content_transform_x" value="0">
    		<span class="input-group-addon">px</span>
    	</div>
    */
    let group = document.createElement('div');
    let leftSpan = document.createElement('span');
    leftSpan.className = "input-group-addon content_property_checkbox_label";
    let centerSpan = document.createElement('span');
    let input = new Input("checkbox");
    group.className = "input-group";
    leftSpan.innerHTML = leftLabel;
    centerSpan.className = "input-group-addon content_property_checkbox_wrap"
    input.setValue(value);
    input.getDOM().disabled = !isEditable;
    input.getDOM().className = "content_property_checkbox " + className

    centerSpan.appendChild(input.getDOM());
    group.appendChild(leftSpan);
    group.appendChild(centerSpan);
    parent.appendChild(group);

    input.on(Input.EVENT_CHANGE, (err, data) => {
        changeCallback(err, data.target.checked);
    });
}

/**
 * Propertyタブに入力プロパティを追加する
 * @method addInputProperty
 * @param {String} leftLabel 左ラベル
 * @param {String} rightLabel 右ラベル
 * @param {String} value 初期入力値
 */
function addTextAreaProperty(parentElem, isEditable, leftLabel, rightLabel, value, changeCallback) {
    /*
    	<div class="input-group">
    		<span class="input-group-addon">x</span>
    		<input type="text" class="form-control" id="content_transform_x" value="0">
    		<span class="input-group-addon">px</span>
    	</div>
    */
    let group = document.createElement('div');
    let leftSpan = document.createElement('span');
    let rightSpan = document.createElement('span');
    let input = document.createElement('textarea');
    input.style.maxWidth = "215px"
    input.style.width = "215px"
    input.style.height = "auto"

    group.className = "input-group";
    group.style.margin = "0px";
    group.style.marginLeft = "5px";
    group.style.marginBottom = "5px";
    group.style.paddingBottom = "5px";
    leftSpan.className = "input-group-addon";
    leftSpan.innerHTML = leftLabel;
    rightSpan.className = "input-group-addon";
    rightSpan.innerHTML = rightLabel;
    input.className = "form-control";
    input.value = value;
    input.disabled = !isEditable;

    //group.appendChild(leftSpan);
    group.appendChild(input);
    if (rightLabel) {
        group.appendChild(rightSpan);
    }
    parentElem.appendChild(group);

    input.onchange = (evt) => {
        try {
            changeCallback(null, evt.target.value);
        } catch (ex) {
            console.error(ex);
            changeCallback(err, evt.target.value);
        }
    };
}
export default {
    addCheckProperty: addCheckProperty,
    addTextAreaProperty: addTextAreaProperty,
};