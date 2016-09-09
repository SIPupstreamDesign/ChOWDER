/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var SearchBox;

	SearchBox = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.item_area = null;
		this.init();

		// 検索ボックスに入力されたときのイベント
		this.on_input_changed = null;

        // チェックされているグループリスト
        this.check_groups = [];
	};

    SearchBox.prototype.gen_search_tab_box = function (){
        var d, e, f, g, h, i, j,
            text_input,
            group_div,
            checkbox,
            box = this.container;

        // 既に該当 ID が存在する場合は一度 DOM を削除して再生成する
        e = document.getElementById('search_tab_box_wrapper');
        if(e){
            e.parentNode.removeChild(e);
            e = null;
        }
        // タブの中の要素全体を包むラッパー
        e = document.createElement('div');
        e.id = 'search_tab_box_wrapper';
		e.className = "search_tab_box_wrapper";
        box.appendChild(e);
        // 検索窓とチェックボックスの入る左側のカラム
        f = document.createElement('div');
        f.className = "search_area";
        e.appendChild(f);
        // アイテムが並ぶ右側のカラム
        g = document.createElement('div');
        g.className = "search_item_wrapper"
        e.appendChild(g);
        // 左カラム内、上段に検索ボックス
        d = document.createElement('div');
        d.className = "search_text_input_wrapper";
        text_input = document.createElement('input');
        text_input.type = 'text';
		text_input.className = "search_text_input";
        text_input.setAttribute('placeholder', '🔍  search');
		text_input.oninput = function (evt) {
			if (this.on_input_changed) {
				this.on_input_changed(evt.target.value, this.check_groups);
			}
		}.bind(this);
		text_input.onclick = function (evt) {
			if (this.on_input_changed) {
				this.on_input_changed(evt.target.value, this.check_groups);
			}
		}.bind(this);
        d.appendChild(text_input);
        f.appendChild(d);
        // 左カラム内、下段にチェックボックスが入るエリア
        h = document.createElement('div');
		h.className = "search_check_wrapper";
        f.appendChild(h);

        function checkFunction(self, target, i) {
            if (target.checked) {
                if (self.check_groups.indexOf(self.setting.groups[i]) < 0) {
                    self.check_groups.push(self.setting.groups[i]);
                }
            } else {
                self.check_groups.splice(self.check_groups.indexOf(self.setting.groups[i]), 1);
            }
        }

        // 全て選択チェックボックス
        (function (self, text_input) {
            var group_div = document.createElement('div'),
                all_checkbox = document.createElement('input'),
                label,
                target;
            all_checkbox.id = 'all_check_';
            all_checkbox.className = "search_group_checkbox";
            all_checkbox.type = 'checkbox';
            label = document.createElement('label');
            label.setAttribute('for', 'search_check_' + i);
            label.textContent = "All";
            label.className = "search_group_label";

            group_div.onclick = function (evt) {
                var checkbox = document.getElementById('all_check_');
                checkbox.checked = !checkbox.checked; 
                for (i = 0; i < self.setting.groups.length; i = i + 1) {
                    target = document.getElementById('search_check_' + i); 
                    target.checked = checkbox.checked;
                    checkFunction(self, target, i);
                }
                if (self.on_input_changed) {
                    self.on_input_changed(text_input.value, self.check_groups);
                }
            };
            all_checkbox.onclick = group_div.onclick;

            group_div.appendChild(all_checkbox);
            group_div.appendChild(label);
            group_div.className = "search_group_div";
            h.appendChild(group_div);
        }(this, text_input));

        // group チェックボックス
        for(i = 0; i < this.setting.groups.length; i++){
            group_div = document.createElement('div');
            checkbox = document.createElement('input');
            checkbox.id = 'search_check_' + i;
			checkbox.className = "search_group_checkbox";
            checkbox.type = 'checkbox';
            group_div.appendChild(checkbox);
            group_div.onclick = (function (self, text_input, i) {
                return function (evt) {
                    var checkbox = document.getElementById('search_check_' + i);
                    checkbox.checked = !checkbox.checked; 
                    checkFunction(self, checkbox, i);
                    if (self.on_input_changed) {
                        self.on_input_changed(text_input.value, self.check_groups);
                    }
                };
            }(this, text_input, i));

            f = document.createElement('label');
            f.setAttribute('for', 'search_check_' + i);
            f.textContent = this.setting.groups[i];
			f.className = "search_group_label";
            
            checkbox.onclick = group_div.onclick;
            f .onclick = group_div.onclick;

            group_div.appendChild(f);
            group_div.className = "search_group_div";
            if (this.setting.colors[i]) {
                group_div.style.backgroundColor = this.setting.colors[i];
            } else {
                group_div.style.backgroundColor = "rgb(54,187,68)";
            }
            h.appendChild(group_div);
        }

		this.item_area = g;
    };

	SearchBox.prototype.init = function () {
		// search tab generate
		this.gen_search_tab_box();
	};

	SearchBox.prototype.set_search_result = function (result) {
		//console.error("set_search_result", result, this.item_area)
		var i;
		if (!this.item_area) {
			return;
		}
		this.item_area.innerHTML = "";
		for (i = 0; i < result.length; ++i) {
			this.item_area.appendChild(result[i]);
		}
	};

	function init(containerElem, setting) {
		return new SearchBox(containerElem, setting);
	}

	window.search_box = {};
	window.search_box.init = init;

}(window.controller_gui));
