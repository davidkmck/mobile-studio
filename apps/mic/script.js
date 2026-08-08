let audioCtx = null;
let micStream = null;
let micSource = null;
let gainNode = null;
let filterNode = null;
let destinationNode = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingInterval = null;
let secondsElapsed = 0;

// DOM Elements
const connectBtn = document.getElementById('mic-connect-btn');
const micLed = document.getElementById('mic-led');
const micStatus = document.getElementById('mic-status');
const micGainInput = document.getElementById('mic-gain');
const micMonitorCheckbox = document.getElementById('mic-monitor');
const filterTypeSelect = document.getElementById('fx-filter-type');
const filterFreqInput = document.getElementById('fx-filter-freq');
const timerDisplay = document.getElementById('mic-timer');
const takesList = document.getElementById('takes-list');

// Initialize Microphone and Audio Context
connectBtn.addEventListener('click', async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } 
    });

    micSource = audioCtx.createMediaStreamSource(micStream);
    gainNode = audioCtx.createGain();
    filterNode = audioCtx.createBiquadFilter();

    gainNode.gain.value = parseFloat(micGainInput.value);
    filterNode.type = filterTypeSelect.value === 'none' ? 'allpass' : filterTypeSelect.value;
    filterNode.frequency.value = parseFloat(filterFreqInput.value);

    const dest = audioCtx.createMediaStreamDestination();
    destinationNode = dest;

    micSource.connect(gainNode);
    gainNode.connect(filterNode);
    filterNode.connect(destinationNode);

    mediaRecorder = new MediaRecorder(dest.stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = saveRecordedTakeToMixer;

    micLed.className = 'led-on';
    micStatus.textContent = 'Connected & Active';
    connectBtn.textContent = 'Mic Connected';
    connectBtn.disabled = true;

    // Listen to parent/global transport record button
    setupGlobalTransportListener();

  } catch (err) {
    console.error('Microphone access error:', err);
    micLed.className = 'led-off';
    micStatus.textContent = 'Permission Denied / Error';
  }
});

// Controls
micGainInput.addEventListener('input', (e) => {
  if (gainNode) gainNode.gain.value = parseFloat(e.target.value);
});

filterTypeSelect.addEventListener('change', (e) => {
  if (filterNode) {
    const val = e.target.value;
    filterNode.type = val === 'none' ? 'allpass' : val;
  }
});

filterFreqInput.addEventListener('input', (e) => {
  if (filterNode) filterNode.frequency.value = parseFloat(e.target.value);
});

micMonitorCheckbox.addEventListener('change', (e) => {
  if (!audioCtx || !filterNode) return;
  if (e.target.checked) {
    filterNode.connect(audioCtx.destination);
  } else {
    try { filterNode.disconnect(audioCtx.destination); } catch (err) {}
  }
});

// Sync with Main Studio's Global Record Button (accounting for 3s countdown)
function setupGlobalTransportListener() {
  const globalRecBtn = window.parent.document.getElementById('global-record-btn');
  if (!globalRecBtn) return;

  let isRecording = false;

  globalRecBtn.addEventListener('click', () => {
    if (!mediaRecorder) return;

    if (!isRecording) {
      // WAIT FOR 3-SECOND COUNTDOWN (Matches your other tracks)
      micStatus.textContent = 'Counting down (3s)...';
      micLed.className = 'led-off';

      setTimeout(() => {
        // Double check state incase user cancelled
        recordedChunks = [];
        mediaRecorder.start();
        isRecording = true;
        micStatus.textContent = 'Recording (Live)...';
        micLed.className = 'led-recording';

        secondsElapsed = 0;
        updateTimerDisplay();
        recordingInterval = setInterval(() => {
          secondsElapsed++;
          updateTimerDisplay();
        }, 1000);
      }, 3000);

    } else {
      // STOP RECORDING
      mediaRecorder.stop();
      isRecording = false;
      clearInterval(recordingInterval);
      micStatus.textContent = 'Ready';
      micLed.className = 'led-on';
    }
  });
}

function updateTimerDisplay() {
  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const secs = String(secondsElapsed % 60).padStart(2, '0');
  if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
}

function saveRecordedTakeToMixer() {
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const audioUrl = URL.createObjectURL(blob);
  
  // 1. Add to local mic take list
  const li = document.createElement('li');
  const timestamp = new Date().toLocaleTimeString();
  li.innerHTML = `
    <span>Mic Take (${timestamp})</span>
    <audio controls src="${audioUrl}"></audio>
  `;
  takesList.prepend(li);

  // 2. Automatically inject a fully functional track channel into the Multitrack Mixer frame
  try {
    const mixerDoc = window.parent.document.getElementById('multitrack').contentDocument;
    if (mixerDoc) {
      // Find the main tracks list wrapper or insert before the Save Mix control area
      const tracksContainer = mixerDoc.getElementById('tracks-container') || mixerDoc.body;
      const saveMixBtn = mixerDoc.getElementById('save-mix-btn'); // assuming this exists based on your note

      const trackDiv = mixerDoc.createElement('div');
      trackDiv.className = 'track-item channel-strip'; // Matches typical multi-track classes
      trackDiv.style.cssText = "background: #1e1e1e; padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #444; display: flex; align-items: center; justify-content: space-between; gap: 10px;";
      
      trackDiv.innerHTML = `
        <div style="font-size: 11px; color: #0ff; font-weight: bold; min-width: 80px;">MIC TAKE</div>
        <audio controls src="${audioUrl}" style="flex-grow: 1; height: 32px;"></audio>
      `;

      // Insert before save mix button if present so it doesn't drop below bottom controls
      if (saveMixBtn && saveMixBtn.parentNode) {
        saveMixBtn.parentNode.insertBefore(trackDiv, saveMixBtn);
      } else {
        tracksContainer.appendChild(trackDiv);
      }
    }
  } catch (err) {
    console.log('Could not auto-inject into mixer frame:', err);
  }
}
