// ─── Keyboard layout ──────────────────────────────────────────
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTES = { 'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#' };
const NUM_OCTAVES_SHOWN = 2;
let baseOctave = 4;

let isRecording = false;  
let recorder = null;
const activeNotes = new Set();
 
// ─── Effects Setup ────────────────────────────────────────────
// Note: Kept synchronous; LFO starts automatically once the user interacts with the app
const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
const feedbackDelay = new Tone.FeedbackDelay({ delayTime: "4n", feedback: 0.4, wet: 0 });
const reverb = new Tone.Reverb({ roomSize: 0.7, wet: 0 });

reverb.generate();

// ─── Sound engines ────────────────────────────────────────────
// 1. Classic Synth Engine
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.8 }
});
synth.volume.value = -6;

// 2. Sample Engine & Fallback Engine Map
let sampler = null;
let fallbackEngine = null;

// Clean up any loaded sampler or fallback instruments
function cleanupEngines() {
  if (sampler) {
    sampler.disconnect();
    sampler.dispose();
    sampler = null;
  }
  if (fallbackEngine) {
    fallbackEngine.disconnect();
    fallbackEngine.dispose();
    fallbackEngine = null;
  }
}

// Function to safely build the sampler node for working remote assets
function loadSamplerInstrument(instrumentName, config) {
  cleanupEngines();

  console.log(`Loading verified samples for: ${instrumentName}`);

  sampler = new Tone.Sampler({
    urls: config.urls,
    baseUrl: config.baseUrl,
    onload: () => {
      console.log(`Samples for ${instrumentName} successfully loaded!`);
      if (sampler) sampler.chain(chorus, feedbackDelay, reverb, Tone.Destination);
    },
    onerror: (err) => {
      console.error(`Unexpected error loading verified ${instrumentName} samples:`, err);
    }
  });
  
  sampler.volume.value = 0;
}

// Route the initial synth engine setup
synth.chain(chorus, feedbackDelay, reverb, Tone.Destination);

// ─── Instrument Configurations ────────────────────────────────
const SAMPLER_MAPS = {
  piano: {
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    urls: { "A0": "A0.mp3", "C1": "C1.mp3", "A1": "A1.mp3", "C2": "C2.mp3", "A2": "A2.mp3", "C3": "C3.mp3", "A3": "A3.mp3", "C4": "C4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "A5": "A5.mp3", "C6": "C6.mp3", "A6": "A6.mp3", "C7": "C7.mp3", "A7": "A7.mp3", "C8": "C8.mp3" }
  },
  casio: {
    baseUrl: "https://tonejs.github.io/audio/casio/",
    urls: { "A1": "A1.mp3", "A2": "A2.mp3", "A3": "A3.mp3", "A4": "A4.mp3" }
  }
};

// ─── Standalone Engine Generator ──────────────────────────────
function createFallbackSynth(instrumentName) {
  if (fallbackEngine) fallbackEngine.dispose();
  console.log(`Generating real-time synth engine for: ${instrumentName}`);

  if (instrumentName === 'guitar') {
    fallbackEngine = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.5,          
      modulationIndex: 12,       
      oscillator: { type: 'sawtooth' }, 
      modulation: { type: 'square' },   
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.6 },
      modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.4 }
    });
    fallbackEngine.volume.value = -8; 

  } else if (instrumentName === 'bass') {
    fallbackEngine = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 15 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 }
    });
    fallbackEngine.volume.value = 4;

  } else if (instrumentName === 'organ') {
    fallbackEngine = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine8' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.2 }
    });
    fallbackEngine.volume.value = -12; 
  } else {
    fallbackEngine = new Tone.PolySynth(Tone.Synth);
    fallbackEngine.volume.value = -6;
  }

  fallbackEngine.chain(chorus, feedbackDelay, reverb, Tone.Destination);
}

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

// Initial Routing Choice based on Saved State
if (savedInstrument === 'synth') {
  synth.chain(chorus, feedbackDelay, reverb, Tone.Destination);
} else if (SAMPLER_MAPS[savedInstrument]) {
  loadSamplerInstrument(savedInstrument, SAMPLER_MAPS[savedInstrument]);
} else {
  createFallbackSynth(savedInstrument);
}

// ─── Event Control Listeners ──────────────────────────────────
if (instrumentSelect) {
  instrumentSelect.addEventListener('change', async (e) => {
    const mode = e.target.value;
    localStorage.setItem('synth_instrument', mode);
    
    // Safely wake up context and effects LFO loops inside user action path
    await Tone.start();
    if (chorus && chorus.state !== 'started') {
      chorus.start();
    }
    
    if (mode === 'synth') {
      if (waveSelect) waveSelect.disabled = false;
      cleanupEngines();
    } else if (SAMPLER_MAPS[mode]) {
      if (waveSelect) waveSelect.disabled = true;
      loadSamplerInstrument(mode, SAMPLER_MAPS[mode]);
    } else {
      if (waveSelect) waveSelect.disabled = true;
      cleanupEngines();
      createFallbackSynth(mode);
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
  if (instrumentMode === 'synth') return synth;
  return (sampler && sampler.loaded) ? sampler : fallbackEngine;
}

// Helper utility to safely process note pitches down for the bass fallback engine
function getProcessedNote(note) {
  const instrumentMode = document.getElementById('instrumentSelect')?.value || 'synth';
  if (instrumentMode === 'bass' && (!sampler || !sampler.loaded)) {
    const match = note.match(/^([A-G]#?)(-?\d+)$/);
    if (match) {
      const pitchName = match[1];
      const octave = parseInt(match[2], 10);
      return `${pitchName}${octave - 2}`;
    }
  }
  return note;
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

  // Target the high prominence badge ID in your header block
  const octDisplay = document.getElementById('octaveDisplay');
  if (octDisplay) {
    octDisplay.textContent = `Octave ${baseOctave}–${baseOctave + NUM_OCTAVES_SHOWN - 1}`;
  }
}

function attachKeyEvents(el, note) {
  const press = async (e) => {
    e.preventDefault();
    await Tone.start();
    if (chorus && chorus.state !== 'started') chorus.start();

    if (activeNotes.has(note)) return;
    const engine = getActiveEngine();
    
    if (engine) {
      activeNotes.add(note);
      el.classList.add('pressed');
      const finalNote = getProcessedNote(note);
      engine.triggerAttack(finalNote);
    }
  };
  const release = (e) => {
    if (e) e.preventDefault();
    if (!activeNotes.has(note)) return;
    activeNotes.delete(note);
    el.classList.remove('pressed');
    const engine = getActiveEngine();
    if (engine) {
      const finalNote = getProcessedNote(note);
      engine.triggerRelease(finalNote);
    }
  };

  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release, { passive: false });
  el.addEventListener('touchcancel', release, { passive: false });
}

// Binds perfectly to your new high prominence button layout IDs
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
  if (chorus && chorus.state !== 'started') chorus.start();

  const fullNote = `${note}${baseOctave}`;
  if (!activeNotes.has(fullNote)) {
    const engine = getActiveEngine();
    if (engine) {
      activeNotes.add(fullNote);
      const finalNote = getProcessedNote(fullNote);
      engine.triggerAttack(finalNote);
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
  if (engine) {
    const finalNote = getProcessedNote(fullNote);
    engine.triggerRelease(fullNote);
  }
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
        if (sampler) sampler.volume.value = parseFloat(v) + 6;
        if (fallbackEngine) {
          const instrumentMode = document.getElementById('instrumentSelect')?.value || 'synth';
          fallbackEngine.volume.value = parseFloat(v) + (instrumentMode === 'bass' ? 10 : 0);
        }
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
async function startRecording() {
  await Tone.start();

  if (!isRecording) {
    if (!recorder) {
      recorder = new Tone.Recorder();
      Tone.Destination.connect(recorder);
    }
    window.parent.postMessage({ action: 'REQUEST_PLAY', bpm: Tone.Transport.bpm.value || 120 }, '*');
    
    recorder.start();
    isRecording = true;
  }
}

async function stopRecording() {
  if (isRecording) {
    const recording = await recorder.stop();
    window.parent.postMessage({ action: 'REQUEST_STOP' }, '*');
    
    const engine = getActiveEngine();
    if (engine) {
      activeNotes.forEach(note => {
        const finalNote = getProcessedNote(note);
        engine.triggerRelease(finalNote);
      });
    }
    activeNotes.clear();
    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));

    const audioBuffer = await recording.arrayBuffer();
    
    // Safely get the instrument value if the element exists
    const instrumentName = document.getElementById('instrumentSelect')?.value || 'Synth';

    window.parent.postMessage({
      action: 'ADD_TRACK',
      audioBuffer: audioBuffer,
      trackName: `${instrumentName}_${Date.now()}`
    }, '*');
    
    isRecording = false;
  }
}

window.addEventListener('message', (event) => {
  if (event.data.action === 'START_AUDIO') {
    Tone.start();
    Tone.Transport.bpm.value = event.data.bpm || 120;
    Tone.Transport.start();
  }
  else if (event.data.action === 'STOP_AUDIO') {
    if (isRecording) return; 
    Tone.Transport.stop();
  }
  else if (event.data.command === 'start-recording') {
    startRecording();
  }
  else if (event.data.command === 'stop-recording') {
    stopRecording();
  }
});

// ─── Boot ───────────────────────────────────────────────────────
buildKeyboard();
window.parent.postMessage({ action: 'SYNTH_READY' }, '*');
