/*jslint devel:true*/
/*global require, socket, module, Buffer */

(function () {
	"use strict";
	
	var Constants = {
		WholeWindowID : "whole_window",
		WholeWindowListID : "onlist:whole_window",
		WholeSubWindowID : "whole_sub_window",
		ContentSelectColor : "#04B431",
		DefaultGroup : "group_default",
		TypeWindow : "window",
		TypeLayout : "layout",
		TypeContent : "content",
		PropertyTypeDisplay : "display",
		PropertyTypeWholeWindow : "whole_window",
		PropertyTypeLayout : "layout",
		PropertyTypeContent : "content",
		PropertyTypeMultiDisplay : "multi_display",
		PropertyTypeMultiContent : "multi_content",
		TabIDDisplay : "display_tab",
		TabIDContent : "content_tab",
		TabIDSearch : "search_tab",
		TabIDLayout : "layout_tab",
		SnapTypeFree : "free",
		SnapTypeGrid : "grid",
		SnapTypeDisplay : "display"
	};
	
	window.Constants = Constants;
}());
