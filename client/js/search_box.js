/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var SearchList,
		defaultGroup = "default";

	SearchList = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.item_area = null;
		this.init();

		// 検索ボックスに入力されたときのイベント
		this.on_input_changed = null;

	};

    SearchList.prototype.gen_search_tab_box = function (){
        var d, e, f, g, h, i, j;
        var box = this.container;
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
        h = document.createElement('input');
        h.type = 'text';
		h.className = "search_text_input";
        h.setAttribute('placeholder', '🔍  search');
		h.oninput = function (evt) {
			if (this.on_input_changed) {
				this.on_input_changed(evt);
			}
		}.bind(this);
        d.appendChild(h);
        f.appendChild(d);
        // 左カラム内、下段にチェックボックスが入るエリア
        h = document.createElement('div');
		h.className = "search_check_wrapper";
        f.appendChild(h);

        // temp そのいち
        for(i = 0; i < this.setting.groups.length; i++){
            j = document.createElement('div');
            e = document.createElement('input');
            e.id = 'search_check_' + i;
			e.className = "search_group_checkbox";
            e.type = 'checkbox';
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
		console.error("set_search_result", result, this.item_area)
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
