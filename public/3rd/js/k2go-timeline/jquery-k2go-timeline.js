;(function($){ var objMethods = {
/******************************************************************************/
/* k2go Timeline for JQuery Plugin                                            */
/* version 1.7.0                                                              */
/* author  Inoue Computer Service.                                            */
/* Copyright (c) k2go. All rights reserved.                                   */
/* See License.txt for the license information.                               */
/******************************************************************************/
/******************************************************************************/
/* initialize                                                                 */
/******************************************************************************/
  initialize : function(pOptions, pCallback)
  {
/*-----* variable *-----------------------------------------------------------*/
    var flgTouch      = "ontouchstart"      in window;
    var flgEvent      = flgTouch && "event" in window;
    var strMouseWheel = "onwheel" in document ? "wheel" : "onmousewheel" in document ? "mousewheel" : "DOMMouseScroll";
    var $this         = this;
    var $main         = $("<div class='k2go-timeline-main'     ></div>");
    var $bar          = $("<div class='k2go-timeline-bar'      ></div>");
    var $rail         = $("<div class='k2go-timeline-rail'     ></div>");
    var $range        = $("<div class='k2go-timeline-range'    ><div class='k2go-timeline-range-left'></div><div class='k2go-timeline-range-center'></div><div class='k2go-timeline-range-right'></div></div>");
    var $pick         = $("<div class='k2go-timeline-pick'     ></div>");
    var $pickLine     = $("<div class='k2go-timeline-pick-line'></div>");
    var $pickKnob     = $("<div class='k2go-timeline-pick-knob'></div>");

    $main.on("contextmenu.k2goImageViewer", function(){ return false; });
/*-----* options *------------------------------------------------------------*/
    $main.data("options.k2goTimeline", $.extend(true,
    {
      startTime          :  new Date((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate(),  0,  0,  0,   0),
      endTime            :  new Date((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate(), 23, 59, 59, 999),
      currentTime        :  new Date(),
      minTime            :  new Date((new Date()).getFullYear() - 100, (new Date()).getMonth(), (new Date()).getDate(), (new Date()).getHours(), (new Date()).getMinutes(), (new Date()).getSeconds(), (new Date()).getMilliseconds()),
      maxTime            :  new Date((new Date()).getFullYear() + 100, (new Date()).getMonth(), (new Date()).getDate(), (new Date()).getHours(), (new Date()).getMinutes(), (new Date()).getSeconds(), (new Date()).getMilliseconds()),
      timezoneOffset     : (new Date()).getTimezoneOffset() * -1,
      jpCalendar         : false,
      minScale           : 1,
      maxScale           : 1000 * 60 * 60 * 24 * 60,
      disableMoveBar     : false,
      disableZoom        : false,
      syncPickAndBar     : false,
      clickBarToMovePick : false,
      labelPosition      : "point",
      pickLineDistance   : { element : $("body"), position : "top" }
    }, pOptions));
/******************************************************************************/
/* window.resize                                                              */
/******************************************************************************/
    $(window).on("resize.k2goTimeline", function()
    {
      try
      {
        _movePick    ($pick.offset().left + $pick.width() / 2);
        _incrementBar();
        _setLabel    ();
        _resizeBar   ();
        _moveRange   ();
      }
      catch(pError)
      {
        console.error("jQuery.k2goTimeline window.resize error: " + pError);
      }
    });
/******************************************************************************/
/* main.wheel                                                                 */
/******************************************************************************/
    $main.on(strMouseWheel + ".k2goTimeline", function(pEvent)
    {
      if (flgEvent                       ) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
      if ($main.data("lock.k2goTimeline")) return;                                           else $main.data("lock.k2goTimeline", true);

      if ($main.data("wheel.k2goTimeline"))
      {
        clearTimeout($main.data("wheel.k2goTimeline"));
      }
      else
      {
        if (typeof $main.data("options.k2goTimeline").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomStart(_getTimeInfo()); }, 1);
      }

      var intDelta = pEvent.originalEvent.deltaY ? -(pEvent.originalEvent.deltaY) : pEvent.originalEvent.wheelDelta ? pEvent.originalEvent.wheelDelta : -(pEvent.originalEvent.detail);
      var intScale = $main.data("options.k2goTimeline").scale * 0.1 * (intDelta < 0 ? 1 : -1);

      _movePick (pEvent.pageX);
      _zoomBar  (intScale);
      _setLabel ();
      _moveRange();

      $main.data("wheel.k2goTimeline", setTimeout(function()
      {
        if (typeof $main.data("options.k2goTimeline").zoomEnd == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomEnd(_getTimeInfo()); }, 1);
        $main.removeData("wheel.k2goTimeline");
      }, 500));

      $main.data("lock.k2goTimeline", false);
    });
/******************************************************************************/
/* bar.drag                                                                   */
/******************************************************************************/
/*-----* start *--------------------------------------------------------------*/
    $.each(["touchstart", "mousedown"], function()
    {
      var flgTouch = this == "touchstart" ? true : false;

      $bar.on((flgTouch ? "touchstart" : "mousedown") + ".k2goTimeline", function(pEvent)
      {
        try
        {
          if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTimeline")) return;

          var flgSingle  = flgEvent ? (event.touches.length == 1 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 1 ? true : false) : true;
          var flgDouble  = flgEvent ? (event.touches.length == 2 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 2 ? true : false) : false;
          var intBaseX1  = 0;
          var intBaseX2  = 0;
          var intMoveX1  = 0;
          var intMoveX2  = 0;
          var intBaseDis = 0;
          var intMoveDis = 0;
          var intX       = 0;
          var intScale   = 0;

          if (flgSingle)
          {
            intBaseX1 = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;

            if ($main.data("dblTap.k2goTimeline"))
            {
              _movePick(intBaseX1);
              $this      .k2goTimeline( flgTouch ? "zoomIn"   : (pEvent.which == 3 ? "zoomOut" : "zoomIn"));
              $main      .data        ("dblTap.k2goTimeline", false);
              return;
            }
            else
            {
              if ($main.data("options.k2goTimeline").clickBarToMovePick) _movePick(intBaseX1);

              $main    .data   (    "dblTap.k2goTimeline", true);
              $main    .data   (      "drag.k2goTimeline", true);
              $pickKnob.trigger("mouseenter.k2goTimeline");

              if (typeof $main.data("options.k2goTimeline").barMoveStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").barMoveStart(_getTimeInfo()); }, 1);
            }

            setTimeout(function(){ $main.data("dblTap.k2goTimeline", false); }, 300);
          }
          else if (flgDouble)
          {
            intBaseX1  = flgEvent ? event.touches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.touches[0].pageX;
            intBaseX2  = flgEvent ? event.touches[1].pageX : flgTouch ? pEvent.originalEvent.touches.item(1).pageX : pEvent.touches[1].pageX;
            intBaseDis = Math.sqrt(Math.pow(intBaseX1 - intBaseX2, 2));

            $(document).trigger((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline");
            if (typeof $main.data("options.k2goTimeline").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomStart(_getTimeInfo()); }, 1);
          }
          else
            return;
/*-----* move *---------------------------------------------------------------*/
          var fncMove = function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

              flgSingle = flgEvent ? (event.touches.length == 1 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 1 ? true : false) : true;
              flgDouble = flgEvent ? (event.touches.length == 2 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 2 ? true : false) : false;

              if (flgSingle)
              {
                intMoveX1 = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - intBaseX1;
                intBaseX1 = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);

                _moveBar  (intMoveX1, $main.data("options.k2goTimeline").syncPickAndBar);
                _setLabel ();
                _moveRange();

                if (typeof $main.data("options.k2goTimeline").barMove == "function") setTimeout(function() { $main.data("options.k2goTimeline").barMove(_getTimeInfo()); }, 1);
              }
              else if (flgDouble)
              {
                intMoveX1  = flgEvent ? event.touches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.touches[0].pageX;
                intMoveX2  = flgEvent ? event.touches[1].pageX : flgTouch ? pEvent.originalEvent.touches.item(1).pageX : pEvent.touches[1].pageX;
                intMoveDis = Math.sqrt (Math.pow(intMoveX1 - intMoveX2, 2));

                if (Math.abs(intBaseDis - intMoveDis) >= 10)
                {
                  intX       = Math.floor((intMoveX1 + intMoveX2) / 2);
                  intScale   = $main.data("options.k2goTimeline").scale * 0.1 * (intMoveDis > intBaseDis ? -1 : 1);
                  intBaseDis = intMoveDis;

                  if (!$main.data("lock.k2goTimeline"))
                  {
                    $main.data("lock.k2goTimeline", true);
                    _movePick (intX);
                    _zoomBar  (intScale);
                    _setLabel ();
                    _moveRange();
                    $main.data("lock.k2goTimeline", false);
                  }
                }
              }
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline bar.mousemove error: " + pError);
            }
          };

          document.addEventListener(flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
/*-----* end *----------------------------------------------------------------*/
          $(document).one((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline", function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

              $main      .data               (      "drag.k2goTimeline", false);
              $pickKnob  .trigger            ("mouseleave.k2goTimeline");
                document .removeEventListener( flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
              $(document).off                ((flgTouch ? "touchend"  : "mouseup"  ) + ".k2goTimeline");
              _setLabel();

              if (flgSingle)
              {
                if (typeof $main.data("options.k2goTimeline").barMoveEnd == "function") setTimeout(function() { $main.data("options.k2goTimeline").barMoveEnd(_getTimeInfo()); }, 1);
              }
              else if (flgDouble)
              {
                if (typeof $main.data("options.k2goTimeline").zoomEnd    == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomEnd   (_getTimeInfo()); }, 1);
              }
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline bar.mouseup error: " + pError);
            }
          });

          return false;
        }
        catch(pError)
        {
          console.error("jQuery.k2goTimeline bar.mousedown error: " + pError);
        }
      });
    });
/******************************************************************************/
/* range.drag                                                                 */
/******************************************************************************/
/*-----* start *--------------------------------------------------------------*/
    $.each(["touchstart", "mousedown"], function()
    {
      var flgTouch = this == "touchstart" ? true : false;

      $range.on((flgTouch ? "touchstart" : "mousedown") + ".k2goTimeline", "> *", function(pEvent)
      {
        try
        {
          if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTimeline")) return;

          var $this    = $(this);
          var intBaseX = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
          var intMoveX = 0;

          if (typeof $main.data("options.k2goTimeline").rangeMoveStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").rangeMoveStart(_getRangeInfo()); }, 1);
/*-----* move *---------------------------------------------------------------*/
          var fncMove = function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

              intMoveX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - intBaseX;
              intBaseX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);

              if ($rail.offset().left <= intBaseX && intBaseX <= $rail.offset().left + $rail.width())
              {
                     if ($this.hasClass("k2go-timeline-range-left" )) _moveRange(intMoveX, "left"  );
                else if ($this.hasClass("k2go-timeline-range-right")) _moveRange(intMoveX, "right" );
                else                                                  _moveRange(intMoveX, "center");

                if (typeof $main.data("options.k2goTimeline").rangeMove == "function") setTimeout(function() { $main.data("options.k2goTimeline").rangeMove(_getRangeInfo()); }, 1);
              }
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline range.mousemove error: " + pError);
            }
          };

          document.addEventListener(flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
/*-----* end *----------------------------------------------------------------*/
          $(document).one((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline", function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

                document .removeEventListener( flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
              $(document).off                ((flgTouch ? "touchend"  : "mouseup"  ) + ".k2goTimeline");

              if (typeof $main.data("options.k2goTimeline").rangeMoveEnd == "function") setTimeout(function() { $main.data("options.k2goTimeline").rangeMoveEnd(_getRangeInfo()); }, 1);
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline range.mouseup error: " + pError);
            }
          });

          return false;
        }
        catch(pError)
        {
          console.error("jQuery.k2goTimeline range.mousedown error: " + pError);
        }
      });
    });
/******************************************************************************/
/* pick.hover                                                                 */
/******************************************************************************/
/*-----* mouseenter *---------------------------------------------------------*/
    $pickKnob.on("mouseenter.k2goTimeline", function(pEvent)
    {
      try
      {
        if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

        var intTop    = $main.data("options.k2goTimeline").pickLineDistance.element.offset().top + ($main.data("options.k2goTimeline").pickLineDistance.position == "bottom" ? $main.data("options.k2goTimeline").pickLineDistance.element.height() : 0);
        var intBottom = $pick.offset().top + $pick.height() - parseInt($pickLine.css("bottom"), 10);

        $pickLine.css("height", intBottom - intTop + "px");
      }
      catch(pError)
      {
        console.error("jQuery.k2goTimeline pick.mouseenter error: " + pError);
      }
    });
/*-----* mouseleave *---------------------------------------------------------*/
    $pickKnob.on("mouseleave.k2goTimeline", function(pEvent)
    {
      try
      {
        if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
        if (!$main.data("drag.k2goTimeline")) $pickLine.css("height", "");
      }
      catch(pError)
      {
        console.error("jQuery.k2goTimeline pick.mouseleave error: " + pError);
      }
    });
/******************************************************************************/
/* pick.drag                                                                  */
/******************************************************************************/
/*-----* start *--------------------------------------------------------------*/
    $.each(["touchstart", "mousedown"], function()
    {
      var flgTouch = this == "touchstart" ? true : false;

      $pick.on((flgTouch ? "touchstart" : "mousedown") + ".k2goTimeline", function(pEvent)
      {
        try
        {
          if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTimeline")) return;

          var intStartX = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
          var intBaseX  = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
          var intMoveX  = 0;

          if ($main.data("dblTap.k2goTimeline"))
          {
            if (typeof $main.data("options.k2goTimeline").pickDoubleTap == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickDoubleTap(_getTimeInfo(), (flgTouch ? 1 : (pEvent.which == 3 ? -1 : 1))); }, 1);
            else                                                                       $this.k2goTimeline( flgTouch ? "zoomIn" : (pEvent.which == 3 ? "zoomOut" : "zoomIn"));

            $main.data("dblTap.k2goTimeline", false);
            return false;
          }
          else
          {
            $pickKnob.trigger("mouseenter.k2goTimeline");
            $main    .data   (    "dblTap.k2goTimeline", true);
            $main    .data   (      "drag.k2goTimeline", true);
            $main    .data   (   "tapHold.k2goTimeline", setTimeout(function()
            {
              if (typeof $main.data("options.k2goTimeline").pickTapHold == "function")                         $main.data("options.k2goTimeline").pickTapHold  (_getTimeInfo());
              $main.data("tapHold.k2goTimeline", null);
            }, 1000));

            if (typeof $main.data("options.k2goTimeline").pickMoveStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickMoveStart(_getTimeInfo()); }, 1);
          }

          setTimeout(function(){ $main.data("dblTap.k2goTimeline", false); }, 300);
/*-----* move *---------------------------------------------------------------*/
          var fncMove = function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

              intMoveX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - intBaseX;
              intBaseX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);

              if ($rail.offset().left <= intBaseX && intBaseX <= $rail.offset().left + $rail.width())
              {
                _movePick(intBaseX);
                if (typeof $main.data("options.k2goTimeline").pickMove == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickMove(_getTimeInfo()); }, 1);

                if (typeof $main.data("tapHold.k2goTimeline") == "number" && Math.abs(intStartX - intBaseX) > 5)
                {
                  clearTimeout($main.data("tapHold.k2goTimeline"));
                               $main.data("tapHold.k2goTimeline", null);
                }
              }
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline pick.mousemove error: " + pError);
            }
          };

          document.addEventListener(flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
/*-----* end *----------------------------------------------------------------*/
          $(document).one((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline", function(pEvent)
          {
            try
            {
              if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }

              if (typeof $main.data("tapHold.k2goTimeline") == "number")
              {
                clearTimeout($main.data("tapHold.k2goTimeline"));
                             $main.data("tapHold.k2goTimeline", null);
              }

              $main      .data               (      "drag.k2goTimeline", false);
              $pickKnob  .trigger            ("mouseleave.k2goTimeline");
                document .removeEventListener( flgTouch ? "touchmove" : "mousemove", fncMove, { passive: false });
              $(document).off                ((flgTouch ? "touchend"  : "mouseup"  ) + ".k2goTimeline");

              if (typeof $main.data("options.k2goTimeline").pickMoveEnd == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickMoveEnd(_getTimeInfo()); }, 1);
            }
            catch(pError)
            {
              console.error("jQuery.k2goTimeline pick.mouseup error: " + pError);
            }
          });

          return false;
        }
        catch(pError)
        {
          console.error("jQuery.k2goTimeline pick.mousedown error: " + pError);
        }
      });
    });
/******************************************************************************/
/* rail.click                                                                 */
/******************************************************************************/
    $.each(["touchstart", "mousedown"], function()
    {
      var flgTouch = this == "touchstart" ? true : false;

      $rail.on((flgTouch ? "touchstart" : "mousedown") + ".k2goTimeline", function(pEvent)
      {
        try
        {
          if (flgEvent) { if (event.cancelable) event.preventDefault(); } else { if (pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTimeline")) return;

          var intX = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
          _movePick(intX);
          if (typeof $main.data("options.k2goTimeline").railClick == "function") setTimeout(function() { $main.data("options.k2goTimeline").railClick(_getTimeInfo()); }, 1);
        }
        catch(pError)
        {
          console.error("jQuery.k2goTimeline rail.mousedown error: " + pError);
        }
      });
    });
/******************************************************************************/
/* load                                                                       */
/******************************************************************************/
    $pick.append($pickLine);
    $pick.append($pickKnob);

    $rail.append($range);
    $rail.append($pick);

    $main.append($bar);
    $main.append($rail);

    $this.append($main);

    $this.k2goTimeline("create", { callback : pCallback });
  },
/******************************************************************************/
/* setOptions                                                                 */
/******************************************************************************/
  setOptions : function(pOptions)
  {
    $.extend(true, $(".k2go-timeline-main").data("options.k2goTimeline"), pOptions);
  },
/******************************************************************************/
/* getOptions                                                                 */
/******************************************************************************/
  getOptions : function()
  {
    var $main = $(".k2go-timeline-main");

    return {
      startTime          :                                                                        new Date($main.data("options.k2goTimeline").     startTime.getTime()),
      endTime            :                                                                        new Date($main.data("options.k2goTimeline").       endTime.getTime()),
      currentTime        :                                                                        new Date($main.data("options.k2goTimeline").   currentTime.getTime()),
      minTime            :                                                                        new Date($main.data("options.k2goTimeline").       minTime.getTime()),
      maxTime            :                                                                        new Date($main.data("options.k2goTimeline").       maxTime.getTime()),
      rangeStartTime     : typeof $main.data("options.k2goTimeline").rangeStartTime == "object" ? new Date($main.data("options.k2goTimeline").rangeStartTime.getTime()) : undefined,
      rangeEndTime       : typeof $main.data("options.k2goTimeline").rangeEndTime   == "object" ? new Date($main.data("options.k2goTimeline").  rangeEndTime.getTime()) : undefined,
      timezoneOffset     :        $main.data("options.k2goTimeline").timezoneOffset,
      jpCalendar         :        $main.data("options.k2goTimeline").jpCalendar,
      scale              :        $main.data("options.k2goTimeline").scale,
      minScale           :        $main.data("options.k2goTimeline").minScale,
      maxScale           :        $main.data("options.k2goTimeline").maxScale,
      disableMoveBar     :        $main.data("options.k2goTimeline").disableMoveBar,
      disableZoom        :        $main.data("options.k2goTimeline").disableZoom,
      syncPickAndBar     :        $main.data("options.k2goTimeline").syncPickAndBar,
      clickBarToMovePick :        $main.data("options.k2goTimeline").clickBarToMovePick,
      labelPosition      :        $main.data("options.k2goTimeline").labelPosition,
      timeChange         :        $main.data("options.k2goTimeline").timeChange,
      railClick          :        $main.data("options.k2goTimeline").railClick,
      rangeMoveStart     :        $main.data("options.k2goTimeline").rangeMoveStart,
      rangeMove          :        $main.data("options.k2goTimeline").rangeMove,
      rangeMoveEnd       :        $main.data("options.k2goTimeline").rangeMoveEnd,
      rangeChange        :        $main.data("options.k2goTimeline").rangeChange,
      pickMoveStart      :        $main.data("options.k2goTimeline").pickMoveStart,
      pickMove           :        $main.data("options.k2goTimeline").pickMove,
      pickMoveEnd        :        $main.data("options.k2goTimeline").pickMoveEnd,
      pickTapHold        :        $main.data("options.k2goTimeline").pickTapHold,
      pickDoubleTap      :        $main.data("options.k2goTimeline").pickDoubleTap,
      barMoveStart       :        $main.data("options.k2goTimeline").barMoveStart,
      barMove            :        $main.data("options.k2goTimeline").barMove,
      barMoveEnd         :        $main.data("options.k2goTimeline").barMoveEnd,
      zoomStart          :        $main.data("options.k2goTimeline").zoomStart,
      zoom               :        $main.data("options.k2goTimeline").zoom,
      zoomEnd            :        $main.data("options.k2goTimeline").zoomEnd
    };
  },
/******************************************************************************/
/* create                                                                     */
/******************************************************************************/
  create : function(pOptions)
  {
    if (typeof pOptions != "object" || pOptions == null) pOptions = {};

    var $main       = $(".k2go-timeline-main");
    var objTimeInfo = _getTimeInfo();
    var objStepInfo = {};
    var intDuration = typeof pOptions.duration == "number" && pOptions.duration > 0 ? pOptions.duration : 1;
    var intNow      = Date.now();

    if (typeof pOptions.timeInfo == "object" && pOptions.timeInfo != null)
    {
      _checkTimeInfo(pOptions.timeInfo);
    }
    else
    {
      _checkTimeInfo($main.data("options.k2goTimeline"));

      pOptions.timeInfo             = {};
      pOptions.timeInfo.    minTime = new Date($main.data("options.k2goTimeline").    minTime.getTime());
      pOptions.timeInfo.    maxTime = new Date($main.data("options.k2goTimeline").    maxTime.getTime());
      pOptions.timeInfo.  startTime = new Date($main.data("options.k2goTimeline").  startTime.getTime());
      pOptions.timeInfo.    endTime = new Date($main.data("options.k2goTimeline").    endTime.getTime());
      pOptions.timeInfo.currentTime = new Date($main.data("options.k2goTimeline").currentTime.getTime());
    }

    if ($main.data("lock.k2goTimeline")) return this; else $main.data("lock.k2goTimeline", true);

    objStepInfo.start   = (pOptions.timeInfo.  startTime.getTime() - objTimeInfo.  startTime.getTime()) / Math.ceil(intDuration / 50);
    objStepInfo.end     = (pOptions.timeInfo.    endTime.getTime() - objTimeInfo.    endTime.getTime()) / Math.ceil(intDuration / 50);
    objStepInfo.current = (pOptions.timeInfo.currentTime.getTime() - objTimeInfo.currentTime.getTime()) / Math.ceil(intDuration / 50);

    setTimeout(function _loop()
    {
      if (Date.now() - intNow < intDuration)
      {
        objTimeInfo.  startTime.setTime(objTimeInfo.  startTime.getTime() + objStepInfo.start);
        objTimeInfo.    endTime.setTime(objTimeInfo.    endTime.getTime() + objStepInfo.end);
        objTimeInfo.currentTime.setTime(objTimeInfo.currentTime.getTime() + objStepInfo.current);

        $main.data("options.k2goTimeline").    minTime.setTime(pOptions.timeInfo.    minTime.getTime());
        $main.data("options.k2goTimeline").    maxTime.setTime(pOptions.timeInfo.    maxTime.getTime());
        $main.data("options.k2goTimeline").  startTime.setTime(objTimeInfo      .  startTime.getTime());
        $main.data("options.k2goTimeline").    endTime.setTime(objTimeInfo      .    endTime.getTime());
        $main.data("options.k2goTimeline").currentTime.setTime(objTimeInfo      .currentTime.getTime());

        _create   ();
        _setLabel ();
        _moveRange();
        setTimeout(_loop, 50);
      }
      else
      {
        $main.data("options.k2goTimeline").    minTime.setTime(pOptions.timeInfo.    minTime.getTime());
        $main.data("options.k2goTimeline").    maxTime.setTime(pOptions.timeInfo.    maxTime.getTime());
        $main.data("options.k2goTimeline").  startTime.setTime(pOptions.timeInfo.  startTime.getTime());
        $main.data("options.k2goTimeline").    endTime.setTime(pOptions.timeInfo.    endTime.getTime());
        $main.data("options.k2goTimeline").currentTime.setTime(pOptions.timeInfo.currentTime.getTime());

        _create   ();
        _setLabel ();
        _moveRange();

        if (typeof pOptions.callback == "function") setTimeout(function() { pOptions.callback(_getTimeInfo()); }, 1);
        $main.data("lock.k2goTimeline", false);
      }
    }, 1);
  },
/******************************************************************************/
/* zoom                                                                       */
/******************************************************************************/
  zoomIn  : function() { this.k2goTimeline("zoom", -1); },
  zoomOut : function() { this.k2goTimeline("zoom",  1); },
  zoom    : function(pScale)
  {
    var $main      = $(".k2go-timeline-main");
    var intCounter = 0;

    if ($main.data("lock.k2goTimeline")) return this; else $main.data("lock.k2goTimeline", true);

    if (typeof $main.data("options.k2goTimeline").zoomStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomStart(_getTimeInfo()); }, 1);

    setTimeout(function _loop()
    {
      _zoomBar  ($main.data("options.k2goTimeline").scale * 0.1 * pScale);
      _setLabel ();
      _moveRange();
      intCounter++;

      if (intCounter < 10)
        setTimeout(_loop, 50);
      else
      {
        _setLabel();
        if (typeof $main.data("options.k2goTimeline").zoomEnd == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoomEnd(_getTimeInfo()); }, 1);
        $main.data("lock.k2goTimeline", false);
      }
    }, 1);
  },
/******************************************************************************/
/* showRangeBar                                                               */
/******************************************************************************/
/*-----* show *---------------------------------------------------------------*/
  showRangeBar : function(pOptions)
  {
    var $main       = $(".k2go-timeline-main");
    var objTimeInfo = {};

    if (typeof pOptions == "object")
    {
      if (typeof pOptions.rangeStartTime == "object") objTimeInfo.startTime = new Date(pOptions                          .rangeStartTime.getTime());
      else                                            objTimeInfo.startTime = new Date($main.data("options.k2goTimeline").rangeStartTime.getTime());

      if (typeof pOptions.rangeEndTime   == "object") objTimeInfo.  endTime = new Date(pOptions                          .rangeEndTime  .getTime());
      else                                            objTimeInfo.  endTime = new Date($main.data("options.k2goTimeline").rangeEndTime  .getTime());
    }
    else
    {
      objTimeInfo.startTime = new Date($main.data("options.k2goTimeline").rangeStartTime.getTime());
      objTimeInfo.  endTime = new Date($main.data("options.k2goTimeline").rangeEndTime  .getTime());
    }

    objTimeInfo.currentTime = new Date(objTimeInfo.endTime.getTime());
    objTimeInfo.minTime     = new Date($main.data("options.k2goTimeline").minTime.getTime());
    objTimeInfo.maxTime     = new Date($main.data("options.k2goTimeline").maxTime.getTime());

    _checkTimeInfo(objTimeInfo);

    $main.data("options.k2goTimeline").rangeStartTime = objTimeInfo.startTime;
    $main.data("options.k2goTimeline").rangeEndTime   = objTimeInfo.  endTime;

    $(".k2go-timeline-range").addClass("k2go-timeline-range-show");
    _moveRange();
  },
/*-----* hidden *-------------------------------------------------------------*/
  hiddenRangeBar : function()
  {
    $(".k2go-timeline-range").removeClass("k2go-timeline-range-show");
  },
/******************************************************************************/
/* play                                                                       */
/******************************************************************************/
/*-----* start *--------------------------------------------------------------*/
  start : function(pOptions)
  {
    var $main = $(".k2go-timeline-main");
    var $bar  = $(".k2go-timeline-bar" );
    var $pick = $(".k2go-timeline-pick");

    $main.data("options.k2goTimeline").fps   = 1000 / (typeof pOptions.fps   == "number" ? pOptions.fps   : 10);
    $main.data("options.k2goTimeline").speed =        (typeof pOptions.speed == "number" ? pOptions.speed : 10);

    if ($main.data("lock.k2goTimeline")) return this; else $main.data("lock.k2goTimeline", true);

    setTimeout(function _loop()
    {
      if (!$main.data("lock.k2goTimeline"))
      {
        if (typeof pOptions.stop == "function") pOptions.stop();
        return;
      }
/*-----* realtime *-----------------------------------------------------------*/
      if (pOptions.realTime)
      {
        var objTimeInfo = {};

        objTimeInfo.currentTime = new Date();
        objTimeInfo.startTime   = new Date(objTimeInfo.currentTime.getTime() - ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
        objTimeInfo.endTime     = new Date(objTimeInfo.  startTime.getTime() +  $bar.width()                               * $main.data("options.k2goTimeline").scale);

        if (objTimeInfo.endTime.getTime() >= $main.data("options.k2goTimeline").maxTime.getTime())
        {
          $main.data("lock.k2goTimeline", false);
          if (typeof pOptions.stop == "function") pOptions.stop();
        }
        else
        {
          $main.data("options.k2goTimeline").  startTime.setTime(objTimeInfo.  startTime.getTime());
          $main.data("options.k2goTimeline").    endTime.setTime(objTimeInfo.    endTime.getTime());
          $main.data("options.k2goTimeline").currentTime.setTime(objTimeInfo.currentTime.getTime());
          _create   ();
          _setLabel ();
          _moveRange();
          setTimeout(_loop, $main.data("options.k2goTimeline").fps);
        }
      }
/*-----* range bar *----------------------------------------------------------*/
      else if ($(".k2go-timeline-range").hasClass("k2go-timeline-range-show"))
      {
        if ($main.data("options.k2goTimeline").currentTime.getTime() < $main.data("options.k2goTimeline").rangeStartTime.getTime() && $main.data("options.k2goTimeline").speed > 0)
        {
          if ($main.data("options.k2goTimeline").rangeStartTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime()
          ||  $main.data("options.k2goTimeline").rangeStartTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime())
          {
                                                                                                                               $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").rangeStartTime.getTime() - ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
            if ($main.data("options.k2goTimeline").startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime()) $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").       minTime.getTime());
                                                                                                                               $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").     startTime.getTime() +  $bar.width()                               * $main.data("options.k2goTimeline").scale);
            if ($main.data("options.k2goTimeline").  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime()) $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").       maxTime.getTime());
          }

          $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").rangeStartTime.getTime());
          _create   ();
          _setLabel ();
          _moveRange();
          setTimeout(_loop, $main.data("options.k2goTimeline").fps);
        }
        else if ($main.data("options.k2goTimeline").currentTime.getTime() > $main.data("options.k2goTimeline").rangeEndTime.getTime() && $main.data("options.k2goTimeline").speed < 0)
        {
          if ($main.data("options.k2goTimeline").rangeEndTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime()
          ||  $main.data("options.k2goTimeline").rangeEndTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime())
          {
                                                                                                                               $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").rangeEndTime.getTime() - ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
            if ($main.data("options.k2goTimeline").startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime()) $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").     minTime.getTime());
                                                                                                                               $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").   startTime.getTime() +  $bar.width()                               * $main.data("options.k2goTimeline").scale);
            if ($main.data("options.k2goTimeline").  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime()) $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").     maxTime.getTime());
          }

          $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").rangeEndTime.getTime());
          _create   ();
          _setLabel ();
          _moveRange();
          setTimeout(_loop, $main.data("options.k2goTimeline").fps);
        }
        else if ($main.data("options.k2goTimeline").currentTime.getTime() <= $main.data("options.k2goTimeline").rangeStartTime.getTime() && $main.data("options.k2goTimeline").speed < 0)
        {
          if (pOptions.loop)
          {
            setTimeout(function()
            {
              if ($main.data("options.k2goTimeline").rangeEndTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime()
              ||  $main.data("options.k2goTimeline").rangeEndTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime())
              {
                                                                                                                                   $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").rangeEndTime.getTime() + $bar.width() / 2 * $main.data("options.k2goTimeline").scale);
                if ($main.data("options.k2goTimeline").  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime()) $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").     maxTime.getTime());
                                                                                                                                   $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").     endTime.getTime() - $bar.width()     * $main.data("options.k2goTimeline").scale);
                if ($main.data("options.k2goTimeline").startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime()) $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").     minTime.getTime());
              }

              $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").rangeEndTime.getTime());
              _create   ();
              _setLabel ();
              _moveRange();
              setTimeout(_loop, $main.data("options.k2goTimeline").fps);
            }, 2000);
          }
          else
          {
            $main.data("lock.k2goTimeline", false);
            if (typeof pOptions.stop == "function") pOptions.stop();
          }
        }
        else if ($main.data("options.k2goTimeline").currentTime.getTime() >= $main.data("options.k2goTimeline").rangeEndTime.getTime() && $main.data("options.k2goTimeline").speed > 0)
        {
          if (pOptions.loop)
          {
            setTimeout(function()
            {
              if ($main.data("options.k2goTimeline").rangeStartTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime()
              ||  $main.data("options.k2goTimeline").rangeStartTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime())
              {
                                                                                                                                   $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").rangeStartTime.getTime() - $bar.width() / 2 * $main.data("options.k2goTimeline").scale);
                if ($main.data("options.k2goTimeline").startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime()) $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").       minTime.getTime());
                                                                                                                                   $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").     startTime.getTime() + $bar.width()     * $main.data("options.k2goTimeline").scale);
                if ($main.data("options.k2goTimeline").  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime()) $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").       maxTime.getTime());
              }

              $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").rangeStartTime.getTime());
              _create   ();
              _setLabel ();
              _moveRange();
              setTimeout(_loop, $main.data("options.k2goTimeline").fps);
            }, 2000);
          }
          else
          {
            $main.data("lock.k2goTimeline", false);
            if (typeof pOptions.stop == "function") pOptions.stop();
          }
        }
        else
        {
          var intMove =  $main.data("options.k2goTimeline").speed / (1000 / $main.data("options.k2goTimeline").fps) * -1;
          var intDiff = ($main.data("options.k2goTimeline").currentTime.getTime() - ($main.data("options.k2goTimeline").speed < 0 ? $main.data("options.k2goTimeline").rangeStartTime.getTime() : $main.data("options.k2goTimeline").rangeEndTime.getTime())) / $main.data("options.k2goTimeline").scale;

          if (Math.abs(intMove) > Math.abs(intDiff)) intMove = intDiff;

          if ($main.data("options.k2goTimeline").rangeStartTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime()
          ||  $main.data("options.k2goTimeline").rangeEndTime  .getTime() > $main.data("options.k2goTimeline").  endTime.getTime())
          {
            if (($main.data("options.k2goTimeline").minTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime() && $main.data("options.k2goTimeline").speed < 0)
            ||  ($main.data("options.k2goTimeline").maxTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime() && $main.data("options.k2goTimeline").speed > 0))
            {
              _moveBar (                                            intMove);
            }
            else
            {
              _movePick(($pick.offset().left + $pick.width() / 2) - intMove);
            }
          }
          else
          {
            _movePick(($pick.offset().left + $pick.width() / 2) - intMove);
          }

          _setLabel ();
          _moveRange();
          setTimeout(_loop, $main.data("options.k2goTimeline").fps);
        }
      }
/*-----* normal *-------------------------------------------------------------*/
      else
      {
        if ($main.data("options.k2goTimeline").startTime.getTime() <= $main.data("options.k2goTimeline").minTime.getTime() && $main.data("options.k2goTimeline").speed < 0)
        {
          if (pOptions.loop)
          {
            setTimeout(function()
            {
              $main.data("options.k2goTimeline").    endTime.setTime($main.data("options.k2goTimeline").  maxTime.getTime());
              $main.data("options.k2goTimeline").  startTime.setTime($main.data("options.k2goTimeline").  endTime.getTime() -  $bar.width()                               * $main.data("options.k2goTimeline").scale);
              $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").startTime.getTime() + ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
              _create   ();
              _setLabel ();
              _moveRange();
              setTimeout(_loop, $main.data("options.k2goTimeline").fps);
            }, 2000);
          }
          else
          {
            $main.data("lock.k2goTimeline", false);
            if (typeof pOptions.stop == "function") pOptions.stop();
          }
        }
        else if ($main.data("options.k2goTimeline").endTime.getTime() >= $main.data("options.k2goTimeline").maxTime.getTime() && $main.data("options.k2goTimeline").speed > 0)
        {
          if (pOptions.loop)
          {
            setTimeout(function()
            {
              $main.data("options.k2goTimeline").  startTime.setTime($main.data("options.k2goTimeline").  minTime.getTime());
              $main.data("options.k2goTimeline").    endTime.setTime($main.data("options.k2goTimeline").startTime.getTime() +  $bar.width()                               * $main.data("options.k2goTimeline").scale);
              $main.data("options.k2goTimeline").currentTime.setTime($main.data("options.k2goTimeline").startTime.getTime() + ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
              _create   ();
              _setLabel ();
              _moveRange();
              setTimeout(_loop, $main.data("options.k2goTimeline").fps);
            }, 2000);
          }
          else
          {
            $main.data("lock.k2goTimeline", false);
            if (typeof pOptions.stop == "function") pOptions.stop();
          }
        }
        else
        {
          _moveBar  ($main.data("options.k2goTimeline").speed / (1000 / $main.data("options.k2goTimeline").fps) * -1);
          _setLabel ();
          _moveRange();
          setTimeout(_loop, $main.data("options.k2goTimeline").fps);
        }
      }
    }, 1);
  },
/*-----* stop *---------------------------------------------------------------*/
  stop : function()
  {
    $(".k2go-timeline-main").data("lock.k2goTimeline", false);
  },
/******************************************************************************/
/* getTimeFromOffset                                                          */
/******************************************************************************/
  getTimeFromOffset : function(pOffsetLeft)
  {
    var $main   = $(".k2go-timeline-main");
    var $rail   = $(".k2go-timeline-rail");
    var intLeft = pOffsetLeft - $rail.offset().left;

    return new Date($main.data("options.k2goTimeline").startTime.getTime() + intLeft * $main.data("options.k2goTimeline").scale);
  },
/******************************************************************************/
/* getOffsetFromTime                                                          */
/******************************************************************************/
  getOffsetFromTime : function(pDate)
  {
    var $main   = $(".k2go-timeline-main");
    var $rail   = $(".k2go-timeline-rail");
    var intDiff = pDate.getTime() - $main.data("options.k2goTimeline").startTime.getTime();

    return $rail.offset().left + intDiff / $main.data("options.k2goTimeline").scale;
  },
/******************************************************************************/
/* formatDate                                                                 */
/******************************************************************************/
  formatDate : function(pDate, pFormatString, pOffset)
  {
    return _formatDate(pDate, pFormatString, pOffset);
  }
};
/******************************************************************************/
/* _create                                                                    */
/******************************************************************************/
function _create()
{
  try
  {
    var $main   = $(".k2go-timeline-main");
    var $bar    = $(".k2go-timeline-bar" );
    var $pick   = $(".k2go-timeline-pick");
    var objTime = new Date($main.data("options.k2goTimeline").startTime.getTime());
    var intLeft;

    $main.data("options.k2goTimeline").scale         = ($main.data("options.k2goTimeline").endTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $bar.width();
    $main.data("options.k2goTimeline").scaleInterval = _getScaleInterval($main.data("options.k2goTimeline").scale);

    _roundTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);
    $bar.children().remove();
    intLeft = (objTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $main.data("options.k2goTimeline").scale;

    while (objTime.getTime() <= $main.data("options.k2goTimeline").endTime.getTime())
    {
      var $scale = $("<span class='k2go-timeline-scale'></span>").css("left", intLeft + "px").data("time.k2goTimeline", new Date(objTime.getTime()));
      $bar.append($scale);

      _incrementTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);
      intLeft = (objTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $main.data("options.k2goTimeline").scale;
    }

    $pick.css("left", $bar.position().left - $pick.width() / 2 + ($main.data("options.k2goTimeline").currentTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $main.data("options.k2goTimeline").scale + "px");

    if (typeof $main.data("options.k2goTimeline").timeChange == "function") setTimeout(function() { $main.data("options.k2goTimeline").timeChange(_getTimeInfo()); }, 1);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _create error: " + pError);
  }
}
/******************************************************************************/
/* _incrementBar                                                              */
/******************************************************************************/
function _incrementBar()
{
  try
  {
    if ($(".k2go-timeline-main").data("_incrementBar.k2goTimeline")) return; else $(".k2go-timeline-main").data("_incrementBar.k2goTimeline", true);
/*-----* variable *-----------------------------------------------------------*/
    var $main       = $(".k2go-timeline-main");
    var $bar        = $(".k2go-timeline-bar");
    var intWidth    = $bar.width();
    var objBaseTime = $bar.children(":first").data    ("time.k2goTimeline");
    var intBaseLeft = $bar.children(":first").position().left;
    var objTime     = new Date(objBaseTime.getTime());
    var intLeft     = intBaseLeft;
/*-----* prepend *------------------------------------------------------------*/
    while (intLeft >= 0)
    {
      _incrementTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset, -1);
      intLeft = intBaseLeft + (objTime.getTime() - objBaseTime.getTime()) / $main.data("options.k2goTimeline").scale;

      var $scale = $("<span class='k2go-timeline-scale'></span>").css("left", intLeft + "px").data("time.k2goTimeline", new Date(objTime.getTime()));
      $bar.prepend($scale);
    }
/*-----* append *-------------------------------------------------------------*/
    objBaseTime = $bar.children(":last").data    ("time.k2goTimeline");
    intBaseLeft = $bar.children(":last").position().left;
    objTime     = new Date(objBaseTime.getTime());
    intLeft     = intBaseLeft;

    while (intLeft <= intWidth)
    {
      _incrementTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);
      intLeft = intBaseLeft + (objTime.getTime() - objBaseTime.getTime()) / $main.data("options.k2goTimeline").scale;

      var $scale = $("<span class='k2go-timeline-scale'></span>").css("left", intLeft + "px").data("time.k2goTimeline", new Date(objTime.getTime()));
      $bar.append($scale);
    }
/*-----* remove *-------------------------------------------------------------*/
    while ($bar.children(":first").position().left < 0       ) $bar.children(":first").remove();
    while ($bar.children(":last" ).position().left > intWidth) $bar.children(":last" ).remove();
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _incrementBar error: " + pError);
  }
  finally
  {
    $(".k2go-timeline-main").data("_incrementBar.k2goTimeline", false);
  }
}
/******************************************************************************/
/* _resizeBar                                                                 */
/******************************************************************************/
function _resizeBar()
{
  try
  {
    var $main       = $(".k2go-timeline-main");
    var $bar        = $(".k2go-timeline-bar" );
    var objTimeInfo =
    {
      currentTime : new Date($main.data("options.k2goTimeline").currentTime.getTime()),
      startTime   : new Date($main.data("options.k2goTimeline").  startTime.getTime()),
      endTime     : new Date($main.data("options.k2goTimeline").  startTime.getTime() + $bar.width() * $main.data("options.k2goTimeline").scale)
    };

    if (objTimeInfo.endTime.getTime() != $main.data("options.k2goTimeline").endTime.getTime())
    {
      $main.data("options.k2goTimeline").endTime.setTime(objTimeInfo.endTime.getTime());
      if (typeof $main.data("options.k2goTimeline").timeChange == "function") setTimeout(function() { $main.data("options.k2goTimeline").timeChange(objTimeInfo); }, 1);
    }
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _resizeBar error: " + pError);
  }
}
/******************************************************************************/
/* _moveBar                                                                   */
/******************************************************************************/
function _moveBar(pMoveX, pSync)
{
  try
  {
    if ($(".k2go-timeline-main").data("_moveBar.k2goTimeline")) return; else $(".k2go-timeline-main").data("_moveBar.k2goTimeline", true);

    var $main       = $(".k2go-timeline-main");
    var objTimeInfo = { startTime : null, endTime : null, currentTime : null };

    if ($main.data("options.k2goTimeline").disableMoveBar                                                                           ) return;
    if ($main.data("options.k2goTimeline").startTime.getTime() <= $main.data("options.k2goTimeline").minTime.getTime() && pMoveX > 0) return;
    if ($main.data("options.k2goTimeline").  endTime.getTime() >= $main.data("options.k2goTimeline").maxTime.getTime() && pMoveX < 0) return;

    objTimeInfo.startTime = new Date($main.data("options.k2goTimeline").startTime.getTime() - $main.data("options.k2goTimeline").scale * pMoveX);

    if (objTimeInfo.startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime() && pMoveX > 0)
    {
      objTimeInfo.startTime = new Date($main.data("options.k2goTimeline").minTime.getTime());
      pMoveX                = ($main.data("options.k2goTimeline").startTime.getTime() - $main.data("options.k2goTimeline").minTime.getTime()) / $main.data("options.k2goTimeline").scale;
    }

    objTimeInfo.  endTime = new Date($main.data("options.k2goTimeline").  endTime.getTime() - $main.data("options.k2goTimeline").scale * pMoveX);

    if (objTimeInfo.  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime() && pMoveX < 0)
    {
      objTimeInfo.  endTime = new Date($main.data("options.k2goTimeline").maxTime.getTime());
      pMoveX                = ($main.data("options.k2goTimeline").  maxTime.getTime() - $main.data("options.k2goTimeline").endTime.getTime()) / $main.data("options.k2goTimeline").scale;
    }

    objTimeInfo.currentTime = !pSync ? new Date($main.data("options.k2goTimeline").currentTime.getTime() - $main.data("options.k2goTimeline").scale * pMoveX) : new Date($main.data("options.k2goTimeline").currentTime.getTime());

    if (pSync)
    {
      if (objTimeInfo.currentTime.getTime() < objTimeInfo.startTime.getTime()) objTimeInfo.currentTime.setTime(objTimeInfo.startTime.getTime());
      if (objTimeInfo.currentTime.getTime() > objTimeInfo.  endTime.getTime()) objTimeInfo.currentTime.setTime(objTimeInfo.  endTime.getTime());
    }

    $main.data("options.k2goTimeline").  startTime.setTime(objTimeInfo.  startTime.getTime());
    $main.data("options.k2goTimeline").    endTime.setTime(objTimeInfo.    endTime.getTime());
    $main.data("options.k2goTimeline").currentTime.setTime(objTimeInfo.currentTime.getTime());

    _create();
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _moveBar error: " + pError);
  }
  finally
  {
    $(".k2go-timeline-main").data("_moveBar.k2goTimeline", false);
  }
}
/******************************************************************************/
/* _zoomBar                                                                   */
/******************************************************************************/
function _zoomBar(pScale)
{
  try
  {
    if ($(".k2go-timeline-main").data("_zoomBar.k2goTimeline")) return; else $(".k2go-timeline-main").data("_zoomBar.k2goTimeline", true);

    var $main    = $(".k2go-timeline-main");
    var $bar     = $(".k2go-timeline-bar" );
    var $pick    = $(".k2go-timeline-pick");
    var intScale = $main.data("options.k2goTimeline").scale + pScale;

    if ($main.data("options.k2goTimeline").disableZoom                                                                              ) return;
    if ($main.data("options.k2goTimeline").scale               <= $main.data("options.k2goTimeline").minScale          && pScale < 0) return;
    if ($main.data("options.k2goTimeline").scale               >= $main.data("options.k2goTimeline").maxScale          && pScale > 0) return;
    if ($main.data("options.k2goTimeline").startTime.getTime() <= $main.data("options.k2goTimeline").minTime.getTime() && pScale > 0) return;
    if ($main.data("options.k2goTimeline").  endTime.getTime() >= $main.data("options.k2goTimeline").maxTime.getTime() && pScale > 0) return;

    if (intScale < $main.data("options.k2goTimeline").minScale) intScale = $main.data("options.k2goTimeline").minScale;
    if (intScale > $main.data("options.k2goTimeline").maxScale) intScale = $main.data("options.k2goTimeline").maxScale;

    $main.data("options.k2goTimeline").scale = intScale;

    $main.data("options.k2goTimeline").startTime.setTime($main.data("options.k2goTimeline").currentTime.getTime() - ($pick.position().left + $pick.width() / 2) * $main.data("options.k2goTimeline").scale);
    $main.data("options.k2goTimeline").  endTime.setTime($main.data("options.k2goTimeline").  startTime.getTime() +  $bar.width()                               * $main.data("options.k2goTimeline").scale);

    _create();

    if (typeof $main.data("options.k2goTimeline").zoom == "function") setTimeout(function() { $main.data("options.k2goTimeline").zoom(_getTimeInfo()); }, 1);
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _zoomBar error: " + pError);
  }
  finally
  {
    $(".k2go-timeline-main").data("_zoomBar.k2goTimeline", false);
  }
}
/******************************************************************************/
/* _moveRange                                                                 */
/******************************************************************************/
function _moveRange(pMove, pFlg)
{
  try
  {
    var $main        = $(".k2go-timeline-main");
    var $rail        = $(".k2go-timeline-rail");
    var $range       = $(".k2go-timeline-range");
    var $rangeLeft   = $(".k2go-timeline-range-left");
    var $rangeRight  = $(".k2go-timeline-range-right");
    var objRangeInfo;
    var objTime;

    if (!$range.hasClass("k2go-timeline-range-show")) return;

    objRangeInfo =
    {
      startTime : new Date($main.data("options.k2goTimeline").rangeStartTime.getTime()),
      endTime   : new Date($main.data("options.k2goTimeline").rangeEndTime  .getTime())
    };

    if (typeof pMove == "number" && typeof pFlg == "string")
    {
      if (pFlg != "right")
      {
        objRangeInfo.startTime.setTime(objRangeInfo.startTime.getTime() + pMove * $main.data("options.k2goTimeline").scale);

        if (pFlg == "left" && (objRangeInfo.endTime.getTime() - objRangeInfo.startTime.getTime()) / $main.data("options.k2goTimeline").scale < $rangeLeft.width() + $rangeRight.width())
        {
          objRangeInfo.startTime.setTime($main.data("options.k2goTimeline").rangeStartTime.getTime());
        }

        objTime = new Date(objRangeInfo.startTime.getTime());
        _roundTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);

        if (Math.abs(objTime.getTime() - objRangeInfo.startTime.getTime()) <= $main.data("options.k2goTimeline").scale)
        {
          objRangeInfo.startTime.setTime(objTime.getTime());
        }
      }

      if (pFlg != "left")
      {
        objRangeInfo.endTime.setTime(objRangeInfo.endTime.getTime() + pMove * $main.data("options.k2goTimeline").scale);

        if (pFlg == "right" && (objRangeInfo.endTime.getTime() - objRangeInfo.startTime.getTime()) / $main.data("options.k2goTimeline").scale < $rangeLeft.width() + $rangeRight.width())
        {
          objRangeInfo.endTime.setTime($main.data("options.k2goTimeline").rangeEndTime.getTime());
        }

        objTime = new Date(objRangeInfo.endTime.getTime());
        _roundTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);

        if (Math.abs(objTime.getTime() - objRangeInfo.endTime.getTime()) <= $main.data("options.k2goTimeline").scale)
        {
          objRangeInfo.endTime.setTime(objTime.getTime());
        }
      }

      if (objRangeInfo.startTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime())
      {
        pMove = objRangeInfo.startTime.getTime() - $main.data("options.k2goTimeline").minTime.getTime();
        objRangeInfo.startTime.setTime($main.data("options.k2goTimeline").  minTime.getTime());
        objRangeInfo.  endTime.setTime(objRangeInfo.                        endTime.getTime() - pMove);
      }

      if (objRangeInfo.  endTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime())
      {
        pMove = objRangeInfo.  endTime.getTime() - $main.data("options.k2goTimeline").maxTime.getTime();
        objRangeInfo.  endTime.setTime($main.data("options.k2goTimeline").  maxTime.getTime());
        objRangeInfo.startTime.setTime(objRangeInfo.                      startTime.getTime() - pMove);
      }
    }

    if (objRangeInfo.startTime.getTime() > $main.data("options.k2goTimeline").  endTime.getTime()
    ||  objRangeInfo.  endTime.getTime() < $main.data("options.k2goTimeline").startTime.getTime())
    {
      $range.css("display", "none");
    }
    else
    {
      var intLeft  = (objRangeInfo.startTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $main.data("options.k2goTimeline").scale;
      var intRight = (objRangeInfo.  endTime.getTime() - $main.data("options.k2goTimeline").startTime.getTime()) / $main.data("options.k2goTimeline").scale;

      if (intLeft <              0) { $rangeLeft .css("display", "none"); intLeft  = 0; }
      else                            $rangeLeft .css("display", "");

      if (intRight > $rail.width()) { $rangeRight.css("display", "none"); intRight = $rail.width(); }
      else                            $rangeRight.css("display", "");

      $range.css({ display : "", left : intLeft + "px", width : intRight - intLeft + "px" });
    }

    if (objRangeInfo.startTime.getTime() != $main.data("options.k2goTimeline").rangeStartTime.getTime()
    ||  objRangeInfo.  endTime.getTime() != $main.data("options.k2goTimeline").rangeEndTime  .getTime())
    {
      $main.data("options.k2goTimeline").rangeStartTime.setTime(objRangeInfo.startTime.getTime());
      $main.data("options.k2goTimeline").rangeEndTime  .setTime(objRangeInfo.  endTime.getTime());

      if (typeof $main.data("options.k2goTimeline").rangeChange == "function") setTimeout(function() { $main.data("options.k2goTimeline").rangeChange(_getRangeInfo()); }, 1);
    }
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _moveRange error: " + pError);
  }
}
/******************************************************************************/
/* _movePick                                                                  */
/******************************************************************************/
function _movePick(pOffsetLeft)
{
  try
  {
    var $main        = $(".k2go-timeline-main");
    var $bar         = $(".k2go-timeline-bar" );
    var $rail        = $(".k2go-timeline-rail");
    var $pick        = $(".k2go-timeline-pick");
    var intPickWidth = $pick.width() / 2;
    var intLeft      = (typeof pOffsetLeft == "number" ? pOffsetLeft : $rail.offset().left) - $rail.offset().left - intPickWidth;

         if (intLeft < intPickWidth * -1                ) intLeft = intPickWidth * -1;
    else if (intLeft > intPickWidth * -1 + $rail.width()) intLeft = intPickWidth * -1 + $rail.width();

    if (intLeft != parseInt($pick.css("left"), 10))
    {
      var objTimeInfo =
      {
        startTime   : new Date($main.data("options.k2goTimeline").startTime.getTime()),
        endTime     : new Date($main.data("options.k2goTimeline").  endTime.getTime()),
        currentTime : new Date($main.data("options.k2goTimeline").startTime.getTime() + (intLeft + intPickWidth) * $main.data("options.k2goTimeline").scale)
      };

      var objTime = new Date(objTimeInfo.currentTime.getTime());
      _roundTime(objTime, $main.data("options.k2goTimeline").scaleInterval, $main.data("options.k2goTimeline").timezoneOffset);

      if (Math.abs(objTime.getTime() - objTimeInfo.currentTime.getTime()) <= $main.data("options.k2goTimeline").scale)
      {
        objTimeInfo.currentTime.setTime(objTime.getTime());
      }

      if (objTimeInfo.currentTime.getTime() < $main.data("options.k2goTimeline").minTime.getTime())
      {
        intLeft -= (objTimeInfo.currentTime.getTime() - $main.data("options.k2goTimeline").minTime.getTime()) / $main.data("options.k2goTimeline").scale;
        objTimeInfo.currentTime.setTime($main.data("options.k2goTimeline").minTime.getTime());
      }

      if (objTimeInfo.currentTime.getTime() > $main.data("options.k2goTimeline").maxTime.getTime())
      {
        intLeft -= (objTimeInfo.currentTime.getTime() - $main.data("options.k2goTimeline").maxTime.getTime()) / $main.data("options.k2goTimeline").scale;
        objTimeInfo.currentTime.setTime($main.data("options.k2goTimeline").maxTime.getTime());
      }

      $pick.css("left", intLeft + "px");

      if (objTimeInfo.currentTime.getTime() != $main.data("options.k2goTimeline").currentTime.getTime())
      {
        $main.data("options.k2goTimeline").currentTime.setTime(objTimeInfo.currentTime.getTime());
        if (typeof $main.data("options.k2goTimeline").timeChange == "function") setTimeout(function() { $main.data("options.k2goTimeline").timeChange(objTimeInfo); }, 1);
      }
    }
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _movePick error: " + pError);
  }
}
/******************************************************************************/
/* _setLabel                                                                  */
/******************************************************************************/
function _setLabel()
{
  try
  {
/*-----* variable *-----------------------------------------------------------*/
    var $main            = $(".k2go-timeline-main");
    var $bar             = $(".k2go-timeline-bar" );
    var intOffset        = $main.data("options.k2goTimeline").timezoneOffset;
    var flgJpCalendar    = $main.data("options.k2goTimeline").jpCalendar;
    var intScale         = $main.data("options.k2goTimeline").scale;
    var strLabelPosition = $main.data("options.k2goTimeline").labelPosition;

    $bar.find    (".k2go-timeline-label").remove     ();
    $bar.children()                      .removeClass("k2go-timeline-scale-l");

    $bar.children().each(function(pIndex, pElement)
    {
      var objTime   = new Date($(pElement).data("time.k2goTimeline").getTime() + intOffset * 60 * 1000);
      var strFormat = "";
      var intWidth  = 0;
      var objNext;

      if (intScale <= 1)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 100 / intScale;
        }

             if (objTime.getTime() %   500       == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   100       == 0) strFormat = "%N";
      }
      else if (intScale <= 5)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 100 / intScale;
        }

             if (objTime.getTime() % (1000 *  2) == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   250       == 0) strFormat = "%N";
      }
      else if (intScale <= 10)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 100 / intScale;
        }

             if (objTime.getTime() % (1000 *  5) == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   500       == 0) strFormat = "%N";
      }
      else if (intScale <= 25)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 / intScale;
        }

             if (objTime.getTime() % (1000 * 10) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() %  1000       == 0) strFormat = "%S";
      }
      else if (intScale <= 50)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 / intScale;
        }

             if (objTime.getTime() % (1000 * 20) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 *  2) == 0) strFormat = "%S";
      }
      else if (intScale <= 100)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 / intScale;
        }

             if (objTime.getTime() % (1000 * 30) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 *  5) == 0) strFormat = "%S";
      }
      else if (intScale <= 250)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 / intScale;
        }

             if (objTime.getTime() % (1000 * 60) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 * 10) == 0) strFormat = "%S";
      }
      else if (intScale <= 500)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 / intScale;
        }

             if (objTime.getTime() % (1000 * 60 *  2) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 * 30     ) == 0) strFormat = "%S";
      }
      else if (intScale <= 1000)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 / intScale;
        }

             if (objTime.getTime() % (1000 * 60 *  5) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60     ) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 *  2.5)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 / intScale;
        }

             if (objTime.getTime() % (1000 * 60 * 10) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 *  5) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 *  5)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 / intScale;
        }

             if (objTime.getTime() % (1000 * 60 * 30) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 10) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 15)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 / intScale;
        }

             if (objTime.getTime() % (1000 * 60 * 60) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 30) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 30)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 * 60 / intScale;

               if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = flgJpCalendar ? "%H<br/>%jp年%m月%d日" : "%H<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H";
        }
        else
        {
               if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H:%M";
        }
      }
      else if (intScale <= 1000 * 60)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 * 60 / intScale;

               if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = flgJpCalendar ? "%H<br/>%jp年%m月%d日" : "%H<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H";
        }
        else
        {
               if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H:%M";
        }
      }
      else if (intScale <= 1000 * 60 *  2.5)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 * 60 / intScale;

               if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = flgJpCalendar ? "%H<br/>%jp年%m月%d日" : "%H<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = "%H";
        }
        else
        {
               if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = "%H:%M";
        }
      }
      else if (intScale <= 1000 * 60 *  5)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 * 60 / intScale;

               if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H<br/>%jp年%m月%d日" : "%H<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = "%H";
        }
        else
        {
               if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = "%H:%M";
        }
      }
      else if (intScale <= 1000 * 60 * 10)
      {
        if (typeof strLabelPosition == "string" && strLabelPosition == "range")
        {
          intWidth = 1000 * 60 * 60 / intScale;

               if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H<br/>%jp年%m月%d日" : "%H<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = "%H";
        }
        else
        {
               if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
          else if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = "%H:%M";
        }
      }
      else if (intScale <= 1000 * 60 * 30)
      {
        if (objTime.getUTCHours() == 0)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            intWidth = 1000 * 60 * 60 * 24 / intScale;
          }

          if (objTime.getUTCDate () < 31 && objTime.getUTCDate() %  5 == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else                                                              strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60)
      {
        if (objTime.getUTCHours() == 0)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCDate(objNext.getUTCDate() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;
          }

               if (objTime.getUTCDate() < 31 && objTime.getUTCDate() % 15 == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else if (objTime.getUTCDate() < 31 && objTime.getUTCDate() %  5 == 1) strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 *  2)
      {
        if (objTime.getUTCDate() < 31 && objTime.getUTCDate() % 15 == 1)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCDate(objNext.getUTCDate() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;
          }

          if (objTime.getUTCDate() == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else                           strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 *  8)
      {
        if (objTime.getUTCDate() == 1)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCMonth(objNext.getUTCMonth() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;

            if (objTime.getUTCMonth() % 3 == 0) strFormat = flgJpCalendar ? "%m<br/>%jp年" : "%m<br/>%y";
            else                                strFormat = "%m";
          }
          else
          {
            if (objTime.getUTCMonth() % 3 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
            else                                strFormat = "%m/%d";
          }
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 18)
      {
        if (objTime.getUTCDate() == 1)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCMonth(objNext.getUTCMonth() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;

                 if (objTime.getUTCMonth() %  6 == 0) strFormat = flgJpCalendar ? "%m<br/>%jp年" : "%m<br/>%y";
            else if (objTime.getUTCMonth() %  3 == 0) strFormat = "%m";
          }
          else
          {
                 if (objTime.getUTCMonth() %  6 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
            else if (objTime.getUTCMonth() %  3 == 0) strFormat = "%m/%d";
          }
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 24 *  3)
      {
        if (objTime.getUTCDate() == 1)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCMonth(objNext.getUTCMonth() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;

                 if (objTime.getUTCMonth() % 12 == 0) strFormat = flgJpCalendar ? "%m<br/>%jp年" : "%m<br/>%y";
            else if (objTime.getUTCMonth() %  6 == 0) strFormat = "%m";
          }
          else
          {
                 if (objTime.getUTCMonth() % 12 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
            else if (objTime.getUTCMonth() %  6 == 0) strFormat = "%m/%d";
          }
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 24 *  9)
      {
        if (objTime.getUTCMonth() == 0)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCFullYear(objNext.getUTCFullYear() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;
          }

          strFormat = flgJpCalendar ? "%jp年" : "%y";
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 24 * 30)
      {
        if (objTime.getUTCFullYear() % 5 == 0)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCFullYear(objNext.getUTCFullYear() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;
          }

          strFormat = flgJpCalendar ? "%jp年" : "%y";
        }
      }
      else
      {
        if (objTime.getUTCFullYear() % 10 == 0)
        {
          if (typeof strLabelPosition == "string" && strLabelPosition == "range")
          {
            objNext  = new Date(objTime.getTime()); objNext.setUTCFullYear(objNext.getUTCFullYear() + 1);
            intWidth = (objNext.getTime() - objTime.getTime()) / intScale;
          }

          strFormat = flgJpCalendar ? "%jp年" : "%y";
        }
      }
/*-----* append label *-------------------------------------------------------*/
      if (strFormat.length > 0)
      {
        var $label = $("<span class='k2go-timeline-label'>" + _formatDate($(pElement).data("time.k2goTimeline"), strFormat, intOffset) + "</span>");

        $(pElement).addClass("k2go-timeline-scale-l").append($label);

        if (intWidth > 0)
        {
          if (intWidth >= $label.width()) $label.css({ left : "0px", width : intWidth + "px" });
            else                          $label.css({ left : ($label.width() - intWidth) / 2 * -1 + "px" });
        }
        else
          $label.css({ left : $label.width() / 2 * -1 + "px" });
      }
    });
  }
  catch(pError)
  {
    console.error("jQuery.k2goTimeline _setLabel error: " + pError);
  }
}
/******************************************************************************/
/* _getScaleInterval                                                          */
/******************************************************************************/
function _getScaleInterval(pScale)
{
       if (pScale <=    1                    ) return { value :  10, unit : "ms" };
  else if (pScale <=    5                    ) return { value :  50, unit : "ms" };
  else if (pScale <=   10                    ) return { value : 100, unit : "ms" };
  else if (pScale <=   50                    ) return { value : 500, unit : "ms" };
  else if (pScale <=  100                    ) return { value :   1, unit : "S"  };
  else if (pScale <=  500                    ) return { value :   5, unit : "S"  };
  else if (pScale <= 1000                    ) return { value :  10, unit : "S"  };
  else if (pScale <= 1000 *  2.5             ) return { value :  30, unit : "S"  };
  else if (pScale <= 1000 *  5               ) return { value :   1, unit : "M"  };
  else if (pScale <= 1000 * 30               ) return { value :   5, unit : "M"  };
  else if (pScale <= 1000 * 60               ) return { value :  10, unit : "M"  };
  else if (pScale <= 1000 * 60 *  2.5        ) return { value :  30, unit : "M"  };
  else if (pScale <= 1000 * 60 *  5          ) return { value :   1, unit : "H"  };
  else if (pScale <= 1000 * 60 * 10          ) return { value :   3, unit : "H"  };
  else if (pScale <= 1000 * 60 * 30          ) return { value :   6, unit : "H"  };
  else if (pScale <= 1000 * 60 * 60          ) return { value :  12, unit : "H"  };
  else if (pScale <= 1000 * 60 * 60 *  2     ) return { value :   1, unit : "d"  };
  else if (pScale <= 1000 * 60 * 60 *  8     ) return { value :   5, unit : "d"  };
  else if (pScale <= 1000 * 60 * 60 * 18     ) return { value :  15, unit : "d"  };
  else if (pScale <= 1000 * 60 * 60 * 24 *  3) return { value :   1, unit : "m"  };
  else if (pScale <= 1000 * 60 * 60 * 24 *  9) return { value :   3, unit : "m"  };
  else if (pScale <= 1000 * 60 * 60 * 24 * 30) return { value :   1, unit : "y"  };
  else                                         return { value :   2, unit : "y"  };
}
/******************************************************************************/
/* _roundTime                                                                 */
/******************************************************************************/
function _roundTime(pTime, pInterval, pOffset)
{
  pTime.setTime(pTime.getTime() + pOffset * 60 * 1000);

       if (pInterval.unit == "ms")   pTime.setUTCMilliseconds(Math.round(pTime.getUTCMilliseconds() / pInterval.value) * pInterval.value);
  else if (pInterval.unit == "S" )   pTime.setUTCSeconds     (Math.round(pTime.getUTCSeconds     () / pInterval.value) * pInterval.value, 0);
  else if (pInterval.unit == "M" )   pTime.setUTCMinutes     (Math.round(pTime.getUTCMinutes     () / pInterval.value) * pInterval.value, 0, 0);
  else if (pInterval.unit == "H" )   pTime.setUTCHours       (Math.round(pTime.getUTCHours       () / pInterval.value) * pInterval.value, 0, 0, 0);
  else if (pInterval.unit == "m" ) { pTime.setUTCMonth       (Math.round(pTime.getUTCMonth       () / pInterval.value) * pInterval.value, 1);    pTime.setUTCHours(0, 0, 0, 0); }
  else if (pInterval.unit == "y" ) { pTime.setUTCFullYear    (Math.round(pTime.getUTCFullYear    () / pInterval.value) * pInterval.value, 0, 1); pTime.setUTCHours(0, 0, 0, 0); }
  else if (pInterval.unit == "d" )
  {
    var objLastDate = new Date(Date.UTC(pTime.getUTCFullYear(), pTime.getUTCMonth() + 1, 0));

    pTime.setUTCDate(Math.round(pTime.getUTCDate() / pInterval.value) * pInterval.value + 1);

    if (pTime.getUTCDate() + pInterval.value - 1 > objLastDate.getUTCDate()) pTime.setUTCMonth(pTime.getUTCMonth() + 1, 1);

    pTime.setUTCHours(0, 0, 0, 0);
  }

  pTime.setTime(pTime.getTime() - pOffset * 60 * 1000);
}
/******************************************************************************/
/* _incrementTime                                                             */
/******************************************************************************/
function _incrementTime(pTime, pInterval, pOffset, pIncrement)
{
  var intIncrement = typeof pIncrement == "number" ? pIncrement : 1;

  pTime.setTime(pTime.getTime() + pOffset * 60 * 1000);

       if (pInterval.unit == "ms") pTime.setUTCMilliseconds(pTime.getUTCMilliseconds() + pInterval.value * intIncrement);
  else if (pInterval.unit == "S" ) pTime.setUTCSeconds     (pTime.getUTCSeconds     () + pInterval.value * intIncrement);
  else if (pInterval.unit == "M" ) pTime.setUTCMinutes     (pTime.getUTCMinutes     () + pInterval.value * intIncrement);
  else if (pInterval.unit == "H" ) pTime.setUTCHours       (pTime.getUTCHours       () + pInterval.value * intIncrement);
  else if (pInterval.unit == "m" ) pTime.setUTCMonth       (pTime.getUTCMonth       () + pInterval.value * intIncrement);
  else if (pInterval.unit == "y" ) pTime.setUTCFullYear    (pTime.getUTCFullYear    () + pInterval.value * intIncrement);
  else if (pInterval.unit == "d" )
  {
    pTime.setUTCDate(pTime.getUTCDate() + pInterval.value * intIncrement);
    pTime.setUTCDate(pTime.getUTCDate() - (pTime.getUTCDate() % pInterval.value - 1) * (pTime.getUTCDate() % pInterval.value == 0 ? 0 : 1));

    var objLastDate = new Date(Date.UTC(pTime.getUTCFullYear(), pTime.getUTCMonth() + 1, 0));

         if (pTime.getUTCDate() + pInterval.value - 1 > objLastDate.getUTCDate()) pTime.setUTCMonth(pTime.getUTCMonth() + 1, 1);
    else if (pTime.getUTCDate()                       < pInterval.value + 1     ) pTime.setUTCDate (1);
  }

  pTime.setTime(pTime.getTime() - pOffset * 60 * 1000);
}
/******************************************************************************/
/* _checkTimeInfo                                                             */
/******************************************************************************/
function _checkTimeInfo(pTimeInfo)
{
  if (isNaN(pTimeInfo.    minTime.getTime())) throw "min time is invalid date";
  if (isNaN(pTimeInfo.    maxTime.getTime())) throw "max time is invalid date";
  if (isNaN(pTimeInfo.  startTime.getTime())) throw "start time is invalid date";
  if (isNaN(pTimeInfo.    endTime.getTime())) throw "end time is invalid date";
  if (isNaN(pTimeInfo.currentTime.getTime())) throw "current time is invalid date";

  if (pTimeInfo.    maxTime.getTime() <= pTimeInfo.   minTime.getTime()) throw "max time is out of range";

  if (pTimeInfo.  startTime.getTime() <  pTimeInfo.   minTime.getTime()) throw "start time is out of range";
  if (pTimeInfo.  startTime.getTime() >= pTimeInfo.   maxTime.getTime()) throw "start time is out of range";

  if (pTimeInfo.    endTime.getTime() <= pTimeInfo.   minTime.getTime()) throw "end time is out of range";
  if (pTimeInfo.    endTime.getTime() >  pTimeInfo.   maxTime.getTime()) throw "end time is out of range";
  if (pTimeInfo.    endTime.getTime() <= pTimeInfo. startTime.getTime()) throw "end time is out of range";

  if (pTimeInfo.currentTime.getTime() <  pTimeInfo.startTime.getTime()) throw "current time is out of range";
  if (pTimeInfo.currentTime.getTime() >  pTimeInfo.  endTime.getTime()) throw "current time is out of range";
}
/******************************************************************************/
/* _getTimeInfo                                                               */
/******************************************************************************/
function _getTimeInfo()
{
  var $main = $(".k2go-timeline-main");

  return {
    startTime   : new Date($main.data("options.k2goTimeline").  startTime.getTime()),
    endTime     : new Date($main.data("options.k2goTimeline").    endTime.getTime()),
    currentTime : new Date($main.data("options.k2goTimeline").currentTime.getTime())
  };
}
/******************************************************************************/
/* _getRangeInfo                                                              */
/******************************************************************************/
function _getRangeInfo()
{
  var $main = $(".k2go-timeline-main");

  return {
    rangeStartTime : new Date($main.data("options.k2goTimeline").rangeStartTime.getTime()),
    rangeEndTime   : new Date($main.data("options.k2goTimeline").rangeEndTime  .getTime())
  };
}
/******************************************************************************/
/* _formatDate                                                                */
/******************************************************************************/
function _formatDate(pDate, pFormatString, pOffset)
{
  var intOffset = typeof pOffset == "number" ? pOffset : (new Date()).getTimezoneOffset() * -1;
  var objDate   = new Date(pDate.getTime() + intOffset * 60 * 1000);
  var strResult = pFormatString;

  strResult = strResult.replace(/%y/g ,          objDate.getUTCFullYear    ()      .toString(  ));
  strResult = strResult.replace(/%mm/g, ("0"  + (objDate.getUTCMonth       () + 1)).slice   (-2));
  strResult = strResult.replace(/%m/g ,         (objDate.getUTCMonth       () + 1) .toString(  ));
  strResult = strResult.replace(/%dd/g, ("0"  + (objDate.getUTCDate        ()    )).slice   (-2));
  strResult = strResult.replace(/%d/g ,          objDate.getUTCDate        ()      .toString(  ));
  strResult = strResult.replace(/%H/g , ("0"  +  objDate.getUTCHours       ()     ).slice   (-2));
  strResult = strResult.replace(/%M/g , ("0"  +  objDate.getUTCMinutes     ()     ).slice   (-2));
  strResult = strResult.replace(/%S/g , ("0"  +  objDate.getUTCSeconds     ()     ).slice   (-2));
  strResult = strResult.replace(/%N/g , ("00" +  objDate.getUTCMilliseconds()     ).slice   (-3));

  if (strResult.indexOf("%jp") > -1)
  {
         if (objDate.getTime() < (new Date(Date.UTC( 650,  2, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大化" + (objDate.getUTCFullYear() -  644).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 654, 10, 24, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "白雉" + (objDate.getUTCFullYear() -  649).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 686,  7, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "－－" + (objDate.getUTCFullYear() -  653).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 686,  9,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "朱鳥" + (objDate.getUTCFullYear() -  685).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 701,  4,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "－－" + (objDate.getUTCFullYear() -  685).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 704,  5, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大宝" + (objDate.getUTCFullYear() -  700).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 708,  1,  7, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "慶雲" + (objDate.getUTCFullYear() -  703).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 715,  9,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "和銅" + (objDate.getUTCFullYear() -  707).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 717, 11, 24, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "霊亀" + (objDate.getUTCFullYear() -  714).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 724,  2,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "養老" + (objDate.getUTCFullYear() -  716).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 729,  8,  2, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "神亀" + (objDate.getUTCFullYear() -  723).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 749,  4,  4, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天平" + (objDate.getUTCFullYear() -  728).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 749,  7, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "感宝" + (objDate.getUTCFullYear() -  748).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 757,  8,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "勝宝" + (objDate.getUTCFullYear() -  748).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 765,  1,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝字" + (objDate.getUTCFullYear() -  756).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 767,  8, 13, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "神護" + (objDate.getUTCFullYear() -  764).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 770,  9, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "景雲" + (objDate.getUTCFullYear() -  766).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 781,  0, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝亀" + (objDate.getUTCFullYear() -  769).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 782,  8, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天応" + (objDate.getUTCFullYear() -  780).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 806,  5,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延暦" + (objDate.getUTCFullYear() -  781).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 810,  9, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大同" + (objDate.getUTCFullYear() -  805).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 824,  1,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘仁" + (objDate.getUTCFullYear() -  809).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 834,  1, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天長" + (objDate.getUTCFullYear() -  823).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 848,  6, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承和" + (objDate.getUTCFullYear() -  833).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 851,  5,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉祥" + (objDate.getUTCFullYear() -  847).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 854, 11, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "仁寿" + (objDate.getUTCFullYear() -  850).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 857,  2, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "斉衡" + (objDate.getUTCFullYear() -  853).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 859,  4, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天安" + (objDate.getUTCFullYear() -  856).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 877,  5,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "貞観" + (objDate.getUTCFullYear() -  858).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 885,  2, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元慶" + (objDate.getUTCFullYear() -  876).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 889,  4, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "仁和" + (objDate.getUTCFullYear() -  884).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 898,  4, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛平" + (objDate.getUTCFullYear() -  888).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 901,  7, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "昌泰" + (objDate.getUTCFullYear() -  897).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 923,  4, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延喜" + (objDate.getUTCFullYear() -  900).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 931,  4, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延長" + (objDate.getUTCFullYear() -  922).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 938,  5, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承平" + (objDate.getUTCFullYear() -  930).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 947,  4, 15, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天慶" + (objDate.getUTCFullYear() -  937).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 957, 10, 21, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天暦" + (objDate.getUTCFullYear() -  946).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 961,  2,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天徳" + (objDate.getUTCFullYear() -  956).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 964,  7, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応和" + (objDate.getUTCFullYear() -  960).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 968,  8,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康保" + (objDate.getUTCFullYear() -  963).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 970,  4,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "安和" + (objDate.getUTCFullYear() -  967).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 974,  0, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天禄" + (objDate.getUTCFullYear() -  969).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 976,  7, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天延" + (objDate.getUTCFullYear() -  973).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 978, 11, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "貞元" + (objDate.getUTCFullYear() -  975).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 983,  4, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天元" + (objDate.getUTCFullYear() -  977).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 985,  4, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永観" + (objDate.getUTCFullYear() -  982).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 987,  4,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛和" + (objDate.getUTCFullYear() -  984).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 989,  8, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永延" + (objDate.getUTCFullYear() -  986).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 990, 10, 26, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永祚" + (objDate.getUTCFullYear() -  988).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 995,  2, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正暦" + (objDate.getUTCFullYear() -  989).toString());
    else if (objDate.getTime() < (new Date(Date.UTC( 999,  1,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長徳" + (objDate.getUTCFullYear() -  994).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1004,  7,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長保" + (objDate.getUTCFullYear() -  998).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1013,  1,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛弘" + (objDate.getUTCFullYear() - 1003).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1017,  4, 21, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長和" + (objDate.getUTCFullYear() - 1012).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1021,  2, 17, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛仁" + (objDate.getUTCFullYear() - 1016).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1024,  7, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "治安" + (objDate.getUTCFullYear() - 1020).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1028,  7, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "万寿" + (objDate.getUTCFullYear() - 1023).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1037,  4,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長元" + (objDate.getUTCFullYear() - 1027).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1040, 11, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長暦" + (objDate.getUTCFullYear() - 1036).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1044, 11, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長久" + (objDate.getUTCFullYear() - 1039).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1046,  4, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛徳" + (objDate.getUTCFullYear() - 1043).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1053,  1,  2, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永承" + (objDate.getUTCFullYear() - 1045).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1058,  8, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天喜" + (objDate.getUTCFullYear() - 1052).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1065,  8,  4, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康平" + (objDate.getUTCFullYear() - 1057).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1069,  4,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "治暦" + (objDate.getUTCFullYear() - 1064).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1074,  8, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延久" + (objDate.getUTCFullYear() - 1068).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1077, 11,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承保" + (objDate.getUTCFullYear() - 1073).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1081,  2, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承暦" + (objDate.getUTCFullYear() - 1076).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1084,  2, 15, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永保" + (objDate.getUTCFullYear() - 1080).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1087,  4, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応徳" + (objDate.getUTCFullYear() - 1083).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1095,  0, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛治" + (objDate.getUTCFullYear() - 1086).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1097,  0,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉保" + (objDate.getUTCFullYear() - 1094).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1097, 11, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永長" + (objDate.getUTCFullYear() - 1096).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1099,  8, 15, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承徳" + (objDate.getUTCFullYear() - 1096).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1104,  2,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康和" + (objDate.getUTCFullYear() - 1098).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1106,  4, 13, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長治" + (objDate.getUTCFullYear() - 1103).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1108,  8,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉承" + (objDate.getUTCFullYear() - 1105).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1110,  6, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天仁" + (objDate.getUTCFullYear() - 1107).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1113,  7, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天永" + (objDate.getUTCFullYear() - 1109).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1118,  3, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永久" + (objDate.getUTCFullYear() - 1112).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1120,  4,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元永" + (objDate.getUTCFullYear() - 1117).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1124,  4, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "保安" + (objDate.getUTCFullYear() - 1119).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1126,  1, 15, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天治" + (objDate.getUTCFullYear() - 1123).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1131,  1, 28, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大治" + (objDate.getUTCFullYear() - 1125).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1132,  8, 21, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天承" + (objDate.getUTCFullYear() - 1130).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1135,  5, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長承" + (objDate.getUTCFullYear() - 1131).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1141,  7, 13, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "保延" + (objDate.getUTCFullYear() - 1134).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1142,  4, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永治" + (objDate.getUTCFullYear() - 1140).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1144,  2, 28, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康治" + (objDate.getUTCFullYear() - 1141).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1145,  7, 12, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天養" + (objDate.getUTCFullYear() - 1143).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1151,  1, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "久安" + (objDate.getUTCFullYear() - 1144).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1154, 11,  4, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "仁平" + (objDate.getUTCFullYear() - 1150).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1156,  4, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "久寿" + (objDate.getUTCFullYear() - 1153).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1159,  4,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "保元" + (objDate.getUTCFullYear() - 1155).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1160,  1, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "平治" + (objDate.getUTCFullYear() - 1158).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1161,  8, 24, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永暦" + (objDate.getUTCFullYear() - 1159).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1163,  4,  4, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応保" + (objDate.getUTCFullYear() - 1160).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1165,  6, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長寛" + (objDate.getUTCFullYear() - 1162).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1166,  8, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永万" + (objDate.getUTCFullYear() - 1164).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1169,  4,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "仁安" + (objDate.getUTCFullYear() - 1165).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1171,  4, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉応" + (objDate.getUTCFullYear() - 1168).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1175,  7, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承安" + (objDate.getUTCFullYear() - 1170).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1177,  7, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "安元" + (objDate.getUTCFullYear() - 1174).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1181,  7, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "治承" + (objDate.getUTCFullYear() - 1176).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1182,  5, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "養和" + (objDate.getUTCFullYear() - 1180).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1184,  4, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寿永" + (objDate.getUTCFullYear() - 1181).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1185,  8,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元暦" + (objDate.getUTCFullYear() - 1183).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1190,  4, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文治" + (objDate.getUTCFullYear() - 1184).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1199,  4, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建久" + (objDate.getUTCFullYear() - 1189).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1201,  2, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正治" + (objDate.getUTCFullYear() - 1198).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1204,  2, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建仁" + (objDate.getUTCFullYear() - 1200).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1206,  5,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元久" + (objDate.getUTCFullYear() - 1203).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1207, 10, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建永" + (objDate.getUTCFullYear() - 1205).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1211,  3, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承元" + (objDate.getUTCFullYear() - 1206).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1214,  0, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建暦" + (objDate.getUTCFullYear() - 1210).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1219,  4, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建保" + (objDate.getUTCFullYear() - 1213).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1222,  4, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承久" + (objDate.getUTCFullYear() - 1218).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1224, 11, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "貞応" + (objDate.getUTCFullYear() - 1221).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1225,  4, 28, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元仁" + (objDate.getUTCFullYear() - 1223).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1228,  0, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉禄" + (objDate.getUTCFullYear() - 1224).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1229,  2, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "安貞" + (objDate.getUTCFullYear() - 1227).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1232,  3, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛喜" + (objDate.getUTCFullYear() - 1228).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1233,  4, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "貞永" + (objDate.getUTCFullYear() - 1231).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1234, 10, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天福" + (objDate.getUTCFullYear() - 1232).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1235, 10,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文暦" + (objDate.getUTCFullYear() - 1233).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1238, 11, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉禎" + (objDate.getUTCFullYear() - 1234).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1239,  2, 13, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "暦仁" + (objDate.getUTCFullYear() - 1237).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1240,  7,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延応" + (objDate.getUTCFullYear() - 1238).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1243,  2, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "仁治" + (objDate.getUTCFullYear() - 1239).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1247,  3,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛元" + (objDate.getUTCFullYear() - 1242).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1249,  4,  2, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝治" + (objDate.getUTCFullYear() - 1246).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1256,  9, 24, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建長" + (objDate.getUTCFullYear() - 1248).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1257,  2, 31, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康元" + (objDate.getUTCFullYear() - 1255).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1259,  3, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正嘉" + (objDate.getUTCFullYear() - 1256).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1260,  4, 24, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正元" + (objDate.getUTCFullYear() - 1258).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1261,  2, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文応" + (objDate.getUTCFullYear() - 1259).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1264,  2, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘長" + (objDate.getUTCFullYear() - 1260).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1275,  4, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文永" + (objDate.getUTCFullYear() - 1263).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1278,  2, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建治" + (objDate.getUTCFullYear() - 1274).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1288,  4, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘安" + (objDate.getUTCFullYear() - 1277).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1293,  8,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正応" + (objDate.getUTCFullYear() - 1287).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1299,  4, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永仁" + (objDate.getUTCFullYear() - 1292).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1302, 11, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正安" + (objDate.getUTCFullYear() - 1298).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1303,  8, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "乾元" + (objDate.getUTCFullYear() - 1301).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1307,  0, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉元" + (objDate.getUTCFullYear() - 1302).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1308, 10, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "徳治" + (objDate.getUTCFullYear() - 1306).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1311,  4, 17, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延慶" + (objDate.getUTCFullYear() - 1307).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1312,  3, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応長" + (objDate.getUTCFullYear() - 1310).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1317,  2, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正和" + (objDate.getUTCFullYear() - 1311).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1319,  4, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文保" + (objDate.getUTCFullYear() - 1316).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1321,  2, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元応" + (objDate.getUTCFullYear() - 1318).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1324, 11, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元亨" + (objDate.getUTCFullYear() - 1320).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1326,  4, 28, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正中" + (objDate.getUTCFullYear() - 1323).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1329,  8, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉暦" + (objDate.getUTCFullYear() - 1325).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1331,  8, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元徳" + (objDate.getUTCFullYear() - 1328).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1334,  2,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元弘" + (objDate.getUTCFullYear() - 1330).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1336,  3, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建武" + (objDate.getUTCFullYear() - 1333).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1340,  4, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延元" + (objDate.getUTCFullYear() - 1335).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1347,  0, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "興国" + (objDate.getUTCFullYear() - 1339).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1370,  7, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正平" + (objDate.getUTCFullYear() - 1346).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1372,  4,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "建徳" + (objDate.getUTCFullYear() - 1369).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1375,  5, 26, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文中" + (objDate.getUTCFullYear() - 1371).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1381,  2,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天授" + (objDate.getUTCFullYear() - 1374).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1384,  4, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘和" + (objDate.getUTCFullYear() - 1380).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1394,  7,  2, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "明徳" + (objDate.getUTCFullYear() - 1383).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1428,  5, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応永" + (objDate.getUTCFullYear() - 1393).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1429,  9,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正長" + (objDate.getUTCFullYear() - 1427).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1441,  2, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永享" + (objDate.getUTCFullYear() - 1428).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1444,  1, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉吉" + (objDate.getUTCFullYear() - 1440).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1449,  7, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文安" + (objDate.getUTCFullYear() - 1443).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1452,  7, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝徳" + (objDate.getUTCFullYear() - 1448).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1455,  8,  6, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "享徳" + (objDate.getUTCFullYear() - 1451).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1457,  9, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "康正" + (objDate.getUTCFullYear() - 1454).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1461,  1,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長禄" + (objDate.getUTCFullYear() - 1456).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1466,  2, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛正" + (objDate.getUTCFullYear() - 1460).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1467,  3,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文正" + (objDate.getUTCFullYear() - 1465).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1469,  5,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "応仁" + (objDate.getUTCFullYear() - 1466).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1487,  7,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文明" + (objDate.getUTCFullYear() - 1468).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1489,  8, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "長享" + (objDate.getUTCFullYear() - 1486).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1492,  7, 12, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延徳" + (objDate.getUTCFullYear() - 1488).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1501,  2, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "明応" + (objDate.getUTCFullYear() - 1491).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1504,  2, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文亀" + (objDate.getUTCFullYear() - 1500).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1521,  8, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永正" + (objDate.getUTCFullYear() - 1503).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1528,  8,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大永" + (objDate.getUTCFullYear() - 1520).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1532,  7, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "享禄" + (objDate.getUTCFullYear() - 1527).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1555, 10,  7, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天文" + (objDate.getUTCFullYear() - 1531).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1558,  2, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘治" + (objDate.getUTCFullYear() - 1554).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1570,  4, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "永禄" + (objDate.getUTCFullYear() - 1557).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1573,  7, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元亀" + (objDate.getUTCFullYear() - 1569).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1593,  0, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天正" + (objDate.getUTCFullYear() - 1572).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1596, 11, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文禄" + (objDate.getUTCFullYear() - 1592).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1615,  8,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "慶長" + (objDate.getUTCFullYear() - 1595).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1624,  3, 17, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元和" + (objDate.getUTCFullYear() - 1614).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1645,  0, 13, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛永" + (objDate.getUTCFullYear() - 1623).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1648,  3,  7, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正保" + (objDate.getUTCFullYear() - 1644).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1652,  9, 20, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "慶安" + (objDate.getUTCFullYear() - 1647).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1655,  4, 18, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "承応" + (objDate.getUTCFullYear() - 1651).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1658,  7, 21, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "明暦" + (objDate.getUTCFullYear() - 1654).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1661,  4, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "万治" + (objDate.getUTCFullYear() - 1657).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1673,  9, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛文" + (objDate.getUTCFullYear() - 1660).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1681, 10,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延宝" + (objDate.getUTCFullYear() - 1672).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1684,  3,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天和" + (objDate.getUTCFullYear() - 1680).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1688,  9, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "貞享" + (objDate.getUTCFullYear() - 1683).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1704,  3, 16, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元禄" + (objDate.getUTCFullYear() - 1687).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1711,  5, 11, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝永" + (objDate.getUTCFullYear() - 1703).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1716,  7,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "正徳" + (objDate.getUTCFullYear() - 1710).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1736,  5,  7, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "享保" + (objDate.getUTCFullYear() - 1715).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1741,  3, 12, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元文" + (objDate.getUTCFullYear() - 1735).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1744,  3,  3, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛保" + (objDate.getUTCFullYear() - 1740).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1748,  7,  5, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "延享" + (objDate.getUTCFullYear() - 1743).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1751, 11, 14, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛延" + (objDate.getUTCFullYear() - 1747).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1764,  5, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "宝暦" + (objDate.getUTCFullYear() - 1750).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1772, 11, 10, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "明和" + (objDate.getUTCFullYear() - 1763).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1781,  3, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "安永" + (objDate.getUTCFullYear() - 1771).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1789,  1, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天明" + (objDate.getUTCFullYear() - 1780).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1801,  2, 19, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "寛政" + (objDate.getUTCFullYear() - 1788).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1804,  2, 22, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "享和" + (objDate.getUTCFullYear() - 1800).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1818,  4, 26, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文化" + (objDate.getUTCFullYear() - 1803).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1831,  0, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文政" + (objDate.getUTCFullYear() - 1817).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1845,  0,  9, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "天保" + (objDate.getUTCFullYear() - 1830).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1848,  3,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "弘化" + (objDate.getUTCFullYear() - 1844).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1855,  0, 15, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "嘉永" + (objDate.getUTCFullYear() - 1847).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1860,  3,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "安政" + (objDate.getUTCFullYear() - 1854).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1861,  2, 29, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "万延" + (objDate.getUTCFullYear() - 1859).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1864,  2, 27, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "文久" + (objDate.getUTCFullYear() - 1860).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1865,  4,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "元治" + (objDate.getUTCFullYear() - 1863).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1868,  9, 23, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "慶応" + (objDate.getUTCFullYear() - 1864).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1912,  6, 30, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "明治" + (objDate.getUTCFullYear() - 1867).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1926, 11, 25, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "大正" + (objDate.getUTCFullYear() - 1911).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(1989,  0,  8, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "昭和" + (objDate.getUTCFullYear() - 1925).toString());
    else if (objDate.getTime() < (new Date(Date.UTC(2019,  4,  1, 0, 0, 0, 0))).getTime()) strResult = strResult.replace(/%jp/g , "平成" + (objDate.getUTCFullYear() - 1988).toString());
    else                                                                                   strResult = strResult.replace(/%jp/g , "令和" + (objDate.getUTCFullYear() - 2018).toString());
  }

  return strResult;
}
/******************************************************************************/
/* entry point                                                                */
/******************************************************************************/
$.fn.k2goTimeline = function(pMethod)
{
       if (typeof pMethod == "object" || !pMethod) return objMethods["initialize"].apply(this, arguments);
  else if (objMethods[pMethod]                   ) return objMethods[pMethod     ].apply(this, Array.prototype.slice.call(arguments, 1));
  else                                             $.error("Method " +  pMethod + " does not exist on jQuery.k2goTimeline");
};})(jQuery);
