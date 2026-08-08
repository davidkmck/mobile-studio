// Master script.js for Mobile Studio

let pendingClip = null; 

window.addEventListener('message', (event) => {
  const { action, audioBlob, trackName, mimeType, app, bpm } = event.data;

  if (action === 'EXPORT_AUDIO_TO_TRACKS') {
    console.log("Parent: Received audio. Queuing for Tracks...");
    pendingClip = { action: 'ADD_CLIP_TO_TIMELINE', audioBlob, trackName, mimeType };
  }

  if (action === 'SWITCH_APP') {
    switchApp(app);
  }

  if (action === 'REQUEST_PLAY') {
    document.querySelectorAll('.app-frame').forEach(frame => {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage({ action: 'START_AUDIO', bpm }, '*');
      }
    });
  }

  if (action === 'REQUEST_STOP') {
    document.querySelectorAll('.app-frame').forEach(frame => {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage({ action: 'STOP_AUDIO' }, '*');
      }
    });
  }

  if (action === 'ADD_TRACK') {
    const multitrackFrame = document.getElementById('multitrack');
    if (multitrackFrame && multitrackFrame.contentWindow) {
      multitrackFrame.contentWindow.postMessage(event.data, '*');
    }
  }

  // Whenever tracks change or sync messages arrive, update arm states
  updateArmStates();
});

function drawPatchCables() {
  const rack = document.querySelector('.studio-rack');
  if (!rack) return;
  const rackRect = rack.getBoundingClientRect();
  
  const getPortCenter = (tabClass, portClass) => {
    const tab = document.querySelector(tabClass);
    if (!tab) return { x: 0, y: 0 };
    
    const port = portClass ? tab.querySelector(portClass) : tab.querySelector('.audio-port');
    if (!port) return { x: 0, y: 0 };
    
    const pRect = port.getBoundingClientRect();
    return {
      x: pRect.left - rackRect.left + (pRect.width / 2),
      y: pRect.top - rackRect.top + (pRect.height / 2)
    };
  };

  const startLeft = getPortCenter('.drum-kit-tab');
  const endLeft = getPortCenter('.mixer-tab', '.port-left');
  const startRight = getPortCenter('.synth-tab');
  const endRight = getPortCenter('.mixer-tab', '.port-right');

  const droopAmount = 40; 

  const pathLeft = document.querySelector('.cable-left');
  if (pathLeft) {
    pathLeft.setAttribute('d', `M ${startLeft.x} ${startLeft.y} C ${startLeft.x} ${startLeft.y + droopAmount}, ${endLeft.x} ${endLeft.y + droopAmount}, ${endLeft.x} ${endLeft.y}`);
  }

  const pathRight = document.querySelector('.cable-right');
  if (pathRight) {
    pathRight.setAttribute('d', `M ${startRight.x} ${startRight.y} C ${startRight.x} ${startRight.y + droopAmount}, ${endRight.x} ${endRight.y + droopAmount}, ${endRight.x} ${endRight.y}`);
  }
}

window.addEventListener('DOMContentLoaded', drawPatchCables);
window.addEventListener('load', drawPatchCables);
window.addEventListener('resize', drawPatchCables);   

function updateArmStates() {
    const multitrackFrame = document.getElementById('multitrack');
    const armBeatMaker = document.getElementById('arm-beat-maker');
    
    if (!multitrackFrame || !armBeatMaker) return;

    try {
        const subAppTracks = multitrackFrame.contentWindow?.tracks;
        
        if (subAppTracks && Array.isArray(subAppTracks)) {
            const hasBeatTrack = subAppTracks.some(track => 
                track.name && track.name.toLowerCase().includes('beat')
            );
            
        if (hasBeatTrack) {
                // 1. Try parent-level fallback if it exists in parent DOM
                const armBeatMakerParent = document.getElementById('arm-beat-maker');
                if (armBeatMakerParent) {
                    armBeatMakerParent.checked = false;
                }

                // 2. Send disarm message down to the beat-maker iframe where the UI control actually lives
                if (beatMakerFrame && beatMakerFrame.contentWindow) {
                    beatMakerFrame.contentWindow.postMessage({ command: 'disarm-beat' }, '*');
                }
            }
        }
    } catch (e) {
        console.error("Could not check multitrack state:", e);
    }
}

function switchApp(targetAppId) {
  document.querySelectorAll('.app-frame').forEach(frame => frame.classList.remove('active'));
  const activeFrame = document.getElementById(targetAppId);
  if (activeFrame) activeFrame.classList.add('active');

  document.querySelectorAll('.rack-device').forEach(el => {
    el.classList.toggle('active', el.dataset.app === targetAppId);
  });

  updateArmStates();

  if (targetAppId === 'multitrack' && pendingClip && activeFrame) {
    activeFrame.contentWindow.postMessage(pendingClip, '*');
    pendingClip = null;
  }
}

function loadApp(appName, event) {
  if (event) event.preventDefault(); 
  switchApp(appName);
}

document.addEventListener('DOMContentLoaded', () => {
    const globalRecordBtn = document.getElementById('global-record-btn');
    const armBeatMaker = document.getElementById('arm-beat-maker');
    const armSynth = document.getElementById('arm-synth'); 

    const beatMakerWindow = document.getElementById('beat-maker').contentWindow;
    const synthWindow = document.getElementById('synth').contentWindow;
    const multitrackWindow = document.getElementById('multitrack').contentWindow;

    let isRecording = false;
    let isCountdownActive = false;

    // Run once on load to catch initial states
    setTimeout(updateArmStates, 500);

    globalRecordBtn.addEventListener('click', () => {
        if (isCountdownActive) return;

        updateArmStates();

        if (!isRecording) {
            // Start 3-Second Countdown
            isCountdownActive = true;
            let count = 3;
            globalRecordBtn.innerHTML = `⏳ Rec in ${count}...`;
            globalRecordBtn.style.color = '#ffcc00';

            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    globalRecordBtn.innerHTML = `⏳ Rec in ${count}...`;
                } else {
                    clearInterval(countdownInterval);
                    isCountdownActive = false;
                    
                    // Countdown finished -> Actually Start Recording
                    isRecording = true;
                    globalRecordBtn.innerHTML = '⏹ STOP';
                    globalRecordBtn.style.color = '#ff4444';

                    // 1. Explicitly command the multitrack (mixer) window to start audio playback timeline
                    if (multitrackWindow) {
                        multitrackWindow.postMessage({ action: 'START_AUDIO' }, '*');
                    }

                    // 2. Also broadcast to any other subapps just in case
                    document.querySelectorAll('.app-frame').forEach(frame => {
                        if (frame.contentWindow && frame.contentWindow !== multitrackWindow) {
                            frame.contentWindow.postMessage({ action: 'START_AUDIO' }, '*');
                        }
                    });

                    // 3. Arm and start recording on selected instruments
                    if (armBeatMaker.checked) {
                        beatMakerWindow.postMessage({ command: 'start-recording' }, '*');
                    }
                    if (armSynth.checked) {
                        synthWindow.postMessage({ command: 'start-recording' }, '*');
                    }
                }
            }, 1000);

        } else {
            // Stop Recording
            isRecording = false;
            globalRecordBtn.innerHTML = '🔴 REC';
            globalRecordBtn.style.color = 'white';

            beatMakerWindow.postMessage({ command: 'stop-recording' }, '*');
            synthWindow.postMessage({ command: 'stop-recording' }, '*');

            const fakeEvent = { preventDefault: () => {} };
            loadApp('multitrack', fakeEvent);
            
            // Check arm states shortly after returning to multitrack so the UI updates
            setTimeout(updateArmStates, 300);
        }
    });
});
