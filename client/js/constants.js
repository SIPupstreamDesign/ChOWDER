/*jslint devel:true*/
/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;

	var Constants = {
		WholeWindowID : "whole_window",
		WholeWindowListID : "onlist:whole_window",
		WholeSubWindowID : "whole_sub_window",
		ContentSelectColor : "#04B431",
		WindowSelectColor : "#0080ff",
		DefaultGroup : "group_default",
		TypeVirtualDisplay : "virtual_display",
		TypeWindow : "window",
		TypeLayout : "layout",
		TypeContent : "content",
		TypeText : "text",
		TypeTileImage : "tileimage",
		TypeVideo : "video",
		PropertyTypeDisplay : "display",
		PropertyTypeWholeWindow : "whole_window",
		PropertyTypeLayout : "layout",
		PropertyTypeContent : "content",
		PropertyTypeText : "text",
		PropertTypeVideo : "video",
		PropertyTypePDF : "pdf",
		PropertyTypeMultiDisplay : "multi_display",
		PropertyTypeMultiContent : "multi_content",
		TabIDDisplay : "display_tab",
		TabIDContent : "content_tab",
		TabIDSearch : "search_tab",
		TabIDLayout : "layout_tab",
		SnapTypeFree : "free",
		SnapTypeGrid : "grid",
		SnapTypeDisplay : "display",
		InitialWholeWidth : 1000,
		InitialWholeHeight : 900,
		TemporaryBoundClass : "temporary_bounds",
		// Firefox 1.0+
		IsFirefox : typeof InstallTrigger !== 'undefined',
		// Safari 3.0+ "[object HTMLElementConstructor]" 
		IsSafari : /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification)),
		// Internet Explorer 6-11
		IsIE : /*@cc_on!@*/false || !!document.documentMode,
		// Edge 20+
		IsEdge : !(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia,
		// Chrome 1+
		IsChrome : !!window.chrome && !!window.chrome.webstore,
		DefaultCursorColor : "rgb(255, 255, 255)",
		DefaultTileIconColor : "rgb(54, 187, 68)",
		ReconnectTimeout : 2000
	};

	window.Constants = Constants;
}());
