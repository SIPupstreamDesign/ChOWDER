/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

 "use strict";

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;

const Constants = {
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
	TypePDF : "pdf",
	TypeWebGL : "webgl",
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
	TabIDNotice : "notice_tab",
	SnapTypeFree : "free",
	SnapTypeGrid : "grid",
	SnapTypeDisplay : "display",
	InitialWholeWidth : 1000,
	InitialWholeHeight : 900,
	TemporaryBoundClass : "temporary_bounds",
	ZIndexAlwaysOnTopValue : 0x7FFFFFFF,
	ZIndexAlwaysOnTopString : "AlwaysOnTop",
	ItownsAttributionKey : "attribution",
	// Firefox 1.0+
	IsFirefox : typeof InstallTrigger !== 'undefined',
	// Safari 3.0+ "[object HTMLElementConstructor]"
	IsSafari : /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification)),
	// Internet Explorer 6-11
	IsIE : /*@cc_on!@*/false || !!document.documentMode,
	// Edge 20+
	IsEdge : !(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia,
	// Chrome 1+
	IsChrome : /Google Inc/.test(navigator.vendor),
	IsMobile : navigator.userAgent.indexOf('iPad') > 0
		|| navigator.userAgent.indexOf('Android') > 0
		|| navigator.userAgent.indexOf('iPhone') > 0
		|| navigator.userAgent.indexOf('iPod') > 0
		|| navigator.userAgent.indexOf('Android') > 0 && navigator.userAgent.indexOf('Mobile') > 0,
	DefaultCursorColor : "rgb(255, 255, 255)",
	DefaultTileIconColor : "rgb(54, 187, 68)",
	ReconnectTimeout : 2000,
	MARK_MEMO : "mark_memo",
	MARK : "mark"
};

export default Constants;

