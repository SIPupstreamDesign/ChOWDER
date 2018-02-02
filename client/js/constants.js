/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;

	var Constants = {
		WholeWindowID : "whole_window",
		WholeWindowListID : "onlist:whole_window",
		WholeSubWindowID : "whole_sub_window",
		ContentSelectColor : "#04B431",
		DefaultGroup : "group_default",
		TypeWindow : "window",
		TypeLayout : "layout",
		TypeContent : "content",
		TypeText : "text",
		TypeVideo : "video",
		PropertyTypeDisplay : "display",
		PropertyTypeWholeWindow : "whole_window",
		PropertyTypeLayout : "layout",
		PropertyTypeContent : "content",
		PropertyTypeText : "text",
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
		InitialWholeHeight : 900
	};
	
	window.Constants = Constants;
}());
