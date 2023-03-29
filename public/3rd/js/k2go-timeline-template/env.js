/******************************************************************************/
/* Sample for k2goTimeline                                                    */
/* halloweenjack inc.                                                         */
/******************************************************************************/
var $Env =
{
  minTime     : new Date((new Date()).getFullYear() - 100,                       0,                      1),
  maxTime     : new Date((new Date()).getFullYear() + 100,                       0,                      1),
  startTime   : new Date((new Date()).getFullYear()     , (new Date()).getMonth(), (new Date()).getDate(),  0,  0,  0,   0),
  endTime     : new Date((new Date()).getFullYear()     , (new Date()).getMonth(), (new Date()).getDate(), 23, 59, 59, 999),
  currentTime : new Date(     Date   .now        ()),
  creating    : false,
  starting    : false,
  speed       : 0,
  loop        : false,
  zoomTable   :
  [
    { name : "100 year", value : 1000 * 60 * 60 * 24 * 365 * 100 },
    { name : "50 year" , value : 1000 * 60 * 60 * 24 * 365 * 50  },
    { name : "10 year" , value : 1000 * 60 * 60 * 24 * 365 * 10  },
    { name : " 5 year" , value : 1000 * 60 * 60 * 24 * 365 *  5  },
    { name : " 1 year" , value : 1000 * 60 * 60 * 24 * 365       },
    { name : " 6 month", value : 1000 * 60 * 60 * 24 *  30 *  6  },
    { name : " 3 month", value : 1000 * 60 * 60 * 24 *  30 *  3  },
    { name : " 1 month", value : 1000 * 60 * 60 * 24 *  30       },
    { name : "15 day"  , value : 1000 * 60 * 60 * 24 *  15       },
    { name : " 7 day"  , value : 1000 * 60 * 60 * 24 *   7       },
    { name : " 1 day"  , value : 1000 * 60 * 60 * 24             },
    { name : "12 hour" , value : 1000 * 60 * 60 * 12             },
    { name : " 6 hour" , value : 1000 * 60 * 60 *  6             },
    { name : " 1 hour" , value : 1000 * 60 * 60                  },
    { name : "30 min"  , value : 1000 * 60 * 30                  },
    { name : "15 min"  , value : 1000 * 60 * 15                  },
    { name : " 1 min"  , value : 1000 * 60                       },
    { name : "30 sec"  , value : 1000 * 30                       },
    { name : " 1 sec"  , value : 1000 * 1                        }
  ]
};
