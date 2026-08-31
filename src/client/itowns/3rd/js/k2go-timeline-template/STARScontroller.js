/******************************************************************************/
/* Sample for k2goTimeline                                                    */
/* halloweenjack inc.                                                         */
/******************************************************************************/
/******************************************************************************/
/*  STARScontroller_getDate                                                   */
/******************************************************************************/
function STARScontroller_getDate()
{
  var objOptions = $("#timeline").k2goTimeline("getOptions");
  var objTimeInfo = {};
  
  objTimeInfo.currentDate = objOptions.currentTime;
  objTimeInfo.startDate   = objOptions.startTime;
  objTimeInfo.endDate     = objOptions.endTime;
  
  return objTimeInfo;
}
/******************************************************************************/
/*  STARScontroller_setDate                                                   */
/******************************************************************************/
function STARScontroller_setDate(pDate)
{
  if ($Env.starting == true)
  {
    if ($("#current_time").hasClass("timeNowPlay")) {$("#current_time").trigger("click")}
    else                                            {$("#button_stop" ).trigger("click")} 
  }
  else
  {  
    var objTimeInfo = {};
    
    objTimeInfo.minTime     = new Date($Env.minTime     .getTime());
    objTimeInfo.maxTime     = new Date($Env.maxTime     .getTime());
    objTimeInfo.startTime   = new Date($Env.minTime     .getTime() > pDate.startDate.getTime() ? $Env.minTime.getTime() : pDate.startDate.getTime());
    objTimeInfo.endTime     = new Date($Env.maxTime     .getTime() < pDate.endDate  .getTime() ? $Env.maxTime.getTime() : pDate.endDate  .getTime());
    objTimeInfo.currentTime = new Date(pDate.currentDate.getTime());
    
    if (objTimeInfo.currentTime.getTime() < objTimeInfo.startTime.getTime()) objTimeInfo.currentTime.setTime(objTimeInfo.startTime.getTime());
    if (objTimeInfo.currentTime.getTime() > objTimeInfo.endTime  .getTime()) objTimeInfo.currentTime.setTime(objTimeInfo.endTime  .getTime());
    
    $Env.creating = true;
    $("#lockWindow").addClass("show");
    
    $("#timeline").k2goTimeline("create", {
      timeInfo :
      {
        minTime     : objTimeInfo.minTime,
        maxTime     : objTimeInfo.maxTime,
        startTime   : objTimeInfo.startTime,
        endTime     : objTimeInfo.endTime,
        currentTime : objTimeInfo.currentTime
      },
      callback : function(pTimeInfo)
      {
        adjustRangeBar();
        $Env.creating = false;
        $("#lockWindow").removeClass("show");
      }
    });
  }
}
/******************************************************************************/
/*  STARScontroller_isReady                                                   */
/******************************************************************************/
function STARScontroller_isReady()
{
	return $Env.creating == false && !$("#lockWindow").hasClass("show");
}

