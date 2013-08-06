if (typeof HypeMPlus == "undefined") {
  var HypeMPlus = { };
}

if (typeof(HypeMPlus.BA) == "undefined") {
  HypeMPlus.BA = {
    onload: function() {
      HypeMPlus.BA.loadVoices();
    },

    loadVoices: function() {
      var request = { action: "getVoices" };
      chrome.extension.sendRequest(request, function(response) {
        var speechDOM = document.getElementById('speech-select');
        var voiceArray = response.voices;
        var hasENUS = false;
        if (voiceArray.length === 0) {
          var opt = document.createElement('option');
          opt.setAttribute('value', "getNewVoices");
          opt.innerText = "No voices, click here to get some.";
          speechDOM.appendChild(opt);
        }
        else {
          for (var i = 0; i < voiceArray.length; i++) {
            var opt = document.createElement('option');
            var name = voiceArray[i].voiceName;
            if (name == "US English Female TTS (by Google)") {
              hasENUS = true;
            }
            if (name == response.currVoice) {
              opt.setAttribute('selected', '');
            }
            opt.setAttribute('value', name);
            opt.innerText = voiceArray[i].voiceName;
            speechDOM.appendChild(opt);
          }

          if (response.currVoice == "off") {
            var opt = document.createElement('option');
            var name = "off";
            opt.setAttribute('selected', '');
            opt.setAttribute('value', name);
            opt.innerText = "Select a voice to activate speech";
            speechDOM.appendChild(opt);
          }
          else {
            var opt = document.createElement('option');
            var name = "off";
            opt.setAttribute('value', name);
            opt.innerText = "Turn off reading";
            speechDOM.appendChild(opt);
          }
        }

        // and add an entry to get new voices as the last
        if (!hasENUS) {
          var opt = document.createElement('option');
          opt.setAttribute('value', "getNewVoices");
          opt.innerText = "Download US-English voice";
          speechDOM.appendChild(opt);
        }
        speechDOM.addEventListener('change', HypeMPlus.BA.setSpeech, false);
      });
    },

    setSpeech: function() {
      var speechDOM = document.getElementById('speech-select');
      var newVoice = speechDOM.options[speechDOM.selectedIndex].getAttribute("value");
      if (newVoice == "getNewVoices") {
        chrome.tabs.create({ url: "https://chrome.google.com/webstore/detail/us-english-female-text-to/pkidpnnapnfgjhfhkpmjpbckkbaodldb?hl=en" });
         return;
      }

      var request = { action: "setSpeech", voice: newVoice };
      chrome.extension.sendRequest(request);
    },
  }; // end HypeMPlus.BA
}

window.onload = HypeMPlus.BA.onload;