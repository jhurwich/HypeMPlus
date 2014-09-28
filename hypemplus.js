if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Inject) == "undefined") {

  HypeMPlus.Inject = {

    debug : false,

    port : null,
    currVoice: "off",
    init : function() {
      var self = this;
      self.log("Beginning initialization");

      self.port = chrome.extension.connect();
      self.port.onMessage.addListener(self.handleRequest);
      self.port.onMessage.addListener(self.handleResponse);

      // set up an observer for the title element to detect track changes
      var target = document.querySelector('head > title');
      var observer = new window.WebKitMutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          HypeMPlus.Inject.Autoskip.titleChangeListener(mutation.target.textContent);
        });
      });
      observer.observe(target, { subtree: true, characterData: true, childList: true });

      // forced hash change event
      setTimeout(function() {
        var oldHref = location.href;
        setInterval(function() {
          var newHref = location.href;
          if (oldHref !== newHref) {
            oldHref = newHref;
            HypeMPlus.Inject.Autoskip.run();
          }
        }, 500);
      }, 500);

      var request = HypeMPlus.Util.newRequest({ action : "get_voice",}, function(response) {
        HypeMPlus.Inject.currVoice = response.voice;
      });
      HypeMPlus.Inject.port.postMessage(request);

      self.log("Initialization complete");
    },

    run : function() {
      var self = this;
      self.log("run() start");

      self.LoginCheck.run();
      self.Autoskip.run();

      self.log("run() complete");
    },

    handleResponse: function(response) {
      if (response.type != "response") {
        return;
      }
      var utils = HypeMPlus.Util;

      if (response.callbackID in utils.pendingCallbacks &&
          utils.pendingCallbacks[response.callbackID]) {
        utils.pendingCallbacks[response.callbackID](response);

        delete utils.pendingCallbacks[response.callbackID];
      }
      else if(typeof(utils.pendingCallbacks[response.callbackID]) !== "undefined") {
        console.error("Could not find callback '" + response.callbackID + "' for response: " + JSON.stringify(response));
      }
    },

    handleRequest : function(request) {
      if (request.type != "request") {
        return;
      }
      switch (request.action) {
      case "set_voice":
        HypeMPlus.Inject.currVoice = request.voice;
        break;

      case "rerun":
        HypeMPlus.Inject.run();
        break;

      default:
        console.error("Unrecognized request: " + JSON.stringify(request));
        break;
      }
    },

    LoginCheck : {

      run : function() {
        var utils = HypeMPlus.Util;
        utils.log("LoginCheck.run() start");

        var loginMenu = document.getElementById("menu-out");
        if (loginMenu != null) {
          // not logged in
          utils.log("-- not logged in");

          var child = loginMenu.firstChild;
          while (child.innerHTML != "Log in") {
            child = child.nextSibling;
          }
          child.click();
        }

        utils.log("LoginCheck.run() complete");
      },
    },

    Autoskip : {

      trackToBeSkipped: "",
      lastPhrase: "",
      titleChangeListener: function(newTitle) {
        var utils = HypeMPlus.Util;
        var id = utils.getCurrentTrackID();
        if (typeof(HypeMPlus.Inject.Autoskip.autoskipTracks[id]) != "undefined" &&
            HypeMPlus.Inject.Autoskip.autoskipTracks[id]) {
          // track should be skipped
          HypeMPlus.Inject.Autoskip.trackToBeSkipped = newTitle;

          var attemptSkip = function() {
            if (document.title == HypeMPlus.Inject.Autoskip.trackToBeSkipped) {
              utils.log("Skipping this track now.");
              utils.nextTrack();
              setTimeout(attemptSkip, 500);
            }
          };
          attemptSkip();
          return;
        }

        // not skipping, send speech command to backend, if on
        var phrase = newTitle;
        if (HypeMPlus.Inject.Autoskip.lastPhrase.replace(/[^a-z0-9\s]/gi, '') == phrase.replace(/[^a-z0-9\s]/gi, '')) {
          utils.log("Not skipping - not speaking because repeated phrase: '" + HypeMPlus.Inject.Autoskip.lastPhrase +"'");
          return;
        }
        HypeMPlus.Inject.Autoskip.lastPhrase = phrase;

        if (typeof(HypeMPlus.Inject.currVoice) != "undefined" && HypeMPlus.Inject.currVoice != "off") {
          // pause music before talking
          HypeMPlus.Util.pause();

          var request = HypeMPlus.Util.newRequest({ action : "speek", phrase : phrase }, function(response) {
            // done speeking, unpause
            HypeMPlus.Util.play();
          });
          HypeMPlus.Inject.port.postMessage(request);
        }
      },

      run : function() {
        var utils = HypeMPlus.Util;
        utils.log("Autoskip.run() start");

        utils.log("-- Requesting autoskip tracks from backend");
        var request = utils.newRequest({ action : "get_autoskip",}, function(response) {
          HypeMPlus.Inject.Autoskip.autoskipTracks = response.autoskipTracks;
          
          utils.log("-- " + Object.keys(HypeMPlus.Inject.Autoskip.autoskipTracks).length + " autoskip tracks from backend");
          // utils.log("-- " + JSON.stringify(HypeMPlus.Inject.Autoskip.autoskipTracks));

          HypeMPlus.Inject.modifyTrackList(HypeMPlus.Inject.Autoskip.autoskipTracks);
          HypeMPlus.Inject.modifyPlayer();
          utils.log("-- autoskip track marking complete.")
        });
        HypeMPlus.Inject.port.postMessage(request);

        utils.log("Autoskip.run() complete");
      },
    },

    modifyPlayer : function() {
      var playerAutoskip = $("<div class='playerAutoskip'></div>");
      $(playerAutoskip).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip.png") + "')");
      $(playerAutoskip).hover(function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip-hover.png") + "')");
      }, function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip.png") + "')");
      });
      $(playerAutoskip).click(HypeMPlus.Inject.autoskipFromPlayer);

      if ($("div.playerAutoskip").length !== 0) {
        $("div.playerAutoskip").remove();
      }
      $(playerAutoskip).insertBefore($("#player-controls").find("#playerFav").first());
    },

    autoskipFromPlayer : function() {
      var id = HypeMPlus.Util.getCurrentTrackID();
      HypeMPlus.Inject.toggleAutoskip($("div[data-itemid='" + id + "']").first());
      HypeMPlus.Util.nextTrack();
    },

    modifyTrackList : function(autoskipTracks) {
      var trackRows = $("div[data-itemid]");

      var isAutoskipTest = function(trackRow) {
        var id = $(this).attr("data-itemid");
        return (typeof(autoskipTracks[id]) != "undefined");
      };

      var autoskipRows = $(trackRows).filter(isAutoskipTest);
      var nonskipRows = $(trackRows).not(autoskipRows);

      $(autoskipRows).map(HypeMPlus.Inject.markAutoskip);
      $(nonskipRows).map(HypeMPlus.Inject.markNonskip);

    },

    markAutoskip : function(index, row) {
      $(row).attr("autoskip", "true");
      var favdiv = $(row).find("ul.tools").first().find(".favdiv").first();

      var autoskipOnLi = $("<li class='autoskipdiv'><div class='autoskip-control autoskip-on'> </div></li>");
      var autoskipOnDiv = $(autoskipOnLi).find(".autoskip-on").first();
      $(autoskipOnDiv).css('background-image', "url('" + chrome.extension.getURL("images/autoskip-on.png") + "')");
      
      $(autoskipOnLi).click(HypeMPlus.Inject.toggleAutoskip.curry(row));

      if ($(favdiv).has("li.autoskipdiv").length) {
        $(favdiv).find("li.autoskipdiv").first().replaceWith(autoskipOnLi);
      }
      else {
        favdiv.append(autoskipOnLi);
      }
    },

    markNonskip : function(index, row) {
      $(row).attr("autoskip", "false");
      var favdiv = $(row).find("ul.tools").first().find(".favdiv").first();

      var autoskipOffLi = $("<li class='autoskipdiv'><div class='autoskip-control autoskip-off'> </div></li>");
      var autoskipOffDiv = $(autoskipOffLi).find(".autoskip-off")
      $(autoskipOffDiv).css('background-image', "url('" + chrome.extension.getURL("images/autoskip-off.png") + "')");
            
      $(autoskipOffDiv).hover(function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip-hover.png") + "')");
      }, function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/autoskip-off.png") + "')");
      });                    
      $(autoskipOffLi).click(HypeMPlus.Inject.toggleAutoskip.curry(row));

      if ($(favdiv).has("li.autoskipdiv").length) {
        $(favdiv).find("li.autoskipdiv").first().replaceWith(autoskipOffLi);
      }
      else {
        favdiv.append(autoskipOffLi);
      }
    },

    toggleAutoskip : function(row) {
      var id = $(row).attr("data-itemid");
      var autoskip = ($(row).attr('autoskip') == "true");

      var setter = { action : "set_autoskip"};
      if (autoskip) {
        setter.off = id;
      }
      else {
        setter.on = id;
      }
      var request = HypeMPlus.Util.newRequest(setter, function(response) {
        if(autoskip) {
          // toggling to off
          HypeMPlus.Inject.markNonskip(0, row);
        }
        else {
          // toggling to on
          HypeMPlus.Inject.markAutoskip(0, row);
        }

        HypeMPlus.Inject.Autoskip.autoskipTracks[id] = !autoskip;

        // check if the current track was auto-skipped
        if (id == HypeMPlus.Util.getCurrentTrackID()) {
          HypeMPlus.Util.nextTrack();
        }
      });
      HypeMPlus.Inject.port.postMessage(request);
    },

    // uplevel the util logging method
    log : HypeMPlus.Util.log,
  };
}

// Extension main script
var main = function(count) {
  if (document.getElementById("menu-username") == null &&
      count <= 5) {
    // can't tell if logged in yet, defer
    setTimeout(main, 400, (count + 1));
    return;
  }

  HypeMPlus.Inject.init();
  HypeMPlus.Inject.run();
};

main(0);