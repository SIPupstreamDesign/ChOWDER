;(function($){ var objMethods = {
/******************************************************************************/
/* k2go Timeline for JQuery Plugin                                            */
/* author    : Inoue Computer Service.                                        */
/* copyright : k2go                                                           */
/* version   : 1.2.0                                                          */
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
    var $pick         = $("<div class='k2go-timeline-pick'     ></div>");
    var $pickLine     = $("<div class='k2go-timeline-pick-line'></div>");
    var $pickKnob     = $("<div class='k2go-timeline-pick-knob'></div>");

    $main.on("contextmenu.k2goImageViewer", function(){ return false; });
/*-----* options *------------------------------------------------------------*/
    $main.data("options.k2goTimeline", $.extend(true,
    {
      startTime        :  new Date((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate(),  0,  0,  0,   0),
      endTime          :  new Date((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate(), 23, 59, 59, 999),
      currentTime      :  new Date(),
      minTime          :  new Date((new Date()).getFullYear() - 100, (new Date()).getMonth(), (new Date()).getDate(), (new Date()).getHours(), (new Date()).getMinutes(), (new Date()).getSeconds(), (new Date()).getMilliseconds()),
      maxTime          :  new Date((new Date()).getFullYear() + 100, (new Date()).getMonth(), (new Date()).getDate(), (new Date()).getHours(), (new Date()).getMinutes(), (new Date()).getSeconds(), (new Date()).getMilliseconds()),
      timezoneOffset   : (new Date()).getTimezoneOffset() * -1,
      jpCalendar       : false,
      minScale         : 1,
      maxScale         : 1000 * 60 * 60 * 24 * 60,
      disableMoveBar   : false,
      disableZoom      : false,
      pickLineDistance : { element : $("body"), position : "top" }
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
      if (flgEvent                       ) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
      if ($main.data("lock.k2goTimeline")) return;                                          else $main.data("lock.k2goTimeline", true);

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

      _movePick(pEvent.pageX);
      _zoomBar (intScale);
      _setLabel();

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
          if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
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
              $(document).off         ((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline");
              $this      .k2goTimeline( flgTouch ? "zoomIn"   : (pEvent.which == 3 ? "zoomOut" : "zoomIn"));
              $main      .data        ("dblTap.k2goTimeline", false);
              return;
            }
            else
            {
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
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

              flgSingle = flgEvent ? (event.touches.length == 1 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 1 ? true : false) : true;
              flgDouble = flgEvent ? (event.touches.length == 2 ? true : false) : flgTouch ? (pEvent.originalEvent.touches.length == 2 ? true : false) : false;

              if (flgSingle)
              {
                intMoveX1 = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - intBaseX1;
                intBaseX1 = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);

                _moveBar (intMoveX1, $main.data("options.k2goTimeline").syncPickAndBar);
                _setLabel();

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
                    _movePick(intX);
                    _zoomBar (intScale);
                    _setLabel();
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
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

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
/* pick.hover                                                                 */
/******************************************************************************/
/*-----* mouseenter *---------------------------------------------------------*/
    $pickKnob.on("mouseenter.k2goTimeline", function(pEvent)
    {
      try
      {
        if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

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
        if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
        if(!$main.data("drag.k2goTimeline")) $pickLine.css("height", "");
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
          if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
          if ($main.data("lock.k2goTimeline")) return;

          var intBaseX = flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX;
          var intMoveX = 0;

          if ($main.data("dblTap.k2goTimeline"))
          {
            $(document).off         ((flgTouch ? "touchend" : "mouseup") + ".k2goTimeline");
            $this      .k2goTimeline( flgTouch ? "zoomIn"   : (pEvent.which == 3 ? "zoomOut" : "zoomIn"));
            $main      .data        ("dblTap.k2goTimeline", false);
            return false;
          }
          else
          {
            $main    .data   (    "dblTap.k2goTimeline", true);
            $main    .data   (      "drag.k2goTimeline", true);
            $pickKnob.trigger("mouseenter.k2goTimeline");

            if (typeof $main.data("options.k2goTimeline").pickMoveStart == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickMoveStart(_getTimeInfo()); }, 1);
          }

          setTimeout(function(){ $main.data("dblTap.k2goTimeline", false); }, 300);
/*-----* move *---------------------------------------------------------------*/
          var fncMove = function(pEvent)
          {
            try
            {
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

              intMoveX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX) - intBaseX;
              intBaseX = (flgEvent ? event.changedTouches[0].pageX : flgTouch ? pEvent.originalEvent.touches.item(0).pageX : pEvent.pageX);

              if ($rail.offset().left <= intBaseX && intBaseX <= $rail.offset().left + $rail.width())
              {
                if ($main.data("options.k2goTimeline").syncPickAndBar)
                {
                  _moveBar (intMoveX, true);
                  _setLabel();
                }
                else
                  _movePick(intBaseX);

                if (typeof $main.data("options.k2goTimeline").pickMove == "function") setTimeout(function() { $main.data("options.k2goTimeline").pickMove(_getTimeInfo()); }, 1);
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
              if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }

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
          if (flgEvent) { if(event.cancelable) event.preventDefault(); } else { if(pEvent.cancelable) pEvent.preventDefault(); }
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
      startTime      : new Date($main.data("options.k2goTimeline").  startTime.getTime()),
      endTime        : new Date($main.data("options.k2goTimeline").    endTime.getTime()),
      currentTime    : new Date($main.data("options.k2goTimeline").currentTime.getTime()),
      minTime        : new Date($main.data("options.k2goTimeline").    minTime.getTime()),
      maxTime        : new Date($main.data("options.k2goTimeline").    maxTime.getTime()),
      timezoneOffset :          $main.data("options.k2goTimeline").timezoneOffset,
      jpCalendar     :          $main.data("options.k2goTimeline").jpCalendar,
      scale          :          $main.data("options.k2goTimeline").scale,
      minScale       :          $main.data("options.k2goTimeline").minScale,
      maxScale       :          $main.data("options.k2goTimeline").maxScale,
      disableMoveBar :          $main.data("options.k2goTimeline").disableMoveBar,
      disableZoom    :          $main.data("options.k2goTimeline").disableZoom,
      syncPickAndBar :          $main.data("options.k2goTimeline").syncPickAndBar,
      timeChange     :          $main.data("options.k2goTimeline").timeChange,
      railClick      :          $main.data("options.k2goTimeline").railClick,
      pickMoveStart  :          $main.data("options.k2goTimeline").pickMoveStart,
      pickMove       :          $main.data("options.k2goTimeline").pickMove,
      pickMoveEnd    :          $main.data("options.k2goTimeline").pickMoveEnd,
      barMoveStart   :          $main.data("options.k2goTimeline").barMoveStart,
      barMove        :          $main.data("options.k2goTimeline").barMove,
      barMoveEnd     :          $main.data("options.k2goTimeline").barMoveEnd,
      zoomStart      :          $main.data("options.k2goTimeline").zoomStart,
      zoom           :          $main.data("options.k2goTimeline").zoom,
      zoomEnd        :          $main.data("options.k2goTimeline").zoomEnd
    };
  },
/******************************************************************************/
/* create                                                                     */
/******************************************************************************/
  create : function(pOptions)
  {
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
        setTimeout(_loop, 50);
      }
      else
      {
        $main.data("options.k2goTimeline").    minTime.setTime(pOptions.timeInfo.    minTime.getTime());
        $main.data("options.k2goTimeline").    maxTime.setTime(pOptions.timeInfo.    maxTime.getTime());
        $main.data("options.k2goTimeline").  startTime.setTime(pOptions.timeInfo.  startTime.getTime());
        $main.data("options.k2goTimeline").    endTime.setTime(pOptions.timeInfo.    endTime.getTime());
        $main.data("options.k2goTimeline").currentTime.setTime(pOptions.timeInfo.currentTime.getTime());

        _create  ();
        _setLabel();

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
      _zoomBar ($main.data("options.k2goTimeline").scale * 0.1 * pScale);
      _setLabel();
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

    objTimeInfo.  startTime =          new Date($main.data("options.k2goTimeline").  startTime.getTime() - $main.data("options.k2goTimeline").scale * pMoveX);
    objTimeInfo.    endTime =          new Date($main.data("options.k2goTimeline").    endTime.getTime() - $main.data("options.k2goTimeline").scale * pMoveX);
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
      $pick.css("left", intLeft + "px");

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
    var $main         = $(".k2go-timeline-main");
    var $bar          = $(".k2go-timeline-bar" );
    var intOffset     = $main.data("options.k2goTimeline").timezoneOffset;
    var flgJpCalendar = $main.data("options.k2goTimeline").jpCalendar;
    var intScale      = $main.data("options.k2goTimeline").scale;
    var objInterval   = $main.data("options.k2goTimeline").scaleInterval;

    $bar.find    (".k2go-timeline-label").remove     ();
    $bar.children()                      .removeClass("k2go-timeline-scale-l");

    $bar.children().each(function(pIndex, pElement)
    {
      var objTime   = new Date($(pElement).data("time.k2goTimeline").getTime() + intOffset * 60 * 1000);
      var strFormat = "";

           if (intScale <= 1)
      {
             if (objTime.getTime() %   500       == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   100       == 0) strFormat = "%N";
      }
      else if (intScale <= 5)
      {
             if (objTime.getTime() % (1000 *  2) == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   250       == 0) strFormat = "%N";
      }
      else if (intScale <= 10)
      {
             if (objTime.getTime() % (1000 *  5) == 0) strFormat = flgJpCalendar ? "%N<br/>%jp年%mm月%dd日 %H時%M分%S秒" : "%N<br/>%y/%mm/%dd %H:%M:%S";
        else if (objTime.getTime() %   500       == 0) strFormat = "%N";
      }
      else if (intScale <= 25)
      {
             if (objTime.getTime() % (1000 * 10) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() %  1000       == 0) strFormat = "%S";
      }
      else if (intScale <= 50)
      {
             if (objTime.getTime() % (1000 * 20) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 *  2) == 0) strFormat = "%S";
      }
      else if (intScale <= 100)
      {
             if (objTime.getTime() % (1000 * 30) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 *  5) == 0) strFormat = "%S";
      }
      else if (intScale <= 250)
      {
             if (objTime.getTime() % (1000 * 60) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 * 10) == 0) strFormat = "%S";
      }
      else if (intScale <= 500)
      {
             if (objTime.getTime() % (1000 * 60 *  2) == 0) strFormat = flgJpCalendar ? "%S<br/>%jp年%m月%d日 %H時%M分" : "%S<br/>%y/%mm/%dd %H:%M";
        else if (objTime.getTime() % (1000 * 30     ) == 0) strFormat = "%S";
      }
      else if (intScale <= 1000)
      {
             if (objTime.getTime() % (1000 * 60 *  5) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60     ) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 *  2.5)
      {
             if (objTime.getTime() % (1000 * 60 * 10) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 *  5) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 *  5)
      {
             if (objTime.getTime() % (1000 * 60 * 30) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 10) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 15)
      {
             if (objTime.getTime() % (1000 * 60 * 60) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 30) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 30)
      {
             if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 60)
      {
             if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 60     ) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 60 *  2.5)
      {
             if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 60 *  3) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 60 *  5)
      {
             if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 60 *  6) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 60 * 10)
      {
             if (objTime.getTime() % (1000 * 60 * 60 * 24) == 0) strFormat = flgJpCalendar ? "%H:%M<br/>%jp年%m月%d日" : "%H:%M<br/>%y/%mm/%dd";
        else if (objTime.getTime() % (1000 * 60 * 60 * 12) == 0) strFormat = "%H:%M";
      }
      else if (intScale <= 1000 * 60 * 30)
      {
        if (objTime.getUTCHours() == 0)
        {
          if (objTime.getUTCDate () < 31 && objTime.getUTCDate() %  5 == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else                                                              strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60)
      {
        if (objTime.getUTCHours() == 0)
        {
               if (objTime.getUTCDate() < 31 && objTime.getUTCDate() % 15 == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else if (objTime.getUTCDate() < 31 && objTime.getUTCDate() %  5 == 1) strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 *  2)
      {
        if (objTime.getUTCDate() < 31 && objTime.getUTCDate() % 15 == 1)
        {
               if (objTime.getUTCDate() == 1) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else                                strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 *  8)
      {
        if (objTime.getUTCDate() == 1)
        {
          if (objTime.getUTCMonth() % 3 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else                                strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 18)
      {
        if (objTime.getUTCDate() == 1)
        {
               if (objTime.getUTCMonth() %  6 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else if (objTime.getUTCMonth() %  3 == 0) strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 24 *  3)
      {
        if (objTime.getUTCDate() == 1)
        {
               if (objTime.getUTCMonth() % 12 == 0) strFormat = flgJpCalendar ? "%m/%d<br/>%jp年" : "%m/%d<br/>%y";
          else if (objTime.getUTCMonth() %  6 == 0) strFormat = "%m/%d";
        }
      }
      else if (intScale <= 1000 * 60 * 60 * 24 *  9)
      {
        if (objTime.getUTCMonth() == 0) strFormat = flgJpCalendar ? "%jp年" : "%y";
      }
      else if (intScale <= 1000 * 60 * 60 * 24 * 30)
      {
        if (objTime.getUTCFullYear() %  5 == 0) strFormat = flgJpCalendar ? "%jp年" : "%y";
      }
      else
      {
        if (objTime.getUTCFullYear() % 10 == 0) strFormat = flgJpCalendar ? "%jp年" : "%y";
      }
/*-----* append label *-------------------------------------------------------*/
      if (strFormat.length > 0)
      {
        var $label = $("<span class='k2go-timeline-label'>" + _formatDate($(pElement).data("time.k2goTimeline"), strFormat, intOffset) + "</span>");

        $(pElement).addClass("k2go-timeline-scale-l").append($label);
        $label     .css     ("left", $label.width() / 2 * -1 + "px");
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
         if (objDate.getTime() <= (new Date(Date.UTC(1781,  3,  1, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "安永" + (objDate.getUTCFullYear() - 1771).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1789,  0, 24, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "天明" + (objDate.getUTCFullYear() - 1780).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1801,  1,  4, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "寛政" + (objDate.getUTCFullYear() - 1788).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1804,  1, 10, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "享和" + (objDate.getUTCFullYear() - 1800).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1818,  3, 21, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "文化" + (objDate.getUTCFullYear() - 1803).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1830, 11,  9, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "文政" + (objDate.getUTCFullYear() - 1817).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1844, 11,  1, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "天保" + (objDate.getUTCFullYear() - 1829).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1848,  1, 27, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "弘化" + (objDate.getUTCFullYear() - 1843).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1854, 10, 26, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "嘉永" + (objDate.getUTCFullYear() - 1847).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1860,  2, 17, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "安政" + (objDate.getUTCFullYear() - 1853).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1861,  1, 18, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "万延" + (objDate.getUTCFullYear() - 1859).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1864,  1, 19, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "文久" + (objDate.getUTCFullYear() - 1860).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1865,  3,  6, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "元治" + (objDate.getUTCFullYear() - 1863).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1868,  8,  7, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "慶応" + (objDate.getUTCFullYear() - 1864).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1912,  6, 29, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "明治" + (objDate.getUTCFullYear() - 1867).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1926, 11, 24, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "大正" + (objDate.getUTCFullYear() - 1911).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(1989,  0,  7, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "昭和" + (objDate.getUTCFullYear() - 1925).toString());
    else if (objDate.getTime() <= (new Date(Date.UTC(2019,  3, 30, 23, 59, 59, 999))).getTime()) strResult = strResult.replace(/%jp/g , "平成" + (objDate.getUTCFullYear() - 1988).toString());
    else                                                                                         strResult = strResult.replace(/%jp/g , "令和" + (objDate.getUTCFullYear() - 2018).toString());
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
