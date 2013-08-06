if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Inject) == "undefined") {

  HypeMPlus.Inject = {

    port : null,
    init : function() {
      var self = this;
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
    },

    LoginCheck : {

      run : function() {
        var loginMenu = document.getElementById("menu-out");

        if (loginMenu != null) {
          // not logged in
          var child = loginMenu.firstChild;
          while (child.innerHTML != "Log in") {
            child = child.nextSibling;
          }
          child.click();
        }
      },
    },

    Autoskip : {

      trackToBeSkipped: "",
      titleChangeListener: function(newTitle) {
        var id = HypeMPlus.Util.getCurrentTrackID();
        if (HypeMPlus.Inject.Autoskip.autoskipTracks[id]) {
          // track should be skipped
          HypeMPlus.Inject.Autoskip.trackToBeSkipped = newTitle;

          var attemptSkip = function() {
            if (document.title == HypeMPlus.Inject.Autoskip.trackToBeSkipped) {
             /* Play next by finding next track row and playing
              * 
              var skipRow = $("div[data-itemid='" + id + "']");
              var nextRow = $(skipRow).next();
              while (nextRow.attr("autoskip") == "true") {
                nextRow = $(nextRow).next();
              }
              var nextPlay = $(nextRow).find(".playdiv > a").first();
              $(nextPlay)[0].click();
              */

              HypeMPlus.Util.nextTrack();
              setTimeout(attemptSkip, 500);
            }
          };
          attemptSkip();
        }
      },

      run : function() {
        var url = window.document.documentURI.substring(0, window.document.documentURI.indexOf("?"));
        $.ajax({ type: "GET",
          url: url,
          dataType: "text",
          success: HypeMPlus.Inject.Autoskip.scrapeHTML.curry(HypeMPlus.Inject.Autoskip.enrichTrackData, url, []),
          error: function (response, status, xhr) {
            console.error("Ajax error retrieving " + url);
          }
        });
      },

      scrapeHTML : function(callback, queriedURL, previousTracks, responseText, textStatus, headers) {
        var openTagRegex = function(tag) {
          return new RegExp("<\s*" + tag + "[^<>]*>", "gi");
        };

        var closeTagRegex = function(tag) {
          return new RegExp("<\/" + tag + "[^<>]*>", "gi");
        };

        var error = function() {
          console.error("Could not locate displayListData on hypem.com.");
          alert("ERROR");
        };

        var openScriptRegex = openTagRegex("script.*id=[\'\"]displayList-data[\'\"]");
        var closeScriptRegex = closeTagRegex("script");

        var openMatch = openScriptRegex.exec(responseText);
        if (!openMatch) {
          error();
          return;
        }

        var closeMatch = closeScriptRegex.exec(responseText.substring(openMatch.index));
        if (!closeMatch) {
          error();
          return;
        }

        var displayListData = JSON.parse(responseText.substring(openMatch.index + openMatch[0].length,
                                                                openMatch.index + closeMatch.index));

        var tracks = previousTracks;
        if (typeof(displayListData.tracks) != "undefined") {
          tracks = tracks.concat(displayListData.tracks);
        }

        if (typeof(displayListData.page_cur) != "undefined" &&
            typeof(displayListData.page_next) != "undefined" &&
            tracks.length < 100) {
          var baseURL = queriedURL.replace(displayListData.page_cur, "");
          var nextURL = baseURL + displayListData.page_next;
          $.ajax({ type: "GET",
            url: nextURL,
            dataType: "text",
            success: HypeMPlus.Inject.Autoskip.scrapeHTML.curry(HypeMPlus.Inject.Autoskip.handleTrackData, nextURL, tracks),
            error: function (response, status, xhr) {
              console.error("Ajax error retrieving " + nextURL);
            }
          });
          return;
        }

        callback(tracks);
      },

      handleTrackData : function(tracks) {
        var request = HypeMPlus.Util.newRequest({ action : "get_autoskip",}, function(response) {

          HypeMPlus.Inject.Autoskip.autoskipTracks = response.autoskipTracks;

          for (var i = 0; i < tracks.length; i++){
            var track = tracks[i];
            if (typeof(response.autoskipTracks[track.id]) != "undefined") {
              track.autoskip = true;
            }
          }

          HypeMPlus.Inject.modifyTrackList(tracks, HypeMPlus.Inject.Autoskip.autoskipTracks);
          HypeMPlus.Inject.modifyPlayer();
        });
        HypeMPlus.Inject.port.postMessage(request);
      },
    },

    modifyPlayer : function() {
      var playerAutoskip = $("<div id='playerAutoskip'></div>");
      $(playerAutoskip).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip.png") + "')");
      $(playerAutoskip).hover(function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip-hover.png") + "')");
      }, function() {
        $(this).css('background-image', "url('" + chrome.extension.getURL("images/player-autoskip.png") + "')");
      });
      $(playerAutoskip).click(HypeMPlus.Inject.autoskipFromPlayer);

      $(playerAutoskip).insertAfter($("#player-controls").find("#playerFav").first());
    },

    autoskipFromPlayer : function() {
      var id = HypeMPlus.Util.getCurrentTrackID();
      HypeMPlus.Inject.toggleAutoskip($("div[data-itemid='" + id + "']").first());
      HypeMPlus.Util.nextTrack();
    },

    modifyTrackList : function(tracks, autoskipTracks) {
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
      var tools = $(row).find("ul.tools").first();

      var autoskipOn = $("<li class='autoskipdiv'><div class='autoskip-control autoskip-on'> </div></li>");
      $(autoskipOn).css('background-image', "url('" + chrome.extension.getURL("images/autoskip-on.png") + "')");
      $(autoskipOn).click(HypeMPlus.Inject.toggleAutoskip.curry(row));

      if ($(tools).has("li.autoskipdiv").length) {
        $(tools).find("li.autoskipdiv").first().replaceWith(autoskipOn);
      }
      else {
        tools.append(autoskipOn);
      }
    },

    markNonskip : function(index, row) {
      $(row).attr("autoskip", "false");
      var tools = $(row).find("ul.tools").first();

      var autoskipOff = $("<li class='autoskipdiv'><div class='autoskip-control autoskip-off'> </div></li>");
      $(autoskipOff).css('background-image', "url('" + chrome.extension.getURL("images/autoskip-off.png") + "')");
      $(autoskipOff).click(HypeMPlus.Inject.toggleAutoskip.curry(row));

      if ($(tools).has("li.autoskipdiv").length) {
        $(tools).find("li.autoskipdiv").first().replaceWith(autoskipOff);
      }
      else {
        tools.append(autoskipOff);
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
    }
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
  HypeMPlus.Inject.LoginCheck.run();
  HypeMPlus.Inject.Autoskip.run();
};

main(0);