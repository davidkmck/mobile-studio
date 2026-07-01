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

  // 2. Real Sample-based Multi-Instrument Engine
  const sampler = new Tone.Sampler({
    urls: { "C4": "C4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "A5": "A5.mp3" },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => console.log("Samples loaded successfully!")
  });
  sampler.volume.value = -2;

  // Route BOTH engines into the same effect chain so Echo, Reverb, and Chorus work globally
  synth.chain(chorus, feedbackDelay, reverb, Tone.Destination);
  sampler.chain(chorus, feedbackDelay, reverb, Tone.Destination);

  // ─── Instrument Configurations ────────────────────────────────
  const SAMPLER_MAPS = {
    piano: {
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      urls: { "C4": "C4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "A5": "A5.mp3" }
    },
    guitar: {
      baseUrl: "https://tonejs.github.io/audio/casio/",
      urls: { "G2": "G2.mp3", "C3": "C3.mp3", "E3": "E3.mp3", "G3": "G3.mp3" }
    },
    bass: {
      baseUrl: "https://tonejs.github.io/audio/applause/",
      urls: { "E1": "E1.mp3", "A1": "A1.mp3", "D2": "D2.mp3", "G2": "G2.mp3" }
    },
    organ: {
      baseUrl: "https://tonejs.github.io/audio/bermuda/",
      urls: { "C3": "C3.mp3", "G3": "G3.mp3", "C4": "C4.mp3", "G4": "G4.mp3" }
    }
  };

  // Switch sound engine states dynamically depending on dropdown selection
  document.getElementById('instrumentSelect').addEventListener('change', (e) => {
    const mode = e.target.value;
    const waveSelect = document.getElementById('waveSelect');

    if (mode === 'synth') {
      waveSelect.disabled = false;
    } else {
      waveSelect.disabled = true; // Disable synth wave selector when an authentic sampled instrument is active
      const config = SAMPLER_MAPS[mode];
      if (config) {
        sampler.urls = config.urls;
        sampler.baseUrl = config.baseUrl;
      }
    }
  });

  document.getElementById('waveSelect').addEventListener('change', (e) => {
    synth.set({ oscillator: { type: e.target.value } });
  });

  // Helper function to figure out which sound engine instance to trigger
  function getActiveEngine() {
    const instrumentMode = document.getElementById('instrumentSelect').value;
    return instrumentMode === 'synth' ? synth : sampler;
  }

  // ─── Build keyboard ───────────────────────────────────────────
  function buildKeyboard() {
    const kb = document.getElementById('keyboard');
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

    document.getElementById('octaveDisplay').textContent =
      `Octave ${baseOctave}–${baseOctave + NUM_OCTAVES_SHOWN - 1}`;
  }

  function attachKeyEvents(el, note) {
    const press = async (e) => {
      e.preventDefault();
      await Tone.start();
      if (activeNotes.has(note)) return;
      activeNotes.add(note);
      el.classList.add('pressed');
      getActiveEngine().triggerAttack(note);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      if (!activeNotes.has(note)) return;
      activeNotes.delete(note);
      el.classList.remove('pressed');
      getActiveEngine().triggerRelease(note);
    };

    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
  }

  document.getElementById('octaveDownBtn').addEventListener('click', () => {
    if (baseOctave > 1) { baseOctave--; buildKeyboard(); }
  });
  document.getElementById('octaveUpBtn').addEventListener('click', () => {
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
      activeNotes.add(fullNote);
      getActiveEngine().triggerAttack(fullNote);
      const el = document.querySelector(`[data-note="${fullNote}"]`);
      if (el) el.classList.add('pressed');
    }
  });

  window.addEventListener('keyup', (e) => {
    const note = KEY_MAP[e.key.toLowerCase()];
    if (!note) return;
    heldKeys.delete(e.key);
    const fullNote = `${note}${baseOctave}`;
    activeNotes.delete(fullNote);
    getActiveEngine().triggerRelease(fullNote);
    const el = document.querySelector(`[data-note="${fullNote}"]`);
    if (el) el.classList.remove('pressed');
  });

  // ─── Edit panel ────────────────────────────────────────────────
  function buildEditorControls() {
    const wrap = document.getElementById('globalEditorControls');
    wrap.innerHTML = '';

    const rows = [
      { label: 'Volume', min: -40, max: 0, value: synth.volume.value,
        onInput: v => { 
          synth.volume.value = parseFloat(v); 
          sampler.volume.value = parseFloat(v) + 4; 
        } 
      },
      { label: 'Attack', min: 0, max: 1, step: 0.01, value: 0.02,
        onInput: v => synth.set({ envelope: { attack: parseFloat(v) } }) },
      { label: 'Decay', min: 0, max: 1, step: 0.01, value: 0.2,
        onInput: v => synth.set({ envelope: { decay: parseFloat(v) } }) },
      { label: 'Sustain', min: 0, max: 1, step: 0.01, value: 0.4,
        onInput: v => synth.set({ envelope: { sustain: parseFloat(v) } }) },
      { label: 'Release', min: 0, max: 2, step: 0.01, value: 0.8,
        onInput: v => synth.set({ envelope: { release: parseFloat(v) } }) },
      
      // ─── Effects Knobs ───
      { label: 'Chorus Mix', min: 0, max: 1, step: 0.01, value: chorus.wet.value,
        onInput: v => { chorus.wet.value = parseFloat(v); } },
      { label: 'Echo Mix', min: 0, max: 1, step: 0.01, value: feedbackDelay.wet.value,
        onInput: v => { feedbackDelay.wet.value = parseFloat(v); } },
      { label: 'Reverb Mix', min: 0, max: 1, step: 0.01, value: reverb.wet.value,
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
      slider.addEventListener('input', () => r.onInput(slider.value));
      row.appendChild(slider);

      wrap.appendChild(row);
    });
  }

  document.getElementById('toggleEditBtn').addEventListener('click', () => {
    const panel = document.getElementById('synthEditor');
    const btn = document.getElementById('toggleEditBtn');
    const willShow = !panel.classList.contains('visible');
    panel.classList.toggle('visible');
    btn.textContent = willShow ? '🎛️ Hide Edit Controls' : '🎛️ Show Edit Controls';
    if (willShow && document.getElementById('globalEditorControls').children.length === 0) {
      buildEditorControls();
    }
  });

  // ─── Recording + handoff to Tracks ─────────────────────────────
  async function recordWav() {
    const btn = document.getElementById('recordBtn');
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
      
      activeNotes.forEach(note => getActiveEngine().triggerRelease(note));
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
      btn.textContent = '🔴Record';
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

  document.getElementById('playBtn').addEventListener('click', () => {
    window.parent.postMessage({ action: 'REQUEST_PLAY', bpm: 120 }, '*');
  });

  document.getElementById('recordBtn').addEventListener('click', recordWav);

  // ─── Boot ───────────────────────────────────────────────────────
  buildKeyboard();

  window.parent.postMessage({ action: 'SYNTH_READY' }, '*');
