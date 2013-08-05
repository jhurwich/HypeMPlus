if (typeof(HypeMPlus) == "undefined") {
  var HypeMPlus = {};
}

if (typeof(HypeMPlus.Bkgrd) == "undefined") {

  HypeMPlus.Bkgrd = {

    run : function() {
      chrome.extension.onConnect.addListener(this.portListener);
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
      console.log("Got message");

      var response = HypeMPlus.Util.newResponse(request);

      switch (request.action) {
      case "get_autoskip":
        console.log("getting autoskip");

        chrome.storage.sync.get("autoskip", function(stored) {
          response.autoskipTracks = stored.autoskip;
          if (typeof(response.autoskipTracks) == "undefined") {
            response.autoskipTracks = {};
          }

          HypeMPlus.Util.postMessage(port.sender.tab.id, response);
        });
        break;

      case "set_autoskip":
        console.log("setting autoskip");

        chrome.storage.sync.get("autoskip", function(stored) {
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

      default:
        console.error("Unexpected request action '" + request.action + "'");
        break;
      } // end switch
      return;
    },
  };

}

HypeMPlus.Bkgrd.run();