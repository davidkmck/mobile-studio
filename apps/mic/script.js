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

    // Listen to parent/global transport record button if available in top frame
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

// Sync with Main Studio's Global Record Button
function setupGlobalTransportListener() {
  const globalRecBtn = window.parent.document.getElementById('global-record-btn');
  if (!globalRecBtn) return;

  let isRecording = false;

  globalRecBtn.addEventListener('click', () => {
    if (!mediaRecorder) return;

    if (!isRecording) {
      // START RECORDING
      recordedChunks = [];
      mediaRecorder.start();
      isRecording = true;
      micStatus.textContent = 'Recording (Master)...';
      micLed.className = 'led-recording';

      secondsElapsed = 0;
      updateTimerDisplay();
      recordingInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
      }, 1000);
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

  // 2. Automatically inject a new track element into the Multitrack Mixer frame if accessible
  try {
    const mixerDoc = window.parent.document.getElementById('multitrack').contentDocument;
    if (mixerDoc) {
      const tracksContainer = mixerDoc.getElementById('tracks-container') || mixerDoc.body;
      const trackDiv = mixerDoc.createElement('div');
      trackDiv.className = 'mixer-channel new-mic-track';
      trackDiv.style.cssText = "background: #222; padding: 10px; margin: 5px; border-radius: 6px; border: 1px solid #444;";
      trackDiv.innerHTML = `
        <div style="font-size: 10px; color: #0ff; margin-bottom: 4px;">MIC TAKE (${timestamp})</div>
        <audio controls src="${audioUrl}" style="width: 100%; height: 25px;"></audio>
      `;
      tracksContainer.appendChild(trackDiv);
    }
  } catch (err) {
    console.log('Could not auto-inject into mixer frame due to cross-origin or selector mismatch:', err);
  }
}
