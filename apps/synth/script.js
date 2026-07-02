// ─── Keyboard layout ──────────────────────────────────────────
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = { 'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#' };
const NUM_OCTAVES_SHOWN = 2;
let baseOctave = 4;

let isRecording = false;
let recorder = null;
const activeNotes = new Set();

// ─── Effects Setup ────────────────────────────────────────────
const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).start();
const feedbackDelay = new Tone.FeedbackDelay({ delayTime: "4n", feedback: 0.4, wet: 0 });
const reverb = new Tone.Reverb({ roomSize: 0.7, wet: 0 });

reverb.generate();

// ─── Sound engines & Global Effects Chain ─────────────────────
// 1. Classic Synth Engine
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.8 }
});
synth.volume.value = -6;

// 2. Real Sample-based Multi-Instrument Engine Placeholder
let sampler = null;

// Function to safely build/rebuild the sampler node when switching instruments
function loadSamplerInstrument(config) {
  if (sampler) {
    sampler.disconnect();
    sampler.dispose();
  }

  sampler = new Tone.Sampler({
    urls: config.urls,
    baseUrl: config.baseUrl,
    onload: () => console.log("New instrument samples loaded successfully!")
  });
  sampler.volume.value = -2;

  // Route the brand new sampler instance into your global effects pipeline
  sampler.chain(chorus, feedbackDelay, reverb, Tone.Destination);
}

// Route the initial synth engine setup
synth.chain(chorus, feedbackDelay, reverb, Tone.Destination);

// ─── Instrument Configurations (Distinct High-Quality Paths) ──────
const SAMPLER_MAPS = {
  piano: {
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    urls: { "C4": "C4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "A5": "A5.mp3" }
  },
  guitar: {
    baseUrl: "https://tonejs.github.io/audio/guitar-acoustic/",
    urls: { "C3": "C3.mp3", "G3": "G3.mp3", "C4": "C4.mp3", "G4": "G4.mp3" }
  },
  bass: {
    baseUrl: "https://tonejs.github.io/audio/bass-electric/",
    urls: { "C1": "C1.mp3", "G1": "G1.mp3", "C2": "C2.mp3", "G2": "G2.mp3" }
  },
  organ: {
    baseUrl: "https://tonejs.github.io/audio/organ/",
    urls: { "C3": "C3.mp3", "G3": "G3.mp3", "C4": "C4.mp3", "G4": "G4.mp3" }
  }
};

// Define fallback default engine baselines
const DEFAULT_SETTINGS = {
  instrument: 'synth',
  wave: 'sawtooth',
  volume: -6,
  attack: 0.02,
  decay: 0.2,
  sustain: 0.4,
  release: 0.8,
  chorusMix: 0,
  echoMix: 0,
  reverbMix: 0
};

// ─── Boot State Cache Restore Logic ───────────────────────────
const savedInstrument = localStorage.getItem('synth_instrument') || DEFAULT_SETTINGS.instrument;
const savedWave = localStorage.getItem('synth_wave') || DEFAULT_SETTINGS.wave;

const instrumentSelect = document.getElementById('instrumentSelect');
const waveSelect = document.getElementById('waveSelect');

if (instrumentSelect) instrumentSelect.value = savedInstrument;
if (waveSelect) {
  waveSelect.value = savedWave;
  waveSelect.disabled = (savedInstrument !== 'synth');
}

// Load custom user parameters from local memory or set defaults
synth.set({ oscillator: { type: savedWave } });

const initVol = localStorage.getItem('synth_setting_Volume') ? parseFloat(localStorage.getItem('synth_setting_Volume')) : DEFAULT_SETTINGS.volume;
const initAtk = localStorage.getItem('synth_setting_Attack') ? parseFloat(localStorage.getItem('synth_setting_Attack')) : DEFAULT_SETTINGS.attack;
const initDec = localStorage.getItem('synth_setting_Decay') ? parseFloat(localStorage.getItem('synth_setting_Decay')) : DEFAULT_SETTINGS.decay;
const initSus = localStorage.getItem('synth_setting_Sustain') ? parseFloat(localStorage.getItem('synth_setting_Sustain')) : DEFAULT_SETTINGS.sustain;
const initRel = localStorage.getItem('synth_setting_Release') ? parseFloat(localStorage.getItem('synth_setting_Release')) : DEFAULT_SETTINGS.release;

synth.volume.value = initVol;
synth.set({ envelope: { attack: initAtk, decay: initDec, sustain: initSus, release: initRel } });

const initChorus = localStorage.getItem('synth_setting_Chorus Mix') ? parseFloat(localStorage.getItem('synth_setting_Chorus Mix')) : DEFAULT_SETTINGS.chorusMix;
const initEcho = localStorage.getItem('synth_setting_Echo Mix') ? parseFloat(localStorage.getItem('synth_setting_Echo Mix')) : DEFAULT_SETTINGS.echoMix;
const initReverb = localStorage.getItem('synth_setting_Reverb Mix') ? parseFloat(localStorage.getItem('synth_setting_Reverb Mix')) : DEFAULT_SETTINGS.reverbMix;

chorus.wet.value = initChorus;
feedbackDelay.wet.value = initEcho;
reverb.wet.value = initReverb;

// Allocate initial active channel routing map on launch
if (savedInstrument === 'synth') {
  synth.chain(chorus, feedbackDelay, reverb, Tone.Destination);
} else {
  const config = SAMPLER_MAPS[savedInstrument];
  if (config) loadSamplerInstrument(config);
}

// ─── Event Control Listeners ──────────────────────────────────
if (instrumentSelect) {
  instrumentSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    localStorage.setItem('synth_instrument', mode);
    
    if (mode === 'synth') {
      if (waveSelect) waveSelect.disabled = false;
    } else {
      if (waveSelect) waveSelect.disabled = true;
      const config = SAMPLER_MAPS[mode];
      if (config) loadSamplerInstrument(config);
    }
  });
}

if (waveSelect) {
  waveSelect.addEventListener('change', (e) => {
    const wave = e.target.value;
    localStorage.setItem('synth_wave', wave);
    synth.set({ oscillator: { type: wave } });
  });
}

function getActiveEngine() {
  const instrumentMode = document.getElementById('instrumentSelect')?.value || 'synth';
  return instrumentMode === 'synth' ? synth : sampler;
}

// ─── Build keyboard ───────────────────────────────────────────
function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  if (!kb) return;
  kb.innerHTML = '';

  const whiteKeyEls = [];
  let whiteIndex = 0;

  for (let o = 0; o < NUM_OCTAVES_SHOWN; o++) {
    const octave = baseOctave + o;
    WHITE_NOTES.forEach(note => {
      const key = document.createElement('div');
      key.className = 'white-key';
      key.dataset.note = `${note}${octave}`;
      key.textContent = `${note}${octave}`;
      kb.appendChild(key);
      whiteKeyEls.push(key);
      attachKeyEvents(key, key.dataset.note);
      whiteIndex++;
    });
  }

  const totalWhite = whiteKeyEls.length;
  const whiteKeyPercent = 100 / totalWhite;

  let wi = 0;
  for (let o = 0; o < NUM_OCTAVES_SHOWN; o++) {
    const octave = baseOctave + o;
    WHITE_NOTES.forEach(note => {
      if (BLACK_NOTES[note]) {
        const blackNote = `${BLACK_NOTES[note]}${octave}`;
        const bk = document.createElement('div');
        bk.className = 'black-key';
        bk.dataset.note = blackNote;
        bk.style.left = `calc(${(wi + 1) * whiteKeyPercent}% - 3.25%)`;
        kb.appendChild(bk);
        attachKeyEvents(bk, blackNote);
      }
      wi++;
    });
  }

  const octDisplay = document.getElementById('octaveDisplay');
  if (octDisplay) {
    octDisplay.textContent = `Octave ${baseOctave}–${baseOctave + NUM_OCTAVES_SHOWN - 1}`;
  }
}

function attachKeyEvents(el, note) {
  const press = async (e) => {
    e.preventDefault();
    await Tone.start();
    if (activeNotes.has(note)) return;
    const engine = getActiveEngine();
    if (engine) {
      activeNotes.add(note);
      el.classList.add('pressed');
      engine.triggerAttack(note);
    }
  };
  const release = (e) => {
    if (e) e.preventDefault();
    if (!activeNotes.has(note)) return;
    activeNotes.delete(note);
    el.classList.remove('pressed');
    const engine = getActiveEngine();
    if (engine) engine.triggerRelease(note);
  };

  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release, { passive: false });
  el.addEventListener('touchcancel', release, { passive: false });
}

document.getElementById('octaveDownBtn')?.addEventListener('click', () => {
  if (baseOctave > 1) { baseOctave--; buildKeyboard(); }
});
document.getElementById('octaveUpBtn')?.addEventListener('click', () => {
  if (baseOctave < 6) { baseOctave++; buildKeyboard(); }
});

// ─── Computer keyboard support ──────────────────────────────────
const KEY_MAP = {
  'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E',
  'f': 'F', 't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A',
  'u': 'A#', 'j': 'B'
};
const heldKeys = new Set();

window.addEventListener('keydown', async (e) => {
  const note = KEY_MAP[e.key.toLowerCase()];
  if (!note || heldKeys.has(e.key)) return;
  heldKeys.add(e.key);
  await Tone.start();
  const fullNote = `${note}${baseOctave}`;
  if (!activeNotes.has(fullNote)) {
    const engine = getActiveEngine();
    if (engine) {
      activeNotes.add(fullNote);
      engine.triggerAttack(fullNote);
      const el = document.querySelector(`[data-note="${fullNote}"]`);
      if (el) el.classList.add('pressed');
    }
  }
});

window.addEventListener('keyup', (e) => {
  const note = KEY_MAP[e.key.toLowerCase()];
  if (!note) return;
  heldKeys.delete(e.key);
  const fullNote = `${note}${baseOctave}`;
  activeNotes.delete(fullNote);
  const engine = getActiveEngine();
  if (engine) engine.triggerRelease(fullNote);
  const el = document.querySelector(`[data-note="${fullNote}"]`);
  if (el) el.classList.remove('pressed');
});

// ─── Edit panel controls builder ───────────────────────────────
function buildEditorControls() {
  const wrap = document.getElementById('globalEditorControls');
  if (!wrap) return;
  wrap.innerHTML = '';

  const rows = [
    { label: 'Volume', min: -40, max: 0, value: localStorage.getItem('synth_setting_Volume') ? parseFloat(localStorage.getItem('synth_setting_Volume')) : synth.volume.value,
      onInput: v => { 
        synth.volume.value = parseFloat(v); 
        if (sampler) sampler.volume.value = parseFloat(v) + 4; 
      } 
    },
    { label: 'Attack', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Attack') ? parseFloat(localStorage.getItem('synth_setting_Attack')) : initAtk,
      onInput: v => synth.set({ envelope: { attack: parseFloat(v) } }) },
    { label: 'Decay', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Decay') ? parseFloat(localStorage.getItem('synth_setting_Decay')) : initDec,
      onInput: v => synth.set({ envelope: { decay: parseFloat(v) } }) },
    { label: 'Sustain', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Sustain') ? parseFloat(localStorage.getItem('synth_setting_Sustain')) : initSus,
      onInput: v => synth.set({ envelope: { sustain: parseFloat(v) } }) },
    { label: 'Release', min: 0, max: 2, step: 0.01, value: localStorage.getItem('synth_setting_Release') ? parseFloat(localStorage.getItem('synth_setting_Release')) : initRel,
      onInput: v => synth.set({ envelope: { release: parseFloat(v) } }) },
    
    { label: 'Chorus Mix', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Chorus Mix') ? parseFloat(localStorage.getItem('synth_setting_Chorus Mix')) : chorus.wet.value,
      onInput: v => { chorus.wet.value = parseFloat(v); } },
    { label: 'Echo Mix', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Echo Mix') ? parseFloat(localStorage.getItem('synth_setting_Echo Mix')) : feedbackDelay.wet.value,
      onInput: v => { feedbackDelay.wet.value = parseFloat(v); } },
    { label: 'Reverb Mix', min: 0, max: 1, step: 0.01, value: localStorage.getItem('synth_setting_Reverb Mix') ? parseFloat(localStorage.getItem('synth_setting_Reverb Mix')) : reverb.wet.value,
      onInput: v => { reverb.wet.value = parseFloat(v); } }
  ];

  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'editor-row';

    const label = document.createElement('label');
    label.textContent = r.label;
    row.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = r.min;
    slider.max = r.max;
    slider.step = r.step || 1;
    slider.value = r.value;
    slider.dataset.setting = r.label;
    slider.addEventListener('input', () => {
      r.onInput(slider.value);
      localStorage.setItem(`synth_setting_${slider.dataset.setting}`, slider.value);
    });
    row.appendChild(slider);
    wrap.appendChild(row);
  });
}

document.getElementById('toggleEditBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('synthEditor');
  const btn = document.getElementById('toggleEditBtn');
  if (!panel || !btn) return;
  
  const willShow = !panel.classList.contains('visible');
  panel.classList.toggle('visible');
  btn.textContent = willShow ? '🎛️ Hide Edit Controls' : '🎛️ Show Edit Controls';
  if (willShow && document.getElementById('globalEditorControls').children.length === 0) {
    buildEditorControls();
  }
});

// ─── Reset Engine Settings Event Handler ───────────────────────
const resetBtn = document.getElementById('resetSettingsBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('synth_instrument');
    localStorage.removeItem('synth_wave');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('synth_setting_')) localStorage.removeItem(key);
    });
    window.location.reload();
  });
}

// ─── Recording + handoff to Tracks ─────────────────────────────
async function recordWav() {
  const btn = document.getElementById('recordBtn');
  if (!btn) return;
  await Tone.start();

  if (!isRecording) {
    if (!recorder) {
      recorder = new Tone.Recorder();
      Tone.Destination.connect(recorder);
    }
    window.parent.postMessage({ action: 'REQUEST_PLAY', bpm: Tone.Transport.bpm.value || 120 }, '*');
    
    recorder.start();
    isRecording = true;
    
    btn.textContent = '⏹️ Stop Recording';
    btn.className = 'btn-recording';
  } else {
    const recording = await recorder.stop();
    window.parent.postMessage({ action: 'REQUEST_STOP' }, '*');
    
    const engine = getActiveEngine();
    if (engine) activeNotes.forEach(note => engine.triggerRelease(note));
    activeNotes.clear();
    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));

    const audioBuffer = await recording.arrayBuffer();
    window.parent.postMessage({
      action: 'ADD_TRACK',
      audioBuffer: audioBuffer,
      trackName: `Synth_${Date.now()}`
    }, '*');
    
    window.parent.postMessage({ action: 'SWITCH_APP', app: 'multitrack' }, '*');

    isRecording = false;
    btn.textContent = '🔴 Record';
    btn.className = 'btn-record';
  }
}

window.addEventListener('message', (event) => {
  if (event.data.action === 'START_AUDIO') {
    Tone.start();
    Tone.Transport.bpm.value = event.data.bpm || 120;
    Tone.Transport.start();
  }
  if (event.data.action === 'STOP_AUDIO') {
    if (isRecording) return; 
    Tone.Transport.stop();
  }
});

const recordButtonEl = document.getElementById('recordBtn');
if (recordButtonEl) {
  recordButtonEl.addEventListener('click', recordWav);
}

// ─── Boot ───────────────────────────────────────────────────────
buildKeyboard();
window.parent.postMessage({ action: 'SYNTH_READY' }, '*');
