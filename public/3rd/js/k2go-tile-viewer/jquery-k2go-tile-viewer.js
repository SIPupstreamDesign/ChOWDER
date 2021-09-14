;(function($){ var objMethods = {
/******************************************************************************/
/* k2go TileViewer for JQuery Plugin                                          */
/* version   : 1.2.0                                                          */
/* author    : Inoue Computer Service.                                        */
/* Copyright (c) k2go. All rights reserved.                                   */
/* See License.txt for the license information.                               */
/******************************************************************************/
/******************************************************************************/
/* initialize                                                                 */
/******************************************************************************/
  initialize : function(pOptions)
  {
/*-----* variable *-----------------------------------------------------------*/
    var flgTouch      = "ontouchstart"      in window;
    var flgEvent      = flgTouch && "event" in window;
    var strMouseWheel = "onwheel" in document ? "wheel" : "onmousewheel" in document ? "mousewheel" : "DOMMouseScroll";
    var $this         = this;
    var $main         = $("<div class='k2go-tile-viewer-main'></div>");

    $main.on("contextmenu.k2goTileViewer", function(){ return false; });
/*-----* options *------------------------------------------------------------*/
    $main.data("options.k2goTileViewer", $.extend(
    {
      scales :
      [
        { width : 200, height : 200, size : 1.0, count :  1, zoom : 0 },
        { width : 200, height : 200, size : 1.5, count :  1, zoom : 1 },
        { width : 200, height : 200, size : 1.0, count :  2, zoom : 2 },
        { width : 200, height : 200, size : 1.5, count :  2, zoom : 3 },
        { width : 200, height : 200, size : 1.0, count :  4, zoom : 4 },
        { width : 200, height : 200, size : 1.5, count :  4, zoom : 5 },
        { width : 200, height : 200, size : 1.0, count :  8, zoom : 6 },
        { width : 200, height : 200, size : 1.5, count :  8, zoom : 7 },
        { width : 200, height : 200, size : 1.0, count : 16, zoom : 8 },
        { width : 200, height : 200, size : 1.5, count : 16, zoom : 9 }
      ],
      scale           :     0,
      drawingSize     :     1,
      timeout         :  1000,
      disableMove     : false,
      disableZoom     : false,
      limitZoomEffect : false
    }, pOptions));
/*-----* move animation element *---------------------------------------------*/
    $main.data("moveAnimate.k2goTileViewer", $("<div></div>"));
    $main.data("moveAnimate.k2goTileViewer"                  ).css({ position : "absolute", left : "0px", top : "0px" });
/*-----* entities table *-----------------------------------------------------*/
    $main.data("entities.k2goTileViewer", []);
/******************************************************************************/
/* window.resize                                                              */
/******************************************************************************/
    $(window).on("resize.k2goTileViewer", function()
    {
      try
      {
        if ($main.children().length                    ==        0) return;
        if (typeof $main.data("resize.k2goTileViewer") == "number") clearTimeout($main.data("resize.k2goTileViewer"));

        $main.data("resize.k2goTileViewer", setTimeout(function()
        {
          $main.data("lock.k2goTileViewer", true);

          _moveAdjust();
          _increment ();

          $main.data("resize.k2goTileViewer", null);
          $main.data("lock.k2goTileViewer"  , false);
        }, 500));
      }
      catch(pError)
      {
        console.error("jQuery.k2goTileViewer resize error: " + pError);
      }
    });
/******************************************************************************/
/* main.wheel                                                                 */
/******************************************************************************/
    $main.on(strMouseWheel + ".k2goTileViewer", function(pEvent)
    {
      try
      {
        var intDelta = pEvent.originalEvent.deltaY ? -(pEvent.originalEvent.deltaY) : pEvent.originalEvent.wheelDelta ? pEvent.originalEvent.wheelDelta : -(pEvent.originalEvent.detail);

        if (flgEvent                                                                                                                                                                           ) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
        if (       $main.data("options.k2goTileViewer").disableZoom                                                                                                                            ) return;
        if (       $main.data("options.k2goTileViewer").limitZoomEffect && $main.data("options.k2goTileViewer").scale == 0                                                      && intDelta < 0) return;
        if (       $main.data("options.k2goTileViewer").limitZoomEffect && $main.data("options.k2goTileViewer").scale == $main.data("options.k2goTileViewer").scales.length - 1 && intDelta > 0) return;
        if (       $main.data("lock.k2goTileViewer"   )                                                                                                                                        ) return;                                          else $main.data("lock.k2goTileViewer", true);
        if (typeof $main.data("zoom.k2goTileViewer"   ) == "number"                                                                                                                            ) clearTimeout($main.data("zoom.k2goTileViewer"));

        if ($(".k2go-tile-viewer-clone").length == 0)
        {
          if (typeof $main.data("options.k2goTileViewer").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTileViewer").zoomStart({ x : pEvent.pageX, y : pEvent.pageY }); }, 1);
          _createClone({ x : pEvent.pageX, y : pEvent.pageY });
        }

        var $clone          = $(".k2go-tile-viewer-clone");
        var objMinScaleSize = _getScaleSize(0);
        var objMaxScaleSize = _getScaleSize($main.data("options.k2goTileViewer").scales.length - 1);
        var objScaleSize    = _getScaleSize($main.data("options.k2goTileViewer").scale);
        var intMinScale     = objMinScaleSize.width / objScaleSize.width;
        var intMaxScale     = objMaxScaleSize.width / objScaleSize.width;

             if (intDelta                                      > 0  ) $clone.data("cloneInfo.k2goTileViewer").scale += 0.05;
        else if ($clone.data("cloneInfo.k2goTileViewer").scale > 0.1) $clone.data("cloneInfo.k2goTileViewer").scale -= 0.05;

        if ($main.data("options.k2goTileViewer").limitZoomEffect)
        {
               if ($clone.data("cloneInfo.k2goTileViewer").scale < intMinScale) $clone.data("cloneInfo.k2goTileViewer").scale = intMinScale;
          else if ($clone.data("cloneInfo.k2goTileViewer").scale > intMaxScale) $clone.data("cloneInfo.k2goTileViewer").scale = intMaxScale;
        }

        $clone.css("transform", "scale(" + $clone.data("cloneInfo.k2goTileViewer").scale + ")");

        $main.data("zoom.k2goTileViewer", setTimeout(function()
        {
          $main.data("lock.k2goTileViewer", true);
          _zoom();
          $main.data("lock.k2goTileViewer", false);
        }, 500));

        $main.data("lock.k2goTileViewer", false);
      }
      catch(pError)
      {
        console.error("jQuery.k2goTileViewer " + strMouseWheel + " error: " + pError);
      }
    });
/******************************************************************************/
/* main.drag                                                                  */
/******************************************************************************/
/*-----* start *--------------------------------------------------------------*/
    $.each(["touchstart", "mousedown"], function()
    {
      var flgTouch = this == "touchstart" ? true : false;

      $main.on((flgTouch ? "touchstart" : "mousedown") + ".k2goTileViewer", function(pEvent)
      {
        try
        {
          if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTileViewer")      ) return;
          if ($(".k2go-tile-viewer-clone").length > 0) return;

          var flgSingle       = (flgEvent ? (event.touches.length == 1 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 1 ? true : false) : true );
          var flgDouble       = (flgEvent ? (event.touches.length == 2 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 2 ? true : false) : false) && !$main.data("options.k2goTileViewer").disableZoom;
          var objStart        = { x:0, y:0 };
          var objBase1        = { x:0, y:0 };
          var objBase2        = { x:0, y:0 };
          var objMove1        = { x:0, y:0 };
          var objMove2        = { x:0, y:0 };
          var intBaseDis      = 0;
          var intMoveDis      = 0;
          var objMinScaleSize;
          var objMaxScaleSize;
          var objScaleSize;
          var intMinScale;
          var intMaxScale;

          if (flgSingle)
          {
            objStart.x = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
            objStart.y = flgEvent ? event.changedTouches[0].pageY : flgTouch ? pEvent.originalEvent.touches.item(0).pageY : pEvent.pageY;
            objBase1.x = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
            objBase1.y = flgEvent ? event.changedTouches[0].pageY : flgTouch ? pEvent.originalEvent.touches.item(0).pageY : pEvent.pageY;

            if ($main.data("dblTap.k2goTileViewer"))
            {
              if (typeof $main.data("options.k2goTileViewer").doubleTap == "function") setTimeout(function() { $main.data("options.k2goTileViewer").doubleTap({ which : (flgTouch ? 1 : (pEvent.which == 3 ? -1 : 1)),   x : objBase1.x, y : objBase1.y }); }, 1);
              else                                                                                             $this.k2goTileViewer                          (  "zoom", (flgTouch ? 1 : (pEvent.which == 3 ? -1 : 1)), { x : objBase1.x, y : objBase1.y });

              $main.data("dblTap.k2goTileViewer", false);
              return;
            }
            else
            {
              $main.data( "dblTap.k2goTileViewer", true);
              $main.data("tapHold.k2goTileViewer", setTimeout(function()
              {
                if (typeof $main.data("options.k2goTileViewer").tapHold == "function")                         $main.data("options.k2goTileViewer").tapHold  ({ x : objBase1.x, y : objBase1.y });
                $main.data("tapHold.k2goTileViewer", null);
              }, 1000));

              if (typeof $main.data("options.k2goTileViewer").moveStart == "function") setTimeout(function() { $main.data("options.k2goTileViewer").moveStart({ x : objBase1.x, y : objBase1.y }); }, 1);
            }

            setTimeout(function(){ $main.data("dblTap.k2goTileViewer", false); }, 300);
          }
          else if (flgDouble)
          {
            objBase1        = (flgEvent ? { x : event.touches[0].pageX, y : event.touches[0].pageY } : flgTouch ? { x : pEvent.originalEvent.touches.item(0).pageX, y : pEvent.originalEvent.touches.item(0).pageY } : { x : pEvent.touches[0].pageX, y : pEvent.touches[0].pageY });
            objBase2        = (flgEvent ? { x : event.touches[1].pageX, y : event.touches[1].pageY } : flgTouch ? { x : pEvent.originalEvent.touches.item(1).pageX, y : pEvent.originalEvent.touches.item(1).pageY } : { x : pEvent.touches[1].pageX, y : pEvent.touches[1].pageY });
            intBaseDis      = Math.sqrt(Math.pow(objBase1.x - objBase2.x, 2) + Math.pow(objBase1.y - objBase2.y, 2));
            objMinScaleSize = _getScaleSize(0);
            objMaxScaleSize = _getScaleSize($main.data("options.k2goTileViewer").scales.length - 1);
            objScaleSize    = _getScaleSize($main.data("options.k2goTileViewer").scale);
            intMinScale     = objMinScaleSize.width / objScaleSize.width;
            intMaxScale     = objMaxScaleSize.width / objScaleSize.width;

            _createClone({ x : (objBase1.x + objBase2.x) / 2, y : (objBase1.y + objBase2.y) / 2 });
            if (typeof $main.data("options.k2goTileViewer").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTileViewer").zoomStart({ x : (objBase1.x + objBase2.x) / 2, y : (objBase1.y + objBase2.y) / 2 }); }, 1);
            $(document).trigger((flgTouch ? "touchend" : "mouseup") + ".k2goTileViewer");
          }
          else
            return;
/*-----* move *---------------------------------------------------------------*/
          var fncMove = function(pEvent)
          {
            try
            {
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

              var flgSingle = flgEvent ? (event.touches.length == 1 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 1 ? true : false) : true;
              var flgDouble = flgEvent ? (event.touches.length == 2 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 2 ? true : false) : false;

              if (flgSingle)
              {
                objMove1.x = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - objBase1.x;
                objMove1.y = (flgEvent ? event.changedTouches[0].pageY : flgTouch ? pEvent.originalEvent.touches.item(0).pageY : pEvent.pageY) - objBase1.y;
                objBase1.x = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);
                objBase1.y = (flgEvent ? event.changedTouches[0].pageY : flgTouch ? pEvent.originalEvent.touches.item(0).pageY : pEvent.pageY);
                _move({ left : objMove1.x, top : objMove1.y });

                if (typeof $main.data("tapHold.k2goTileViewer") == "number" && (Math.abs(objStart.x - objBase1.x) > 5 || Math.abs(objStart.y - objBase1.y) > 5))
                {
                  clearTimeout($main.data("tapHold.k2goTileViewer"));
                               $main.data("tapHold.k2goTileViewer", null);
                }
              }
              else if (flgDouble)
              {
                objMove1   = flgEvent ? { x : event.touches[0].pageX, y : event.touches[0].pageY } : flgTouch ? { x : pEvent.originalEvent.touches.item(0).pageX, y : pEvent.originalEvent.touches.item(0).pageY } : { x : pEvent.touches[0].pageX, y : pEvent.touches[0].pageY };
                objMove2   = flgEvent ? { x : event.touches[1].pageX, y : event.touches[1].pageY } : flgTouch ? { x : pEvent.originalEvent.touches.item(1).pageX, y : pEvent.originalEvent.touches.item(1).pageY } : { x : pEvent.touches[1].pageX, y : pEvent.touches[1].pageY };
                intMoveDis = Math.sqrt(Math.pow(objMove1.x - objMove2.x, 2) + Math.pow(objMove1.y - objMove2.y, 2));

                $(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale = intMoveDis / intBaseDis;

                if ($main.data("options.k2goTileViewer").limitZoomEffect)
                {
                       if ($(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale < intMinScale) $(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale = intMinScale;
                  else if ($(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale > intMaxScale) $(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale = intMaxScale;
                }

                $(".k2go-tile-viewer-clone").css("transform", "scale(" + $(".k2go-tile-viewer-clone").data("cloneInfo.k2goTileViewer").scale + ")");
              }
            }
            catch(pError)
            {
              console.error("jQuery.k2goTileViewer mousemove error: " + pError);
            }
          };

          document.addEventListener(flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
/*-----* end *----------------------------------------------------------------*/
          $(document).one((flgTouch ? "touchend" : "mouseup") + ".k2goTileViewer", function(pEvent)
          {
            try
            {
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

              if (typeof $main.data("tapHold.k2goTileViewer") == "number")
              {
                clearTimeout($main.data("tapHold.k2goTileViewer"));
                             $main.data("tapHold.k2goTileViewer", null);
              }

                document .removeEventListener( flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
              $(document).off                ((flgTouch ? "touchend"  : "mouseup"  ) + ".k2goTileViewer");
              $main      .data               ("lock.k2goTileViewer", true);

              if (flgSingle)
              {
                _moveAdjust();
                _increment ();
                if (typeof $main.data("options.k2goTileViewer").moveEnd == "function") setTimeout(function() { $main.data("options.k2goTileViewer").moveEnd(); }, 1);
              }
              else if (flgDouble)
              {
                _zoom();
              }

              $main.data("lock.k2goTileViewer", false);
            }
            catch(pError)
            {
              console.error("jQuery.k2goTileViewer mouseup error: " + pError);
            }
          });
        }
        catch(pError)
        {
          console.error("jQuery.k2goTileViewer mousedown error: " + pError);
        }
      });
    });
/******************************************************************************/
/* load                                                                       */
/******************************************************************************/
    $this.append($main);
  },
/******************************************************************************/
/* setOptions                                                                 */
/******************************************************************************/
  setOptions : function(pOptions)
  {
    $.extend($(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer"), pOptions);
  },
/******************************************************************************/
/* getOptions                                                                 */
/******************************************************************************/
  getOptions : function()
  {
    var $main = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");

    return {
      scales           :               $main.data("options.k2goTileViewer").scales.slice(),
      scale            :               $main.data("options.k2goTileViewer").scale,
      drawingSize      :               $main.data("options.k2goTileViewer").drawingSize,
      timeout          :               $main.data("options.k2goTileViewer").timeout,
      disableMove      :               $main.data("options.k2goTileViewer").disableMove,
      disableZoom      :               $main.data("options.k2goTileViewer").disableZoom,
      limitZoomEffect  :               $main.data("options.k2goTileViewer").limitZoomEffect,
      backgroundImage  :               $main.data("options.k2goTileViewer").backgroundImage,
      foregroundImages : Array.isArray($main.data("options.k2goTileViewer").foregroundImages) ? $main.data("options.k2goTileViewer").foregroundImages.slice() : null,
      geodeticSystem   :               $main.data("options.k2goTileViewer").geodeticSystem,
      zoomStart        :               $main.data("options.k2goTileViewer").zoomStart,
      zoomEnd          :               $main.data("options.k2goTileViewer").zoomEnd,
      moveStart        :               $main.data("options.k2goTileViewer").moveStart,
      move             :               $main.data("options.k2goTileViewer").move,
      moveEnd          :               $main.data("options.k2goTileViewer").moveEnd,
      tapHold          :               $main.data("options.k2goTileViewer").tapHold,
      doubleTap        :               $main.data("options.k2goTileViewer").doubleTap,
      addTile          :               $main.data("options.k2goTileViewer").addTile
    };
  },
/******************************************************************************/
/* create                                                                     */
/******************************************************************************/
  create : function(pPositionInfo, pCallBack)
  {
    var objPositionInfo = null;
/*-----* center *-------------------------------------------------------------*/
    if (typeof pPositionInfo == "object" && pPositionInfo != null)
    {
      if ("center" in pPositionInfo && "scale" in pPositionInfo && "width" in pPositionInfo && "height" in pPositionInfo)
      {
        objPositionInfo        = {};
        objPositionInfo.scale  = pPositionInfo.scale;
        objPositionInfo.width  = pPositionInfo.width;
        objPositionInfo.height = pPositionInfo.height;

        if ("relative" in pPositionInfo.center)
        {
          objPositionInfo.left = pPositionInfo.center.relative.left;
          objPositionInfo.top  = pPositionInfo.center.relative.top;
        }
        else if ("degrees" in pPositionInfo.center)
        {
          var objRelativePosition = _getRelativePosition(pPositionInfo.center);

          objPositionInfo.left = objRelativePosition.left;
          objPositionInfo.top  = objRelativePosition.top;
        }
        else if ("absolute" in pPositionInfo.center)
        {
          var objRelativePosition = _getRelativePosition({ absolute : { scale : pPositionInfo.scale, left : pPositionInfo.center.absolute.left, top : pPositionInfo.center.absolute.top } });

          objPositionInfo.left = objRelativePosition.left;
          objPositionInfo.top  = objRelativePosition.top;
        }
      }
/*-----* bounds *-------------------------------------------------------------*/
      else if ("bounds" in pPositionInfo)
      {
        if ("relative" in pPositionInfo.bounds)
        {
          objPositionInfo       = {};
          objPositionInfo.scale = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales.length - 1;

          var objScaleSize = _getScaleSize(objPositionInfo.scale);

          objPositionInfo.width  = objScaleSize.width  * pPositionInfo.bounds.relative.right  - objScaleSize.width  * pPositionInfo.bounds.relative.left;
          objPositionInfo.height = objScaleSize.height * pPositionInfo.bounds.relative.bottom - objScaleSize.height * pPositionInfo.bounds.relative.top;
          objPositionInfo.left   = pPositionInfo.bounds.relative.left + (pPositionInfo.bounds.relative.right  - pPositionInfo.bounds.relative.left) / 2;
          objPositionInfo.top    = pPositionInfo.bounds.relative.top  + (pPositionInfo.bounds.relative.bottom - pPositionInfo.bounds.relative.top ) / 2;
        }
        else if ("degrees" in pPositionInfo.bounds)
        {
          objPositionInfo       = {};
          objPositionInfo.scale = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales.length - 1;

          var objScaleSize   = _getScaleSize       (objPositionInfo.scale);
          var objLeftTop     = _getRelativePosition({ degrees : { left : pPositionInfo.bounds.degrees.left , top : pPositionInfo.bounds.degrees.top    } });
          var objRightBottom = _getRelativePosition({ degrees : { left : pPositionInfo.bounds.degrees.right, top : pPositionInfo.bounds.degrees.bottom } });

          objPositionInfo.width  = objScaleSize.width  * objRightBottom.left - objScaleSize.width  * objLeftTop.left;
          objPositionInfo.height = objScaleSize.height * objRightBottom.top  - objScaleSize.height * objLeftTop.top;
          objPositionInfo.left   = objLeftTop.left + (objRightBottom.left - objLeftTop.left) / 2;
          objPositionInfo.top    = objLeftTop.top  + (objRightBottom.top  - objLeftTop.top ) / 2;
        }
        else if ("absolute" in pPositionInfo.bounds)
        {
          objPositionInfo        = {};
          objPositionInfo.scale  = pPositionInfo.bounds.absolute.scale;
          objPositionInfo.width  = pPositionInfo.bounds.absolute.right  - pPositionInfo.bounds.absolute.left;
          objPositionInfo.height = pPositionInfo.bounds.absolute.bottom - pPositionInfo.bounds.absolute.top;

          var objLeftTop     = _getRelativePosition({ absolute : { left : pPositionInfo.bounds.absolute.left , top : pPositionInfo.bounds.absolute.top   , scale : pPositionInfo.bounds.absolute.scale } });
          var objRightBottom = _getRelativePosition({ absolute : { left : pPositionInfo.bounds.absolute.right, top : pPositionInfo.bounds.absolute.bottom, scale : pPositionInfo.bounds.absolute.scale } });

          objPositionInfo.left = objLeftTop.left + (objRightBottom.left - objLeftTop.left) / 2;
          objPositionInfo.top  = objLeftTop.top  + (objRightBottom.top  - objLeftTop.top ) / 2;
        }
      }
    }
/*-----* other *--------------------------------------------------------------*/
    if (objPositionInfo == null)
    {
      var intScale     = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales.length - 1;
      var objScaleSize = _getScaleSize(intScale);

      objPositionInfo        = {};
      objPositionInfo.scale  = intScale;
      objPositionInfo.width  = objScaleSize.width;
      objPositionInfo.height = objScaleSize.height;
      objPositionInfo.left   = 0.5;
      objPositionInfo.top    = 0.5;
    }

    _createClone();
    _create     (objPositionInfo);
    _removeClone(pCallBack);
  },
/******************************************************************************/
/* move                                                                       */
/******************************************************************************/
  move : function(pPositionInfo, pDuration, pCallBack)
  {
    if (typeof pPositionInfo != "object" || pPositionInfo == null) return;

    var $main          = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var objCenterInfo  = _getCenterInfo();
    var objDestination = {};

    $main.data("lock.k2goTileViewer", true);

                                            objCenterInfo  = _getAbsolutePosition({ offset   : objCenterInfo.offset });
         if ("relative"   in pPositionInfo) objDestination = _getAbsolutePosition({ relative : { scale : objCenterInfo.scale, left : pPositionInfo.relative.left, top : pPositionInfo.relative.top } });
    else if ("degrees"    in pPositionInfo) objDestination = _getAbsolutePosition({ degrees  : { scale : objCenterInfo.scale, left : pPositionInfo.degrees .left, top : pPositionInfo.degrees .top } });
    else if ("absolute"   in pPositionInfo) objDestination = $.extend({}, pPositionInfo.absolute);
    else if ("difference" in pPositionInfo) objDestination = { left : objCenterInfo.left + pPositionInfo.difference.left, top : objCenterInfo.top + pPositionInfo.difference.top };
    else                                    objDestination = { left : objCenterInfo.left                                , top : objCenterInfo.top                                };

    $main.data("moveAnimate.k2goTileViewer").stop().css({ left : objCenterInfo.left + "px", top : objCenterInfo.top + "px" }).animate({ left : objDestination.left + "px", top : objDestination.top + "px" },
    {
      duration : pDuration,
      easing   : "swing",
      progress : function(pAnimation, pProgress, pRemainingMs)
      {
        var intLeft = parseFloat($(pAnimation.elem).css("left"));
        var intTop  = parseFloat($(pAnimation.elem).css("top" ));

        _move({ left : objCenterInfo.left - intLeft, top : objCenterInfo.top - intTop });

        objCenterInfo.left = intLeft;
        objCenterInfo.top  = intTop;
      },
      complete : function()
      {
        _moveAdjust();
        _increment ();
        if (typeof pCallBack == "function") setTimeout(function() { pCallBack(); }, 1);
        $main.data("lock.k2goTileViewer", false);
      }
    });
  },
/******************************************************************************/
/* zoom                                                                       */
/******************************************************************************/
  zoomIn  : function() { this.k2goTileViewer("zoom",  1); },
  zoomOut : function() { this.k2goTileViewer("zoom", -1); },
  zoom    : function(pType, pPosition)
  {
    var $main    = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var intScale = $main.data("options.k2goTileViewer").scale;

    if ($(".k2go-tile-viewer-clone").length > 0                                        ) return;
    if ($main.data("options.k2goTileViewer").disableZoom                               ) return;
    if (pType < 0 && intScale <= 0                                                     ) return;
    if (pType > 0 && intScale >= $main.data("options.k2goTileViewer").scales.length - 1) return;
    if ($main.data("lock.k2goTileViewer")                                              ) return; else $main.data("lock.k2goTileViewer", true);

    if (typeof $main.data("options.k2goTileViewer").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTileViewer").zoomStart(pPosition); }, 1);
    _createClone(pPosition);

    var $clone             = $(".k2go-tile-viewer-clone");
    var aryScales          = $main.data("options.k2goTileViewer").scales;
    var objScaleSizeBefore = _getScaleSize(intScale);
    var objScaleSizeAfter  = _getScaleSize(intScale + pType);
    var intIncrement       = Math.abs(1 - objScaleSizeAfter.width / objScaleSizeBefore.width) / 10;
    var intCounter         = 0;

    setTimeout(function _loop()
    {
           if (objScaleSizeAfter.width > objScaleSizeBefore.width ) $clone.data("cloneInfo.k2goTileViewer").scale += intIncrement;
      else if ($clone.data("cloneInfo.k2goTileViewer").scale > 0.1) $clone.data("cloneInfo.k2goTileViewer").scale -= intIncrement;

      $clone.css("transform", "scale(" + $clone.data("cloneInfo.k2goTileViewer").scale + ")");
      intCounter++;

      if (intCounter < 10) setTimeout(_loop, 20); else { _zoom(); $main.data("lock.k2goTileViewer", false); }
    }, 1);
  },
/******************************************************************************/
/* addEntity                                                                  */
/******************************************************************************/
  addEntity : function(pEntity)
  {
    if (!(typeof pEntity == "object" && pEntity != null                  )) return null;
    if (!("element" in pEntity       && pEntity.element instanceof jQuery)) return null;

    var objEntity = { element : pEntity.element };
/*-----* center *-------------------------------------------------------------*/
    if ("center" in pEntity)
    {
      if ("relative" in pEntity.center)
      {
        objEntity.center               = {};
        objEntity.center.relative      = {};
        objEntity.center.relative.left = pEntity.center.relative.left;
        objEntity.center.relative.top  = pEntity.center.relative.top;
        objEntity.center.degrees       = _getDegreesPosition({ relative : pEntity.center.relative });
      }
      else if ("degrees" in pEntity.center)
      {
        objEntity.center              = {};
        objEntity.center.degrees      = {};
        objEntity.center.degrees.left = pEntity.center.degrees.left;
        objEntity.center.degrees.top  = pEntity.center.degrees.top;
        objEntity.center.relative     = _getRelativePosition({ degrees : pEntity.center.degrees });
      }
      else if ("offset" in pEntity.center)
      {
        objEntity.center          = {};
        objEntity.center.relative = _getRelativePosition({ offset : pEntity.center.offset });
        objEntity.center.degrees  = _getDegreesPosition ({ offset : pEntity.center.offset });
      }
      else if ("absolute" in pEntity.center)
      {
        objEntity.center          = {};
        objEntity.center.relative = _getRelativePosition({ absolute : pEntity.center.absolute });
        objEntity.center.degrees  = _getDegreesPosition ({ absolute : pEntity.center.absolute });
      }
    }
/*-----* bounds *-------------------------------------------------------------*/
    else if ("bounds" in pEntity)
    {
      if ("relative" in pEntity.bounds)
      {
        objEntity.center               = {};
        objEntity.center.relative      = {};
        objEntity.center.relative.left = pEntity.bounds.relative.left + (pEntity.bounds.relative.right  - pEntity.bounds.relative.left) / 2;
        objEntity.center.relative.top  = pEntity.bounds.relative.top  + (pEntity.bounds.relative.bottom - pEntity.bounds.relative.top ) / 2;
        objEntity.center.degrees       = _getDegreesPosition({ relative : { left : objEntity.center.relative.left, top : objEntity.center.relative.top } });

        objEntity.size                 = {};
        objEntity.size.relative        = {};
        objEntity.size.relative.width  = pEntity.bounds.relative.right  - pEntity.bounds.relative.left;
        objEntity.size.relative.height = pEntity.bounds.relative.bottom - pEntity.bounds.relative.top;

        var objLeftTop     = _getDegreesPosition({ relative : { left : pEntity.bounds.relative.left , top : pEntity.bounds.relative.top    } });
        var objRightBottom = _getDegreesPosition({ relative : { left : pEntity.bounds.relative.right, top : pEntity.bounds.relative.bottom } });

        objEntity.size.degrees        = {};
        objEntity.size.degrees.left   = objLeftTop    .left;
        objEntity.size.degrees.top    = objLeftTop    .top;
        objEntity.size.degrees.right  = objRightBottom.left;
        objEntity.size.degrees.bottom = objRightBottom.top;
      }
      else if ("degrees" in pEntity.bounds)
      {
        objEntity.center              = {};
        objEntity.center.degrees      = {};
        objEntity.center.degrees.left = pEntity.bounds.degrees.left + (pEntity.bounds.degrees.right  - pEntity.bounds.degrees.left) / 2;
        objEntity.center.degrees.top  = pEntity.bounds.degrees.top  + (pEntity.bounds.degrees.bottom - pEntity.bounds.degrees.top ) / 2;
        objEntity.center.relative     = _getRelativePosition({ degrees : { left : objEntity.center.degrees.left, top : objEntity.center.degrees.top } });

        objEntity.size                = {};
        objEntity.size.degrees        = {};
        objEntity.size.degrees.left   = pEntity.bounds.degrees.left;
        objEntity.size.degrees.top    = pEntity.bounds.degrees.top;
        objEntity.size.degrees.right  = pEntity.bounds.degrees.right;
        objEntity.size.degrees.bottom = pEntity.bounds.degrees.bottom;

        var objLeftTop     = _getRelativePosition({ degrees : { left : pEntity.bounds.degrees.left , top : pEntity.bounds.degrees.top    } });
        var objRightBottom = _getRelativePosition({ degrees : { left : pEntity.bounds.degrees.right, top : pEntity.bounds.degrees.bottom } });

        objEntity.size.relative        = {};
        objEntity.size.relative.width  = objRightBottom.left - objLeftTop.left;
        objEntity.size.relative.height = objRightBottom.top  - objLeftTop.top;
      }
      else if ("offset" in pEntity.bounds)
      {
        var objRelativeLeftTop     = _getRelativePosition({ offset : { left : pEntity.bounds.offset.left , top : pEntity.bounds.offset.top    } });
        var objRelativeRightBottom = _getRelativePosition({ offset : { left : pEntity.bounds.offset.right, top : pEntity.bounds.offset.bottom } });
        var objDegreesLeftTop      = _getDegreesPosition ({ offset : { left : pEntity.bounds.offset.left , top : pEntity.bounds.offset.top    } });
        var objDegreesRightBottom  = _getDegreesPosition ({ offset : { left : pEntity.bounds.offset.right, top : pEntity.bounds.offset.bottom } });

        objEntity.center               = {};
        objEntity.center.relative      = {};
        objEntity.center.relative.left = objRelativeLeftTop.left + (objRelativeRightBottom.left - objRelativeLeftTop.left) / 2;
        objEntity.center.relative.top  = objRelativeLeftTop.top  + (objRelativeRightBottom.top  - objRelativeLeftTop.top ) / 2;
        objEntity.center.degrees       = {};
        objEntity.center.degrees .left = objDegreesLeftTop .left + (objDegreesRightBottom .left - objDegreesLeftTop .left) / 2;
        objEntity.center.degrees .top  = objDegreesLeftTop .top  + (objDegreesRightBottom .top  - objDegreesLeftTop .top ) / 2;

        objEntity.size                 = {};
        objEntity.size.relative        = {};
        objEntity.size.relative.width  = objRelativeRightBottom.left - objRelativeLeftTop.left;
        objEntity.size.relative.height = objRelativeRightBottom.top  - objRelativeLeftTop.top;
        objEntity.size.degrees         = {};
        objEntity.size.degrees .left   = objDegreesLeftTop    .left;
        objEntity.size.degrees .top    = objDegreesLeftTop    .top;
        objEntity.size.degrees .right  = objDegreesRightBottom.left;
        objEntity.size.degrees .bottom = objDegreesRightBottom.top;
      }
      else if ("absolute" in pEntity.bounds)
      {
        var objRelativeLeftTop     = _getRelativePosition({ absolute : { left : pEntity.bounds.absolute.left , top : pEntity.bounds.absolute.top   , scale : pEntity.bounds.absolute.scale } });
        var objRelativeRightBottom = _getRelativePosition({ absolute : { left : pEntity.bounds.absolute.right, top : pEntity.bounds.absolute.bottom, scale : pEntity.bounds.absolute.scale } });
        var objDegreesLeftTop      = _getDegreesPosition ({ absolute : { left : pEntity.bounds.absolute.left , top : pEntity.bounds.absolute.top   , scale : pEntity.bounds.absolute.scale } });
        var objDegreesRightBottom  = _getDegreesPosition ({ absolute : { left : pEntity.bounds.absolute.right, top : pEntity.bounds.absolute.bottom, scale : pEntity.bounds.absolute.scale } });

        objEntity.center               = {};
        objEntity.center.relative      = {};
        objEntity.center.relative.left = objRelativeLeftTop.left + (objRelativeRightBottom.left - objRelativeLeftTop.left) / 2;
        objEntity.center.relative.top  = objRelativeLeftTop.top  + (objRelativeRightBottom.top  - objRelativeLeftTop.top ) / 2;
        objEntity.center.degrees       = {};
        objEntity.center.degrees .left = objDegreesLeftTop .left + (objDegreesRightBottom .left - objDegreesLeftTop .left) / 2;
        objEntity.center.degrees .top  = objDegreesLeftTop .top  + (objDegreesRightBottom .top  - objDegreesLeftTop .top ) / 2;

        objEntity.size                 = {};
        objEntity.size.relative        = {};
        objEntity.size.relative.width  = objRelativeRightBottom.left - objRelativeLeftTop.left;
        objEntity.size.relative.height = objRelativeRightBottom.top  - objRelativeLeftTop.top;
        objEntity.size.degrees         = {};
        objEntity.size.degrees .left   = objDegreesLeftTop    .left;
        objEntity.size.degrees .top    = objDegreesLeftTop    .top;
        objEntity.size.degrees .right  = objDegreesRightBottom.left;
        objEntity.size.degrees .bottom = objDegreesRightBottom.top;
      }
    }

    if (!("center" in objEntity)) return null;
/*-----* add entities *-------------------------------------------------------*/
    var $main       = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var aryEntities = $main.data("entities.k2goTileViewer");

    var flgExist = aryEntities.some(function(pEntity, pIndex, pArray)
    {
      if (pEntity.element.is(objEntity.element))
      {
        aryEntities.splice(pIndex, 1, objEntity);
        return true;
      }
    });

    if (!flgExist) aryEntities.push(objEntity);

    objEntity.element.addClass("k2go-tile-viewer-entity");
/*-----* append entity *------------------------------------------------------*/
    objEntity.tileInfo = _getTileInfo({ scale : $main.data("options.k2goTileViewer").scale, left : objEntity.center.relative.left, top : objEntity.center.relative.top });

    var $tile = $main.children("[x='" + objEntity.tileInfo.x + "'][y='" + objEntity.tileInfo.y + "']");

    if ($tile.length > 0)
    {
      _appendEntity($tile, objEntity);
    }

    return objEntity;
  },
/******************************************************************************/
/* getEntity                                                                  */
/******************************************************************************/
  getEntity : function(pElement)
  {
    var aryEntities = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("entities.k2goTileViewer");

    for (var i01 = 0; i01 < aryEntities.length; i01++)
    {
      if (aryEntities[i01].element.is(pElement))
      {
        var objEntity = { element : aryEntities[i01].element };

        if ("center"   in aryEntities[i01]) objEntity.center   = $.extend({}, aryEntities[i01].center  );
        if ("tileInfo" in aryEntities[i01]) objEntity.tileInfo = $.extend({}, aryEntities[i01].tileInfo);
        if ("size"     in aryEntities[i01]) objEntity.size     = $.extend({}, aryEntities[i01].size    );

        return objEntity;
      }
    }

    return null;
  },
/******************************************************************************/
/* getEntities                                                                */
/******************************************************************************/
  getEntities : function()
  {
    var aryEntities = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("entities.k2goTileViewer");
    var aryResults  = [];

    for (var i01 = 0; i01 < aryEntities.length; i01++)
    {
      var objEntity = { element : aryEntities[i01].element };

      if ("center"   in aryEntities[i01]) objEntity.center   = $.extend({}, aryEntities[i01].center  );
      if ("tileInfo" in aryEntities[i01]) objEntity.tileInfo = $.extend({}, aryEntities[i01].tileInfo);
      if ("size"     in aryEntities[i01]) objEntity.size     = $.extend({}, aryEntities[i01].size    );

      aryResults.push(objEntity);
    }

    return aryResults;
  },
/******************************************************************************/
/* deleteEntity                                                               */
/******************************************************************************/
  deleteEntity : function(pElement)
  {
    var aryEntities = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("entities.k2goTileViewer");

    for (var i01 = 0; i01 < aryEntities.length; i01++)
    {
      if (aryEntities[i01].element.is(pElement))
      {
        pElement   .remove();
        aryEntities.splice(i01, 1);
        break;
      }
    }
  },
/******************************************************************************/
/* deleteAllEntity                                                            */
/******************************************************************************/
  deleteAllEntity : function()
  {
    var $main = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");

    $main.find(".k2go-tile-viewer-entity"   ).remove();
    $main.data("entities.k2goTileViewer", []);
  },
/******************************************************************************/
/* getPositionInfo                                                            */
/******************************************************************************/
  getPositionInfo : function(pOffset)
  {
    var objResult = {};

    objResult.offset      = {};
    objResult.offset.left = pOffset.left;
    objResult.offset.top  = pOffset.top;

    objResult.absolute    = _getAbsolutePosition({ offset   : objResult.offset   });
    objResult.relative    = _getRelativePosition({ absolute : objResult.absolute });
    objResult.degrees     = _getDegreesPosition ({ absolute : objResult.absolute });
    objResult.tileInfo    = _getTileInfo        ({ scale : objResult.absolute.scale, left : objResult.relative.left, top : objResult.relative.top });

    return objResult;
  },
/*-----* getCenterInfo *------------------------------------------------------*/
  getCenterInfo : function()
  {
    return this.k2goTileViewer("getPositionInfo", _getCenterInfo().offset);
  },
/*-----* getBoundsInfo *------------------------------------------------------*/
  getBoundsInfo : function()
  {
    var $parent   = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").parent();
    var objResult = {};

    objResult.leftTop     = this.k2goTileViewer("getPositionInfo", { left : $parent.offset().left                  , top : $parent.offset().top                    });
    objResult.leftBottom  = this.k2goTileViewer("getPositionInfo", { left : $parent.offset().left                  , top : $parent.offset().top + $parent.height() });
    objResult.rightTop    = this.k2goTileViewer("getPositionInfo", { left : $parent.offset().left + $parent.width(), top : $parent.offset().top                    });
    objResult.rightBottom = this.k2goTileViewer("getPositionInfo", { left : $parent.offset().left + $parent.width(), top : $parent.offset().top + $parent.height() });

    return objResult;
  },
/******************************************************************************/
/* getXXXXXPosition                                                           */
/******************************************************************************/
  getRelativePosition : function(pPositionInfo) { return _getRelativePosition(pPositionInfo); },
  getAbsolutePosition : function(pPositionInfo) { return _getAbsolutePosition(pPositionInfo); },
  getDegreesPosition  : function(pPositionInfo) { return _getDegreesPosition (pPositionInfo); }
};
/******************************************************************************/
/* _create                                                                    */
/******************************************************************************/
function _create(pPositionInfo)
{
  try
  {
    _abortLoadImages();

    var $main       = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var aryEntities = $main.data("entities.k2goTileViewer");

    $main.css(
    {
      width  :       $main.data("options.k2goTileViewer").drawingSize       * 100 + "%",
      height :       $main.data("options.k2goTileViewer").drawingSize       * 100 + "%",
      left   : ((1 - $main.data("options.k2goTileViewer").drawingSize) / 2) * 100 + "%",
      top    : ((1 - $main.data("options.k2goTileViewer").drawingSize) / 2) * 100 + "%"
    });

    var intScale      = _getAdjustScale(pPositionInfo.scale, pPositionInfo.width, pPositionInfo.height);
    var objTileInfo   = _getTileInfo   ({ scale : intScale, left : pPositionInfo.left, top : pPositionInfo.top });
    var objCenterInfo = _getCenterInfo ();

    objTileInfo.left = objCenterInfo.position.left + objTileInfo.left;
    objTileInfo.top  = objCenterInfo.position.top  + objTileInfo.top;

    $main.data    ("options.k2goTileViewer"  ).scale = intScale;
    $main.find    (".k2go-tile-viewer-entity").detach();
    $main.children()                          .remove();

    for (var i01 = 0; i01 < aryEntities.length; i01++)
    {
      var objEntity = aryEntities[i01];
      objEntity.tileInfo = _getTileInfo({ scale : intScale, left : objEntity.center.relative.left, top : objEntity.center.relative.top });
    }

    $main.append(_getTileElement(objTileInfo));
    $main.css   ("backgroundImage", "");

    if (typeof $main.data("options.k2goTileViewer").backgroundImage == "string")
    {
      var $imageLoader = $("<img></img>");

      $imageLoader.on("load", function()
      {
        var objScaleSize = _getScaleSize            (intScale);
        var objPosition  = _getUpperLeftTilePosition();

        $main.css(
        {
          backgroundImage    : "url('" + $main.data("options.k2goTileViewer").backgroundImage + "')",
          backgroundPosition : objPosition .left  + "px " + objPosition .top    + "px",
          backgroundSize     : objScaleSize.width + "px " + objScaleSize.height + "px"
        });
      });

      $imageLoader.attr("src", $main.data("options.k2goTileViewer").backgroundImage);
    }

    _increment();
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _create error: " + pError);
  }
}
/******************************************************************************/
/* _increment                                                                 */
/******************************************************************************/
function _increment()
{
  try
  {
/*-----* variable *-----------------------------------------------------------*/
    var $main             = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var intWidth          = $main.width ();
    var intHeight         = $main.height();
    var objTileInfo       = { width : $main.children(":first").data("tileInfo.k2goTileViewer").width, height : $main.children(":first").data("tileInfo.k2goTileViewer").height };
    var objCenterInfo     = _getCenterInfo      ();
    var objCenterPosition = _getRelativePosition({ offset : objCenterInfo.offset });
    var objCenterTileInfo = _getTileInfo        ({ scale  : $main.data("options.k2goTileViewer").scale, left : objCenterPosition.left, top : objCenterPosition.top });
/*-----* _appendCenterTile *--------------------------------------------------*/
    function _appendCenterTile()
    {
      objCenterTileInfo.left = objCenterInfo.position.left + objCenterTileInfo.left;
      objCenterTileInfo.top  = objCenterInfo.position.top  + objCenterTileInfo.top;

      $main.append(_getTileElement(objCenterTileInfo));
    }
/*-----* remove right *-------------------------------------------------------*/
    if ($main.children().length > 0)
    {
      var intLeft = $main.children(":last").position().left;

      while (intWidth < intLeft)
      {
        $main.children().each(function(pIndex, pElement)
        {
          if (Math.round($(pElement).position().left) == Math.round(intLeft))
          {
            $(pElement).find  (".k2go-tile-viewer-entity").detach();
            $(pElement).remove();
          }
        });

        if ($main.children().length <= 1) break;
        intLeft = $main.children(":last").position().left;
      }
    }
    else
      _appendCenterTile();
/*-----* remove left *--------------------------------------------------------*/
    if ($main.children().length > 0)
    {
      var intLeft  = $main.children(":first").position().left;
      var intRight = $main.children(":first").data("tileInfo.k2goTileViewer").width + intLeft;

      while (intRight < 0)
      {
        $main.children().each(function(pIndex, pElement)
        {
          if (Math.round($(pElement).position().left) == Math.round(intLeft))
          {
            $(pElement).find  (".k2go-tile-viewer-entity").detach();
            $(pElement).remove();
          }
        });

        if ($main.children().length <= 1) break;
        intLeft  = $main.children(":first").position().left;
        intRight = $main.children(":first").data("tileInfo.k2goTileViewer").width + intLeft;
      }
    }
    else
      _appendCenterTile();
/*-----* remove bottom *------------------------------------------------------*/
    if ($main.children().length > 0)
    {
      var intTop = $main.children(":last").position().top;

      while (intHeight < intTop)
      {
        $main.children().each(function(pIndex, pElement)
        {
          if (Math.round($(pElement).position().top) == Math.round(intTop))
          {
            $(pElement).find  (".k2go-tile-viewer-entity").detach();
            $(pElement).remove();
          }
        });

        if ($main.children().length <= 1) break;
        intTop = $main.children(":last").position().top;
      }
    }
    else
      _appendCenterTile();
/*-----* remove top *---------------------------------------------------------*/
    if ($main.children().length > 0)
    {
      var intTop    = $main.children(":first").position().top;
      var intBottom = $main.children(":first").data("tileInfo.k2goTileViewer").height + intTop;

      while (intBottom < 0)
      {
        $main.children().each(function(pIndex, pElement)
        {
          if (Math.round($(pElement).position().top) == Math.round(intTop))
          {
            $(pElement).find  (".k2go-tile-viewer-entity").detach();
            $(pElement).remove();
          }
        });

        if ($main.children().length <= 1) break;
        intTop    = $main.children(":first").position().top;
        intBottom = $main.children(":first").data("tileInfo.k2goTileViewer").height + intTop;
      }
    }
    else
      _appendCenterTile();
/*-----* append right *-------------------------------------------------------*/
    if ($main.children().length < 1) _appendCenterTile();

    var intLeft  = $main.children(":last").position().left;
    var intRight = $main.children(":last").data("tileInfo.k2goTileViewer").width + intLeft;

    while (intRight < intWidth)
    {
      $main.children().each(function(pIndex, pElement)
      {
        if (Math.round($(pElement).position().left) == Math.round(intLeft))
        {
          objTileInfo.x    = $(pElement).data("tileInfo.k2goTileViewer").x + 1;
          objTileInfo.y    = $(pElement).data("tileInfo.k2goTileViewer").y;
          objTileInfo.left = $(pElement).position().left + objTileInfo.width;
          objTileInfo.top  = $(pElement).position().top;

          $(pElement).after(_getTileElement(objTileInfo));
        }
      });

      intLeft  = $main.children(":last").position().left;
      intRight = $main.children(":last").data("tileInfo.k2goTileViewer").width + intLeft;
    }
/*-----* prepend left *-------------------------------------------------------*/
    var intLeft = $main.children(":first").position().left;

    while (intLeft > 0)
    {
      $main.children().each(function(pIndex, pElement)
      {
        if (Math.round($(pElement).position().left) == Math.round(intLeft))
        {
          objTileInfo.x    = $(pElement).data("tileInfo.k2goTileViewer").x - 1;
          objTileInfo.y    = $(pElement).data("tileInfo.k2goTileViewer").y;
          objTileInfo.left = $(pElement).position().left - objTileInfo.width;
          objTileInfo.top  = $(pElement).position().top;

          $(pElement).before(_getTileElement(objTileInfo));
        }
      });

      intLeft = $main.children(":first").position().left;
    }
/*-----* append bottom *------------------------------------------------------*/
    var intTop    = $main.children(":last").position().top;
    var intBottom = $main.children(":last").data("tileInfo.k2goTileViewer").height + intTop;

    while (intBottom < intHeight)
    {
      $main.children().each(function(pIndex, pElement)
      {
        if (Math.round($(pElement).position().top) == Math.round(intTop))
        {
          objTileInfo.x    = $(pElement).data("tileInfo.k2goTileViewer").x;
          objTileInfo.y    = $(pElement).data("tileInfo.k2goTileViewer").y + 1;
          objTileInfo.left = $(pElement).position().left;
          objTileInfo.top  = $(pElement).position().top + objTileInfo.height;

          $(pElement).after(_getTileElement(objTileInfo));
        }
      });

      intTop    = $main.children(":last").position().top;
      intBottom = $main.children(":last").data("tileInfo.k2goTileViewer").height + intTop;
    }
/*-----* prepend top *--------------------------------------------------------*/
    var intTop = $main.children(":first").position().top;

    while (intTop > 0)
    {
      $main.children().each(function(pIndex, pElement)
      {
        if (Math.round($(pElement).position().top) == Math.round(intTop))
        {
          objTileInfo.x    = $(pElement).data("tileInfo.k2goTileViewer").x;
          objTileInfo.y    = $(pElement).data("tileInfo.k2goTileViewer").y - 1;
          objTileInfo.left = $(pElement).position().left;
          objTileInfo.top  = $(pElement).position().top - objTileInfo.height;

          $(pElement).before(_getTileElement(objTileInfo));
        }
      });

      intTop = $main.children(":first").position().top;
    }
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _increment error: " + pError);
  }
}
/******************************************************************************/
/* _move                                                                      */
/******************************************************************************/
function _move(pPosition)
{
  try
  {
    var $main       = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var objPosition = $.extend({ left : 0, top : 0 }, pPosition);

    if ($main.data("options.k2goTileViewer").disableMove) return;

    $main.children().css({ left:"+=" + objPosition.left, top:"+=" + objPosition.top });

    if (typeof $main.data("options.k2goTileViewer").backgroundImage == "string")
    {
      var intLeft = parseFloat($main.css("backgroundPosition").split(" ")[0]);
      var intTop  = parseFloat($main.css("backgroundPosition").split(" ")[1]);

      $main.css("backgroundPosition", (intLeft + objPosition.left) + "px " + (intTop + objPosition.top) + "px");
    }

    if (typeof $main.data("options.k2goTileViewer").move == "function") setTimeout(function() { $main.data("options.k2goTileViewer").move(objPosition); }, 1);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _move error: " + pError);
  }
}
/******************************************************************************/
/* _moveAdjust                                                                */
/******************************************************************************/
function _moveAdjust()
{
  try
  {
    var $main       = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $parent     = $main.parent();
    var objScale    = $main.data("options.k2goTileViewer").scales[$main.data("options.k2goTileViewer").scale];
    var $left       = $main.children("[x=0]");
    var $right      = $main.children("[x=" + (objScale.count - 1) + "]");
    var $top        = $main.children("[y=0]");
    var $bottom     = $main.children("[y=" + (objScale.count - 1) + "]");
    var objPosition = { left : 0, top : 0 };

    if ($left  .length > 0 && $left  .offset().left                    > $parent.offset().left + $parent.width ()) objPosition.left = $parent.offset().left + $parent.width () - $left  .offset().left - $left  .width () / 2;
    if ($top   .length > 0 && $top   .offset().top                     > $parent.offset().top  + $parent.height()) objPosition.top  = $parent.offset().top  + $parent.height() - $top   .offset().top  - $top   .height() / 2;
    if ($right .length > 0 && $right .offset().left + $right .width () < $parent.offset().left                   ) objPosition.left = $parent.offset().left                    - $right .offset().left - $right .width () / 2;
    if ($bottom.length > 0 && $bottom.offset().top  + $bottom.height() < $parent.offset().top                    ) objPosition.top  = $parent.offset().top                     - $bottom.offset().top  - $bottom.height() / 2;

    if (objPosition.left != 0 || objPosition.top != 0) _move(objPosition);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _moveAdjust error: " + pError);
  }
}
/******************************************************************************/
/* _createClone                                                               */
/******************************************************************************/
function _createClone(pPosition)
{
  try
  {
    var $main   = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $clone  = $main.clone ();
    var $parent = $main.parent();

    if (typeof pPosition == "undefined")
    {
      pPosition   = {};
      pPosition.x = $parent.offset().left + $parent.width () / 2;
      pPosition.y = $parent.offset().top  + $parent.height() / 2;
    }

    $clone.find    (".k2go-tile-viewer-entity").remove();
    $clone.addClass( "k2go-tile-viewer-clone");
    $clone.data    ("cloneInfo.k2goTileViewer", { x : pPosition.x, y : pPosition.y, scale : 1 });
    $clone.css     ({ left : $main.position().left, top : $main.position().top, transformOrigin : (pPosition.x - $main.offset().left) + "px " + (pPosition.y - $main.offset().top) + "px" });
    $clone.on      ("contextmenu.k2goTileViewer", function(){ return false; });
    $main .after   ($clone);
    $main .css     ("opacity", "0");
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _createClone error: " + pError);
  }
}
/******************************************************************************/
/* _removeClone                                                               */
/******************************************************************************/
function _removeClone(pCallBack, pArgs)
{
  try
  {
    var $main           = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $clone          = $(".k2go-tile-viewer-clone");
    var $parent         = $main  .parent ();
    var intScaleCount   = $main  .data   ("options.k2goTileViewer").scales[$main.data("options.k2goTileViewer").scale].count - 1;
    var intImageCount   = Array  .isArray($main.data("options.k2goTileViewer").foregroundImages) ? $main.data("options.k2goTileViewer").foregroundImages.length : 0;
    var intParentLeft   = $parent.offset ().left;
    var intParentTop    = $parent.offset ().top;
    var intParentRight  = $parent.width  () + intParentLeft;
    var intParentBottom = $parent.height () + intParentTop;
    var intTimer        = Date.now();

    setTimeout(function _sleep()
    {
      var flgComplate = true;

      $main.children().each(function(pIndex, pElement)
      {
        var objTileInfo = $(pElement).data("tileInfo.k2goTileViewer");

        if (0 <= objTileInfo.x && objTileInfo.x <= intScaleCount && 0 <= objTileInfo.y && objTileInfo.y <= intScaleCount)
        {
          var intLeft   = $(pElement).offset().left;
          var intTop    = $(pElement).offset().top;
          var intRight  = $(pElement).width () + intLeft;
          var intBottom = $(pElement).height() + intTop;

          if ((intParentLeft <= intLeft  && intLeft  <= intParentRight && (intParentTop <= intTop && intTop <= intParentBottom || intParentTop <= intBottom && intBottom <= intParentBottom))
          ||  (intParentLeft <= intRight && intRight <= intParentRight && (intParentTop <= intTop && intTop <= intParentBottom || intParentTop <= intBottom && intBottom <= intParentBottom)))
          {
            if ($(pElement).children(".k2go-tile-viewer-image").length + $(pElement).children(".k2go-tile-viewer-no-image").length < intImageCount)
            {
              flgComplate = false;
              return false;
            }
          }
        }
      });

      if (!flgComplate && Date.now() - intTimer < $main.data("options.k2goTileViewer").timeout)
      {
        setTimeout(_sleep, 100);
      }
      else
      {
        $main .css    ("opacity", "");
        $clone.fadeOut(200      , function(){ $clone.remove(); });

        if (typeof pCallBack == "function") setTimeout(function() { pCallBack(pArgs); }, 1);
      }
    }, 1);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _removeClone error: " + pError);
  }
}
/******************************************************************************/
/* _zoom                                                                      */
/******************************************************************************/
function _zoom()
{
  try
  {
/*-----* variable *-----------------------------------------------------------*/
    var $main              = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $clone             = $(".k2go-tile-viewer-clone");
    var $parent            = $main.parent();
    var aryScales          = $main.data  ("options.k2goTileViewer").scales;
    var intScaleBefore     = $main.data  ("options.k2goTileViewer").scale;
    var intScaleAfter      = 0;
    var objScaleSizeBefore = _getScaleSize(intScaleBefore);
    var objScaleSizeAfter  = { width : objScaleSizeBefore.width * $clone.data("cloneInfo.k2goTileViewer").scale, height : objScaleSizeBefore.height * $clone.data("cloneInfo.k2goTileViewer").scale };
/*-----* after scale *--------------------------------------------------------*/
    for (var i01 = 1; i01 < aryScales.length; i01++)
    {
      var objScaleSizeClosest = _getScaleSize(intScaleAfter);
      var objScaleSizeCurrent = _getScaleSize(i01     );
      var intClosestDiff      = Math.abs(objScaleSizeAfter.width - objScaleSizeClosest.width);
      var intCurrentDiff      = Math.abs(objScaleSizeAfter.width - objScaleSizeCurrent.width);

      if (intCurrentDiff < intClosestDiff) intScaleAfter = i01;
    }

    objScaleSizeAfter = _getScaleSize(intScaleAfter);
/*-----* after center tile *--------------------------------------------------*/
    var objCenterInfo = _getCenterInfo           ();
    var objPosition   = _getUpperLeftTilePosition();

    objPosition.left += $main.offset().left;
    objPosition.top  += $main.offset().top;
    objPosition.left  = ($clone.data("cloneInfo.k2goTileViewer").x - objPosition.left) / objScaleSizeBefore.width;
    objPosition.top   = ($clone.data("cloneInfo.k2goTileViewer").y - objPosition.top ) / objScaleSizeBefore.height;
    objPosition.left  =  $clone.data("cloneInfo.k2goTileViewer").x - objScaleSizeAfter.width  * objPosition.left;
    objPosition.top   =  $clone.data("cloneInfo.k2goTileViewer").y - objScaleSizeAfter.height * objPosition.top;
    objPosition.left  = (objCenterInfo.offset.left - objPosition.left) / objScaleSizeAfter.width;
    objPosition.top   = (objCenterInfo.offset.top  - objPosition.top ) / objScaleSizeAfter.height;
/*-----* create *-------------------------------------------------------------*/
    _create     ({ scale : intScaleAfter, width : $parent.width(), height : $parent.height(), left : objPosition.left, top : objPosition.top });
    _removeClone($main.data("options.k2goTileViewer").zoomEnd, { beforeScale : intScaleBefore, afterScale : intScaleAfter });
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _zoom error: " + pError);
  }
}
/******************************************************************************/
/* _getCenterInfo                                                             */
/******************************************************************************/
function _getCenterInfo()
{
  try
  {
    var $main         = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $parent       = $main.parent();
    var objCenterInfo = { position : {}, offset : {} };

    objCenterInfo.position.left = $parent.width () / 2        - $main.position().left;
    objCenterInfo.position.top  = $parent.height() / 2        - $main.position().top;
    objCenterInfo.offset  .left = objCenterInfo.position.left + $main.offset  ().left;
    objCenterInfo.offset  .top  = objCenterInfo.position.top  + $main.offset  ().top;

    return objCenterInfo;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getCenterInfo error: " + pError);
  }
}
/******************************************************************************/
/* _getUpperLeftTilePosition                                                  */
/******************************************************************************/
function _getUpperLeftTilePosition()
{
  try
  {
    var $tile       = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").children(":first");
    var objPosition = {};

    objPosition.left = $tile.position().left - $tile.data("tileInfo.k2goTileViewer").width  * $tile.data("tileInfo.k2goTileViewer").x;
    objPosition.top  = $tile.position().top  - $tile.data("tileInfo.k2goTileViewer").height * $tile.data("tileInfo.k2goTileViewer").y;

    return objPosition;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getUpperLeftTilePosition error: " + pError);
  }
}
/******************************************************************************/
/* _getTileInfo                                                               */
/******************************************************************************/
function _getTileInfo(pPosition)
{
  try
  {
    var $main     = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var objScale  = $main.data("options.k2goTileViewer").scales[pPosition.scale];
    var objResult = {};

    objResult.width  = objScale .width  * objScale.size;
    objResult.height = objScale .height * objScale.size;
    objResult.left   = objResult.width  * objScale.count * pPosition.left;
    objResult.top    = objResult.height * objScale.count * pPosition.top;
    objResult.x      = Math.floor(objResult.left / objResult.width );
    objResult.y      = Math.floor(objResult.top  / objResult.height);
    objResult.left   = (objResult.left - objResult.width  * objResult.x) * -1;
    objResult.top    = (objResult.top  - objResult.height * objResult.y) * -1;

    return objResult;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getTileInfo error: " + pError);
  }
}
/******************************************************************************/
/* _getTileElement                                                            */
/******************************************************************************/
function _getTileElement(pTileInfo)
{
  try
  {
/*-----* variable *-----------------------------------------------------------*/
    var $main           = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $parent         = $main.parent ();
    var objScale        = $main.data( "options.k2goTileViewer").scales[$main.data("options.k2goTileViewer").scale];
    var aryEntities     = $main.data("entities.k2goTileViewer");
    var $tile           = $("<div></div>");
    var intParentLeft   = $parent.offset().left;
    var intParentTop    = $parent.offset().top;
    var intParentRight  = $parent.width () + intParentLeft;
    var intParentBottom = $parent.height() + intParentTop;
/*-----* create tile element *------------------------------------------------*/
    $tile.data("tileInfo.k2goTileViewer", { x    : pTileInfo.x          , y   : pTileInfo.y         , width : pTileInfo.width       , height : pTileInfo.height        });
    $tile.attr(                           { x    : pTileInfo.x          , y   : pTileInfo.y                                                                            });
    $tile.css (                           { left : pTileInfo.left + "px", top : pTileInfo.top + "px", width : pTileInfo.width + "px", height : pTileInfo.height + "px" });
/*-----* append image *-------------------------------------------------------*/
    if (Array.isArray($main.data("options.k2goTileViewer").foregroundImages)
    &&  0 <= pTileInfo.x && pTileInfo.x < objScale.count
    &&  0 <= pTileInfo.y && pTileInfo.y < objScale.count)
    {
      var intLeft   = pTileInfo.left   + $main.offset().left;
      var intTop    = pTileInfo.top    + $main.offset().top;
      var intRight  = pTileInfo.width  + intLeft;
      var intBottom = pTileInfo.height + intTop;

      if ((intParentLeft <= intLeft  && intLeft  <= intParentRight && (intParentTop <= intTop && intTop <= intParentBottom || intParentTop <= intBottom && intBottom <= intParentBottom))
      ||  (intParentLeft <= intRight && intRight <= intParentRight && (intParentTop <= intTop && intTop <= intParentBottom || intParentTop <= intBottom && intBottom <= intParentBottom)))
      {
        $.each($main.data("options.k2goTileViewer").foregroundImages, function(pIndex, pUrl) {                         _appendTileImage($tile, objScale, pIndex, pUrl);          });
      }
      else
      {
        $.each($main.data("options.k2goTileViewer").foregroundImages, function(pIndex, pUrl) { setTimeout(function() { _appendTileImage($tile, objScale, pIndex, pUrl); }, 100); });
      }
    }
/*-----* append entity *------------------------------------------------------*/
    for (var i01 = 0; i01 < aryEntities.length; i01++)
    {
      var objEntity = aryEntities[i01];

      if (objEntity.tileInfo.x == pTileInfo.x && objEntity.tileInfo.y == pTileInfo.y)
      {
        _appendEntity($tile, objEntity);
      }
    }

    if (typeof $main.data("options.k2goTileViewer").addTile == "function") setTimeout(function() { $main.data("options.k2goTileViewer").addTile($tile, $tile.data("tileInfo.k2goTileViewer")); }, 1);

    return $tile;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getTileElement error: " + pError);
  }
}
/******************************************************************************/
/* _appendTileImage                                                           */
/******************************************************************************/
function _appendTileImage(pTileElement, pScaleInfo, pIndex, pUrl)
{
  try
  {
    if (pTileElement.length == 0) return;

    var strDataName = "image" + pIndex + ".k2goTileViewer";

    pTileElement.data(strDataName, $("<img class='k2go-tile-viewer-image'></img>"));

    pTileElement.data(strDataName).on("load", function()
    {
      setTimeout(function()
      {
        pTileElement.append    (pTileElement.data(strDataName));
        pTileElement.removeData(strDataName                   );
      }, 1);
    });

    pTileElement.data(strDataName).on("error", function()
    {
      setTimeout(function()
      {
        pTileElement.append    ("<div class='k2go-tile-viewer-no-image'></div>");
        pTileElement.removeData(strDataName                                    );
      }, 1);
    });

    pTileElement.data(strDataName).css ("zIndex", pIndex);
    pTileElement.data(strDataName).attr("src"   , _formatUrl(pUrl, pTileElement.data("tileInfo.k2goTileViewer"), pScaleInfo));
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _appendTileImage error: " + pError);
  }
}
/******************************************************************************/
/* _abortLoadImages                                                           */
/******************************************************************************/
function _abortLoadImages()
{
  try
  {
    var $main         = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var intImageCount = Array.isArray($main.data("options.k2goTileViewer").foregroundImages) ? $main.data("options.k2goTileViewer").foregroundImages.length : 0;

    $main.children().each(function(pIndex, pElement)
    {
      for (var i01 = 0; i01 < intImageCount; i01++)
      {
        var strDataName = "image" + i01 + ".k2goTileViewer";
        var $image      = $(pElement).data(strDataName);

        if ($image instanceof jQuery)
        {
          $image     .attr      ("src", "");
          $(pElement).removeData(strDataName);
        }
      }
    });
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _abortLoadImages error: " + pError);
  }
}
/******************************************************************************/
/* _appendEntity                                                              */
/******************************************************************************/
function _appendEntity(pTileElement, pEntity)
{
  try
  {
    if (pTileElement.length == 0) return;

    var $main    = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var intIndex = Array.isArray($main.data("options.k2goTileViewer").foregroundImages) ? $main.data("options.k2goTileViewer").foregroundImages.length : 0;

    if ("size" in pEntity)
    {
      var objScaleSize = _getScaleSize($main.data("options.k2goTileViewer").scale);
      pEntity.element.css({ width : objScaleSize.width * pEntity.size.relative.width + "px", height : objScaleSize.height * pEntity.size.relative.height + "px" });
    }

    pEntity     .element.css   ({ left : pEntity.tileInfo.left * -1 - pEntity.element.width() / 2 + "px", top : pEntity.tileInfo.top * -1 - pEntity.element.height() / 2 + "px", zIndex : intIndex });
    pTileElement        .append(pEntity.element);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _appendEntity error: " + pError);
  }
}
/******************************************************************************/
/* _getScaleSize                                                              */
/******************************************************************************/
function _getScaleSize(pScale)
{
  try
  {
    var objScale  = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales[pScale];
    var objSize   = {};

    objSize.width  = objScale.width  * objScale.size * objScale.count;
    objSize.height = objScale.height * objScale.size * objScale.count;

    return objSize;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getScaleSize error: " + pError);
  }
}
/******************************************************************************/
/* _getAdjustScale                                                            */
/******************************************************************************/
function _getAdjustScale(pScale, pWidth, pHeight)
{
  try
  {
    var $main           = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
    var $parent         = $main.parent();
    var aryScales       = $main.data  ("options.k2goTileViewer").scales;
    var objScaleSize    = _getScaleSize(pScale);
    var intWidth        = Math.floor(pWidth ) / objScaleSize.width;
    var intHeight       = Math.floor(pHeight) / objScaleSize.height;
    var intParentWidth  = $parent.width () + 1;
    var intParentHeight = $parent.height() + 1;

    for (var intScale = aryScales.length - 1; intScale >= 0; intScale--)
    {
      objScaleSize = _getScaleSize(intScale);

      if (objScaleSize.width  * intWidth  <= intParentWidth
      &&  objScaleSize.height * intHeight <= intParentHeight)
      {
        break;
      }
    }

    return intScale >= 0 ? intScale : 0;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getAdjustScale error: " + pError);
  }
}
/******************************************************************************/
/* _getRelativePosition                                                       */
/******************************************************************************/
function _getRelativePosition(pPositionInfo)
{
  try
  {
    var objPosition = { left : 0, top : 0 };
/*-----* absolute *-----------------------------------------------------------*/
    if ("absolute" in pPositionInfo)
    {
      var objScaleSize = _getScaleSize(pPositionInfo.absolute.scale);

      objPosition.left = pPositionInfo.absolute.left / objScaleSize.width;
      objPosition.top  = pPositionInfo.absolute.top  / objScaleSize.height;
    }
/*-----* offset *-------------------------------------------------------------*/
    else if ("offset" in pPositionInfo)
    {
      return _getRelativePosition({ absolute : _getAbsolutePosition(pPositionInfo) });
    }
/*-----* degrees *------------------------------------------------------------*/
    else if ("degrees" in pPositionInfo)
    {
      pPositionInfo.degrees.scale = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales.length - 1;
      return _getRelativePosition({ absolute : _getAbsolutePosition(pPositionInfo) });
    }

    return objPosition;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getRelativePosition error: " + pError);
  }
}
/******************************************************************************/
/* _getAbsolutePosition                                                       */
/******************************************************************************/
function _getAbsolutePosition(pPositionInfo)
{
  try
  {
    var objPosition = { scale : 0, left : 0, top : 0 };
/*-----* relative *-----------------------------------------------------------*/
    if ("relative" in pPositionInfo)
    {
      var objScaleSize = _getScaleSize(pPositionInfo.relative.scale);

      objPosition.scale =                       pPositionInfo.relative.scale;
      objPosition.left  = objScaleSize.width  * pPositionInfo.relative.left;
      objPosition.top   = objScaleSize.height * pPositionInfo.relative.top;
    }
/*-----* offset *-------------------------------------------------------------*/
    else if ("offset" in pPositionInfo)
    {
      var $main = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");

      objPosition        = _getUpperLeftTilePosition();
      objPosition.scale  = $main.data("options.k2goTileViewer").scale;
      objPosition.left  += $main.offset().left;
      objPosition.top   += $main.offset().top;
      objPosition.left   = pPositionInfo.offset.left - objPosition.left;
      objPosition.top    = pPositionInfo.offset.top  - objPosition.top;
    }
/*-----* degrees(standard) *--------------------------------------------------*/
    else if ("degrees" in pPositionInfo)
    {
      var $main             = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
      var objScale          = $main.data("options.k2goTileViewer").scales[pPositionInfo.degrees.scale];
      var strGeodeticSystem = $main.data("options.k2goTileViewer").geodeticSystem;

      if (strGeodeticSystem == "standard")
      {
        var intOrginLeft = -1 * (2 * 6378137 * Math.PI /   2);
        var intOrginTop  =       2 * 6378137 * Math.PI /   2;
        var intUnit      =       2 * 6378137 * Math.PI / (objScale.width * objScale.size) / Math.pow(2, objScale.zoom);

        objPosition.scale =                            pPositionInfo.degrees.scale;
        objPosition.left  =                            pPositionInfo.degrees.left                                          * 20037508.34 / 180.0;
        objPosition.top   = (Math.log(Math.tan((90.0 + pPositionInfo.degrees.top) * Math.PI / 360.0)) / (Math.PI / 180.0)) * 20037508.34 / 180.0;
        objPosition.left  = (objPosition.left - intOrginLeft   ) / intUnit;
        objPosition.top   = (intOrginTop      - objPosition.top) / intUnit;
      }
/*-----* degrees(himawari.fd) *-----------------------------------------------*/
      else if (strGeodeticSystem == "himawari8.fd")
      {
        var objScaleSize = _getScaleSize(pPositionInfo.degrees.scale);
        var objMargin    = { top : 0.006, right : 0.0045, bottom : 0.006, left : 0.0045 };
        var intLeft      = ((pPositionInfo.degrees.left + 180 - 140.7) % 360.0 - 180.0) / 180.0 * Math.PI;
        var intTop       = ((pPositionInfo.degrees.top  + 90.0       ) % 180.0 -  90.0) / 180.0 * Math.PI;
        var intRadius    = objScaleSize.width * (1.0 - objMargin.right - objMargin.left)   / 2;
        var e2           = 0.00669438003;
        var n            = intRadius / Math.sqrt(1.0 - e2 * Math.sin(intTop) * Math.sin(intTop));
        var theta        = 0.1535;
        var f            = 6.613;
        var vrad         = 81.3025 / 180.0 * Math.PI;

        if (intLeft < -vrad) intLeft = -vrad;
        if (intLeft >  vrad) intLeft =  vrad;
        if (intTop  < -vrad) intTop  = -vrad;
        if (intTop  >  vrad) intTop  =  vrad;

        var z = intRadius * f - (n * Math.cos(intTop) * Math.cos(intLeft));

        objPosition.scale = pPositionInfo.degrees.scale;
        objPosition.left  =  n * Math.cos(intTop) * Math.sin(intLeft);
        objPosition.top   = (n * (1.0 - e2))      * Math.sin(intTop );
        objPosition.left  = objScaleSize.width / 2 * Math.atan(objPosition.left / z) / theta;
        objPosition.top   = objScaleSize.width / 2 * Math.atan(objPosition.top  / z) / theta;
        objPosition.left += objScaleSize.width / 2;
        objPosition.top   = objScaleSize.width / 2 - objPosition.top;
      }
/*-----* degrees(himawari.jp) *-----------------------------------------------*/
      else if (strGeodeticSystem == "himawari8.jp")
      {
        var objScaleSize = _getScaleSize(pPositionInfo.degrees.scale);
        var intX         = (pPositionInfo.degrees.left + 180) % 360 - 180;
        var intY         = (pPositionInfo.degrees.top  +  90) % 180 -  90;

        if (intX < 119  ) intX = 119;
        if (intX > 152  ) intX = 152;
        if (intY <  21.5) intY =  21.5;
        if (intY >  48.5) intY =  48.5;

        objPosition.scale = pPositionInfo.degrees.scale;
        objPosition.left  = objScaleSize.width  *      (intX - 119.0) / (152.0 - 119.0);
        objPosition.top   = objScaleSize.height * (1 - (intY -  21.5) / ( 48.5 -  21.5));
      }
    }

    return objPosition;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getAbsolutePosition error: " + pError);
  }
}
/******************************************************************************/
/* _getDegreesPosition                                                        */
/******************************************************************************/
function _getDegreesPosition(pPositionInfo)
{
  try
  {
    var objPosition = { left : 0, top : 0 };
/*-----* absolute(standard) *-------------------------------------------------*/
    if ("absolute" in pPositionInfo)
    {
      var $main             = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)");
      var objScale          = $main.data("options.k2goTileViewer").scales[pPositionInfo.absolute.scale];
      var strGeodeticSystem = $main.data("options.k2goTileViewer").geodeticSystem;

      if (strGeodeticSystem == "standard")
      {
        var intOrgLeft = -1 * (2 * 6378137 * Math.PI / 2);
        var intOrgTop  =       2 * 6378137 * Math.PI / 2;
        var intUnit    =       2 * 6378137 * Math.PI / (objScale.width * objScale.size) / Math.pow(2, objScale.zoom);

        objPosition.left = intOrgLeft + pPositionInfo.absolute.left * intUnit;
        objPosition.top  = intOrgTop  - pPositionInfo.absolute.top  * intUnit;
        objPosition.left =                    objPosition.left * 180     / 20037508.34;
        objPosition.top  = Math.atan(Math.exp(objPosition.top  * Math.PI / 20037508.34)) * 360 / Math.PI - 90; 
      }
/*-----* absolute(himawari.fd) *----------------------------------------------*/
      else if (strGeodeticSystem == "himawari8.fd")
      {
        var objScaleSize = _getScaleSize(pPositionInfo.absolute.scale);
        var DEGTORAD     = Math.PI / 180.0;
        var RADTODEG     = 180.0 / Math.PI;
        var SCLUNIT      = 1.525878906250000e-05;
        var coff         = 5500.5;
        var loff         = 5500.5;
        var cfac         = 40932549;
        var lfac         = 40932549;
        var satDis       = 42164.0;
        var projParam3   = 1.006739501;
        var projParamSd  = 1737122264.0;
        var subLon       = 140.7;
        var c            = 11000 * (pPositionInfo.absolute.left / objScaleSize.width );
        var l            = 11000 * (pPositionInfo.absolute.top  / objScaleSize.height);
        var x            = DEGTORAD * (c - coff) / (SCLUNIT * cfac);
        var y            = DEGTORAD * (l - loff) / (SCLUNIT * lfac);
        var Sd           = (satDis * Math.cos(x) * Math.cos(y)) * (satDis * Math.cos(x) * Math.cos(y)) - (Math.cos(y) * Math.cos(y) + projParam3 * Math.sin(y) * Math.sin(y)) * projParamSd;

        Sd = Math.sqrt(Sd);

        var Sn           = (satDis * Math.cos(x) * Math.cos(y) - Sd) / (Math.cos(y) * Math.cos(y) + projParam3 * Math.sin(y) * Math.sin(y));
        var S1           =  satDis - (Sn * Math.cos(x) * Math.cos(y));
        var S2           =  Sn * Math.sin(x) * Math.cos(y);
        var S3           = -Sn * Math.sin(y);
        var Sxy          = Math.sqrt(S1 * S1 + S2 * S2);

        objPosition.left = RADTODEG * Math.atan2(S2, S1) + subLon;
        objPosition.top  = RADTODEG * Math.atan (projParam3 * S3 / Sxy);

        while (objPosition.left >  180.0) objPosition.left = objPosition.left - 360.0;
        while (objPosition.left < -180.0) objPosition.left = objPosition.left + 360.0;
      }
/*-----* absolute(himawari.jp) *----------------------------------------------*/
      else if (strGeodeticSystem == "himawari8.jp")
      {
        var objScaleSize = _getScaleSize(pPositionInfo.absolute.scale);

        objPosition.left = pPositionInfo.absolute.left * (152.0 - 119.0) / objScaleSize.width + 119.0;
        objPosition.top  = (1 - pPositionInfo.absolute.top / objScaleSize.height) * (48.5 - 21.5) + 21.5;
        objPosition.left = (objPosition.left + 180) % 360 - 180;
        objPosition.top  = (objPosition.top  +  90) % 180 -  90;
      }
    }
/*-----* relative *-----------------------------------------------------------*/
    else if ("relative" in pPositionInfo)
    {
      pPositionInfo.relative.scale = $(".k2go-tile-viewer-main:not(.k2go-tile-viewer-clone)").data("options.k2goTileViewer").scales.length - 1;
      return _getDegreesPosition({ absolute : _getAbsolutePosition(pPositionInfo) });
    }
/*-----* offset *-------------------------------------------------------------*/
    else if ("offset" in pPositionInfo)
    {
      return _getDegreesPosition({ absolute : _getAbsolutePosition(pPositionInfo) });
    }

    return objPosition;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _getDegreesPosition error: " + pError);
  }
}
/******************************************************************************/
/* _formatUrl                                                                 */
/******************************************************************************/
function _formatUrl(pUrl, pTileInfo, pScaleInfo)
{
  try
  {
    var strResult = pUrl;

    strResult = strResult.replace(/%x/g  ,  pTileInfo .x                        .toString());
    strResult = strResult.replace(/%y/g  ,  pTileInfo .y                        .toString());
    strResult = strResult.replace(/%ws/g , (pScaleInfo.width  * pScaleInfo.size).toString());
    strResult = strResult.replace(/%hs/g , (pScaleInfo.height * pScaleInfo.size).toString());
    strResult = strResult.replace(/%w/g  ,  pScaleInfo.width                    .toString());
    strResult = strResult.replace(/%h/g  ,  pScaleInfo.height                   .toString());
    strResult = strResult.replace(/%c/g  ,  pScaleInfo.count                    .toString());
    if (typeof pScaleInfo.zoom == "number")
    strResult = strResult.replace(/%z/g  ,  pScaleInfo.zoom                     .toString());

    return strResult;
  }
  catch(pError)
  {
    console.error("jQuery.k2goTileViewer _formatUrl error: " + pError);
  }
}
/******************************************************************************/
/* entry point                                                                */
/******************************************************************************/
$.fn.k2goTileViewer = function(pMethod)
{
       if (typeof pMethod == "object" || !pMethod) return objMethods["initialize"].apply(this, arguments);
  else if (objMethods[pMethod]                   ) return objMethods[pMethod     ].apply(this, Array.prototype.slice.call(arguments, 1));
  else                                             $.error("Method " +  pMethod + " does not exist on jQuery.k2goTileViewer");
};})(jQuery);
