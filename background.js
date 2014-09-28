if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Bkgrd) == "undefined") {

  HypeMPlus.Bkgrd = {

    debug : false,

    run : function() {
      var self = this;
      self.log("run() start");

      chrome.extension.onRequest.addListener(this.requestListener);
      chrome.extension.onConnect.addListener(this.portListener);

      self.log("run() complete");
    },

    isSpeaking: false,
    previousPhrase: "",
    speek: function(phrase, callback) {
      var bkgrd = HypeMPlus.Bkgrd;
      bkgrd.log("Requested to speak phrase '" + phrase + "'");

      if (bkgrd.isSpeaking ||
          phrase == HypeMPlus.Bkgrd.previousPhrase) {
        bkgrd.log("Already speaking, returning.  Previous phrase: '" + HypeMPlus.Bkgrd.previousPhrase + "'");
        return;
      }
      HypeMPlus.Bkgrd.previousPhrase = phrase;

      var improvePhrase = function(phrase) {
        phrase = phrase.replace("The Hype Machine", "").replace("Hype Machine", "");

        splitPhrase = phrase.split("-"); 
        if (splitPhrase.length = 2) {
          phrase = splitPhrase[1] + " by " + splitPhrase[0];
        } 

        phrase = phrase.replace(/[^a-z0-9\s]/gi, '');
        phrase = phrase.replace(/feat\.*/ig, "featuring");
        return phrase;
      };
      var utterance = improvePhrase(phrase);
      bkgrd.log("Improved phrase to ' " + utterance + "'");

      var speechEventHandler = function(e) {
        if (e.type == 'end' || e.type == 'interrupted' || e.type == 'cancelled' || e.type == 'error') {
          bkgrd.log("Done speaking.")
          bkgrd.isSpeaking = false;
          callback();
        }
      };

      chrome.storage.sync.get("currVoice", function(object) {
        if (typeof(object.currVoice) != "undefined" && object.currVoice != "off") {
          bkgrd.isSpeaking = true;
          var rate = localStorage['rate'] || 0.75;
          var pitch = localStorage['pitch'] || 1.0;
          var volume = localStorage['volume'] || 1.0;
          var voiceParams = { voiceName: object.currVoice,
                              rate: parseFloat(rate),
                              pitch: parseFloat(pitch),
                              volume: parseFloat(volume),
                              onEvent: speechEventHandler
                            };
          bkgrd.log("Speaking now");
          chrome.tts.speak(utterance, voiceParams);
        }
        else {
          bkgrd.log("Not speaking, no voice");
        }
      });
    },

    requestListener: function(request, sender, sendResponse) {
      switch (request.action) {

      case "getVoices":
        chrome.storage.sync.get("currVoice", function(object) {
          chrome.tts.getVoices(function(voices) {
            var response = {};
            response.voices = voices;
            if (typeof(object.currVoice) == "undefined") {
              object.currVoice = "off"; // default to off
            }
            response.currVoice = object.currVoice;
            sendResponse(response);
          });
        });
        break;

      case "setSpeech":
        var voice = request.voice;
        chrome.storage.sync.set({ "currVoice" : voice }, function() {
          sendResponse({});

          var request = HypeMPlus.Util.newRequest({ action: "set_voice",
                                                    voice: voice });
          HypeMPlus.Util.postMessage("all", request);
        });
        break;

      case "rerun":
        var request = HypeMPlus.Util.newRequest({ action: "rerun" });
        HypeMPlus.Util.postMessage("all", request);
        break;

      default:
        console.error("Unrecognized request: " + JSON.stringify(request));
        break;
      }
    },

    portListener : function(port) {
      var util = HypeMPlus.Util;

      // we seem to get multiple connection requests for the same tab
      if (typeof(util.ports[port.sender.tab.id]) != "undefined" &&
          util.ports[port.sender.tab.id]) {
        return;
      }
      util.ports[port.sender.tab.id] = port;

      port.onDisconnect.addListener(HypeMPlus.Bkgrd.disconnectPortListener);
      port.onMessage.addListener(HypeMPlus.Bkgrd.handleMessage.curry(port));
    },

    disconnectPortListener : function(port) {
      var util = HypeMPlus.Util;

      // delete the port in the registry
      delete util.ports[port.sender.tab.id];
    },

    handleMessage: function(port, request) {
      if (request.type != "request") {
        return;
      }

      var response = HypeMPlus.Util.newResponse(request);

      switch (request.action) {
      case "get_autoskip":
        chrome.storage.sync.get("autoskip", function(stored) {
          response.autoskipTracks = stored.autoskip;
          if (typeof(response.autoskipTracks) == "undefined") {
            response.autoskipTracks = {};
          }

          HypeMPlus.Util.postMessage(port.sender.tab.id, response);
        });
        break;

      case "set_autoskip":
        chrome.storage.sync.get("autoskip", function(stored) {
          if (typeof(stored.autoskip) == "undefined") {
            stored.autoskip = {};
          }

          if (typeof(request.on) != "undefined") {
            stored.autoskip[request.on] = true;
          }
          else {
            delete stored.autoskip[request.off];
          }

          chrome.storage.sync.set({ "autoskip" : stored.autoskip }, function() {
            HypeMPlus.Util.postMessage(port.sender.tab.id, response);
          });
        });
        break;

      case "get_voice":
        chrome.storage.sync.get("currVoice", function(object) {
          response.voice = "off";
          if (typeof(object.currVoice) != "undefined" && object.currVoice != "off") {
            response.voice = object.currVoice;
          }
          HypeMPlus.Util.postMessage(port.sender.tab.id, response);
        });
        break;

      case "speek":
        HypeMPlus.Bkgrd.speek(request.phrase, function() {
          HypeMPlus.Util.postMessage(port.sender.tab.id, response);
        });
        break;

      default:
        console.error("Unexpected request action '" + request.action + "'");
        break;
      } // end switch
      return;
    },

    // uplevel the util logging method
    log : HypeMPlus.Util.log,
  };

}

HypeMPlus.Bkgrd.run();