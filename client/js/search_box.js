/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var SearchList;

	SearchList = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.item_area = null;
		this.init();

		// 検索ボックスに入力されたときのイベント
		this.on_input_changed = null;

        // チェックされているグループリスト
        this.check_groups = [];
	};

    SearchList.prototype.gen_search_tab_box = function (){
        var d, e, f, g, h, i, j,
            text_input,
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
            var div = document.createElement('div'),
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

            all_checkbox.onclick = function (evt) {
                for (i = 0; i < self.setting.groups.length; i = i + 1) {
                    target = document.getElementById('search_check_' + i); 
                    target.checked = evt.target.checked;
                    checkFunction(self, target, i);
                }
                if (self.on_input_changed) {
                    self.on_input_changed(text_input.value, self.check_groups);
                }
            };
            div.appendChild(all_checkbox);
            div.appendChild(label);
            h.appendChild(div);
        }(this, text_input));

        // group チェックボックス
        for(i = 0; i < this.setting.groups.length; i++){
            j = document.createElement('div');
            e = document.createElement('input');
            e.id = 'search_check_' + i;
			e.className = "search_group_checkbox";
            e.type = 'checkbox';
            e.onclick = (function (self, text_input, i) {
                return function (evt) {
                    checkFunction(self, evt.target, i);
                    if (self.on_input_changed) {
                        self.on_input_changed(text_input.value, self.check_groups);
                    }
                };
            }(this, text_input, i));
            j.appendChild(e);
            f = document.createElement('label');
            f.setAttribute('for', 'search_check_' + i);
            f.textContent = this.setting.groups[i];
			f.className = "search_group_label";
            j.appendChild(f);
            h.appendChild(j);
        }

		this.item_area = g;
    };

	SearchList.prototype.init = function () {
		// search tab generate
		this.gen_search_tab_box();
	};

	SearchList.prototype.set_search_result = function (result) {
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
		return new SearchList(containerElem, setting);
	}

	window.search_list = {};
	window.search_list.init = init;

}(window.controller_gui));
