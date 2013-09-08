if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Util) == "undefined") {
  HypeMPlus.Util = {

    getCurrentTrackID : function() {
      var links = $("#player-nowplaying").children("a");
      for (var i = 0; i < links.length; i++) {
        var href = $(links[i]).attr("href");
        if (href.indexOf("track") != -1) {
          var id = href.replace("/track/", "");
          return(id);
        }
      }
      console.error("Could not retrieve current track's id");
    },

    play : function() {
      // player is flaky, use the playbutton on the row instead
      var id = HypeMPlus.Util.getCurrentTrackID();
      var playingRow = $("div[data-itemid='" + id + "']");
      var playButton = $(playingRow).find(".playdiv > a").first();
      if ($(playButton).hasClass("play")) {
        $(playButton)[0].click();
      }
    },

    pause : function() {
      // player is flaky, use the playbutton on the row instead
      var id = HypeMPlus.Util.getCurrentTrackID();
      var playingRow = $("div[data-itemid='" + id + "']");
      var playButton = $(playingRow).find(".playdiv > a").first();
      if ($(playButton).hasClass("pause")) {
        $(playButton)[0].click();
      }
    },

    nextTrack : function() {
      $("#player-controls").find("#playerNext").first()[0].click();
    },

    pendingCallbacks: {},
    newRequest: function(object, callback) {
      var request = (object ? object : { });
      request.type = "request";


      var rID = new Date().getTime();
      while (rID in HypeMPlus.Util.pendingCallbacks) {
        rID = rID + 1;
      }
      request.requestID = rID;

      if (typeof(callback) != "undefined" &&
          callback !== null) {
        HypeMPlus.Util.pendingCallbacks[rID] = callback;
      }
      else {
        HypeMPlus.Util.pendingCallbacks[rID] = false;
      }

      return request;
    },

    newResponse: function(request, object) {
      var response = (object ? object : { });
      response.type = "response";

      if ("requestID" in request) {
        response.callbackID = request.requestID;
      }
      else {
        console.error("Can't make a response without a callbackID - now requestID in the requesting: " + request.action);
        if ("callbackID" in request) {
          console.error("callbackID: " + request.callbackID);
        }
      }
      return response;
    },
  };
}

// copied wholesale from prototype.js, props to them
Function.prototype.curry = function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  if (!arguments.length) return this;
  var __method = this, args = slice.call(arguments, 0);
  return function() {
    var a = merge(args, arguments);
    return __method.apply(this, a);
  };
};