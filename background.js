if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Bkgrd) == "undefined") {

  HypeMPlus.Bkgrd = {

    run : function() {
      chrome.extension.onRequest.addListener(this.requestListener);
      chrome.extension.onConnect.addListener(this.portListener);
    },

    isSpeaking: false,
    previousPhrase: "",
    speek: function(phrase, callback) {
      var bkgrd = HypeMPlus.Bkgrd;
      if (bkgrd.isSpeaking ||
          phrase == HypeMPlus.Bkgrd.previousPhrase) {
        return;
      }
      HypeMPlus.Bkgrd.previousPhrase = phrase;

      var improvePhrase = function(phrase) {
        phrase = phrase.replace(/feat\.*/ig, "featuring");
        return phrase;
      };
      var utterance = improvePhrase(phrase);

      var speechEventHandler = function(e) {
        if (e.type == 'end' || e.type == 'interrupted' || e.type == 'cancelled' || e.type == 'error') {
          bkgrd.isSpeaking = false;
          callback();
        }
      };

      chrome.storage.sync.get("currVoice", function(object) {
        if (typeof(object.currVoice) != "undefined" && object.currVoice != "off") {
          bkgrd.isSpeaking = true;
          var rate = localStorage['rate'] || 0.80;
          var pitch = localStorage['pitch'] || 1.0;
          var volume = localStorage['volume'] || 1.0;
          var voiceParams = { voiceName: object.currVoice,
                              rate: parseFloat(rate),
                              pitch: parseFloat(pitch),
                              volume: parseFloat(volume),
                              onEvent: speechEventHandler
                            };
          chrome.tts.speak(utterance, voiceParams);
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

      port.onMessage.addListener(HypeMPlus.Bkgrd.handleMessage.curry(port));
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
  };

}

HypeMPlus.Bkgrd.run();