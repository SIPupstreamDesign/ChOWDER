/*jslint devel:true*/
/*global Float32Array */
(function (gui) {
	"use strict";
	var SearchBox,
		defaultGroup = "default";

	SearchBox = function (containerElem, setting) {
		this.container = containerElem;
		this.setting = setting;
		this.init();
	};

    SearchBox.prototype.gen_search_tab_box = function (){
        var e, f, g, h, i, j;
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
        e.style.height = '100%';
        e.style.display = 'flex';
        e.style.overflow = 'hidden';
        e.style.flexDirection = 'row';
        box.appendChild(e);
        // 検索窓とチェックボックスの入る左側のカラム
        f = document.createElement('div');
        f.style.width = '300px';
        f.style.height = '100%';
        f.style.overflow = 'auto';
        e.appendChild(f);
        // アイテムが並ぶ右側のカラム
        g = document.createElement('div');
        g.style.width = 'calc(100% - 300px)';
        g.style.height = '100%';
        g.style.overflow = 'auto';
        e.appendChild(g);
        // 左カラム内、上段に検索ボックス
        h = document.createElement('input');
        h.type = 'text';
        h.setAttribute('placeholder', '🔍  search');
        h.style.display = 'block';
        h.style.width = 'calc(100% - 10px)';
        h.style.padding = '5px';
        f.appendChild(h);
        // 左カラム内、下段にチェックボックスが入るエリア
        h = document.createElement('div');
        h.style.display = 'block';
        h.style.width = 'calc(100% - 10px)';
        h.style.padding = '5px';
        f.appendChild(h);

        // temp そのいち
        for(i = 0; i < 10; i++){
            j = document.createElement('div');
            e = document.createElement('input');
            e.id = 'check_temp_' + i;
            e.type = 'checkbox';
            e.style.display = 'inline-block';
            e.style.margin = '10px';
            j.appendChild(e);
            f = document.createElement('label');
            f.setAttribute('for', 'check_temp_' + i);
            f.textContent = 'check_temp_' + i;
            f.style.color = 'white';
            f.style.margin = '10px 5px';
            f.style.cursor = 'pointer';
            j.appendChild(f);
            h.appendChild(j);
        }

        // temp そのに
        for(i = 0; i < 10; i++){
            e = document.createElement('div');
            e.style.display = 'inline-block';
            e.style.margin = '15px';
            e.style.width = '120px';
            e.style.height = '120px';
            e.style.backgroundColor = 'skyblue';
            g.appendChild(e);
        }
    };

	SearchBox.prototype.init = function () {
            // search tab generate
            this.gen_search_tab_box();
	};

	function init(containerElem, setting) {
		return new SearchBox(containerElem, setting);
	}

	window.search_box = {};
	window.search_box.init = init;

}(window.controller_gui));
