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
let isMonitoring = false;

// DOM Elements
const connectBtn = document.getElementById('mic-connect-btn');
const recBtn = document.getElementById('mic-rec-btn');
const stopBtn = document.getElementById('mic-stop-btn');
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
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: false 
      } 
    });

    // Create Audio Nodes
    micSource = audioCtx.createMediaStreamSource(micStream);
    gainNode = audioCtx.createGain();
    filterNode = audioCtx.createBiquadFilter();

    // Set initial parameter values
    gainNode.gain.value = parseFloat(micGainInput.value);
    filterNode.type = filterTypeSelect.value === 'none' ? 'allpass' : filterTypeSelect.value;
    filterNode.frequency.value = parseFloat(filterFreqInput.value);

    // Destination node specifically for recording the processed audio stream
    const dest = audioCtx.createMediaStreamDestination();
    destinationNode = dest;

    // Connect audio routing graph: Source -> Gain -> Filter -> Destination (Recorder)
    micSource.connect(gainNode);
    gainNode.connect(filterNode);
    filterNode.connect(destinationNode);

    // Setup MediaRecorder
    mediaRecorder = new MediaRecorder(dest.stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    mediaRecorder.onstop = saveRecordedTake;

    // Update UI state
    micLed.className = 'led-on';
    micStatus.textContent = 'Connected & Active';
    connectBtn.textContent = 'Mic Connected';
    connectBtn.disabled = true;
    recBtn.disabled = false;

  } catch (err) {
    console.error('Microphone access error:', err);
    micLed.className = 'led-off';
    micStatus.textContent = 'Permission Denied / Error';
  }
});

// Real-time Controls
micGainInput.addEventListener('input', (e) => {
  if (gainNode) {
    gainNode.gain.value = parseFloat(e.target.value);
  }
});

filterTypeSelect.addEventListener('change', (e) => {
  if (filterNode) {
    const val = e.target.value;
    filterNode.type = val === 'none' ? 'allpass' : val;
  }
});

filterFreqInput.addEventListener('input', (e) => {
  if (filterNode) {
    filterNode.frequency.value = parseFloat(e.target.value);
  }
});

// Direct Monitoring Toggle (Warning: Use headphones to avoid feedback loop!)
micMonitorCheckbox.addEventListener('change', (e) => {
  if (!audioCtx || !filterNode) return;
  if (e.target.checked) {
    filterNode.connect(audioCtx.destination);
    isMonitoring = true;
  } else {
    try {
      filterNode.disconnect(audioCtx.destination);
    } catch (err) {}
    isMonitoring = false;
  }
});

// Recorder Transport Controls
recBtn.addEventListener('click', () => {
  if (!mediaRecorder) return;
  recordedChunks = [];
  mediaRecorder.start();
  
  recBtn.disabled = true;
  stopBtn.disabled = false;
  micLed.className = 'led-on'; // Can style or flash for recording if preferred
  micStatus.textContent = 'Recording...';

  // Start Timer
  secondsElapsed = 0;
  updateTimerDisplay();
  recordingInterval = setInterval(() => {
    secondsElapsed++;
    updateTimerDisplay();
  }, 1000);
});

stopBtn.addEventListener('click', () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  
  clearInterval(recordingInterval);
  recBtn.disabled = false;
  stopBtn.disabled = true;
  micStatus.textContent = 'Ready';
});

function updateTimerDisplay() {
  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const secs = String(secondsElapsed % 60).padStart(2, '0');
  timerDisplay.textContent = `${mins}:${secs}`;
}

function saveRecordedTake() {
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const audioUrl = URL.createObjectURL(blob);
  
  const li = document.createElement('li');
  const timestamp = new Date().toLocaleTimeString();
  
  li.innerHTML = `
    <span>Take (${timestamp})</span>
    <audio controls src="${audioUrl}"></audio>
    <a href="${audioUrl}" download="mic-take-${Date.now()}.webm" class="btn primary-btn" style="padding: 4px 8px; text-decoration: none; font-size: 11px;">💾 Save</a>
  `;
  
  takesList.prepend(li);
}
