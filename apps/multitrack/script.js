
  let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let isCountdownActive = false;
    let isPlayingMix = false;
    let localStream = null;
    
    let progressAnimationId = null;
    let isScrubbing = false;

    const tracks = [];
    let audioCtx = null;

    const recordBtn         = document.getElementById('recordBtn');
    const audioFileInput    = document.getElementById('audio-file-input');
    const masterPlayBtn     = document.getElementById('master-play-btn');
    const resetBtn          = document.getElementById('reset-btn');
    const loopToggle        = document.getElementById('loopToggle');
    const latencySlider     = document.getElementById('latency-slider');
    const latencyVal        = document.getElementById('latency-val');
    const saveMixBtn        = document.getElementById('save-mix-btn');
    const mixerBoard        = document.getElementById('mixer-board');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel     = document.getElementById('settingsPanel');

    if (latencySlider && latencyVal) {
      latencySlider.addEventListener('input', (e) => {
        latencyVal.textContent = `${e.target.value}ms`;
      });
    }

    if (settingsToggleBtn && settingsPanel) {
      settingsToggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('active');
      });
    }
  
    window.addEventListener('message', async (event) => {
      console.log("Multitrack received:", event.data);
      
      if (event.data.action === 'ADD_CLIP_TO_TIMELINE') {
        const { audioBlob, trackName } = event.data;
        addAudioToTimeline(trackName, audioBlob);
      }
      
      if (event.data.action === 'START_AUDIO') {
        await Tone.start(); 
        Tone.Transport.bpm.value = event.data.bpm || 120;
        
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.loop = false;
          stopAllTracks();
          startAllTracks(); 
          Tone.Transport.start();
        }
      }

      if (event.data.action === 'STOP_AUDIO') {
        if (Tone.Transport.state === 'started') {
          Tone.Transport.stop();
          stopAllTracks();
        }
      }
      
      if (event.data.action === 'SWITCH_APP') {
        updateUI(); 
      }
      
      if (event.data && event.data.action === 'ADD_TRACK') {
        const { audioBuffer, trackName } = event.data;
        try {
            await Tone.start();
            await createTrackNodeFromBuffer(audioBuffer, trackName);
            console.log("Success: Track successfully added to mixer.");
        } catch (err) {
            console.error('Failed to add incoming clip:', err);
        }
      }
    });

    async function createTrackNodeFromBuffer(arrayBuffer, customName) {
      const ctx = getAudioContext();
      const actualBuffer = arrayBuffer.buffer ? arrayBuffer.buffer : arrayBuffer;
      const decodedBuffer = await ctx.decodeAudioData(actualBuffer);

      const trackObject = {
        id: Date.now(),
        name: customName || `Track ${tracks.length + 1}`,
        audioBuffer: decodedBuffer,
        tonePlayer: null,
        volumeNode: null,
        pannerNode: null,
        currentPan: 0,
        currentVolume: 1.0,
        duration: decodedBuffer.duration || 0,
        playheadOffset: 0
      };

      tracks.push(trackObject);
      if (mixerBoard) { mixerBoard.innerHTML = ''; }
      renderMixerBoard();
    }
    
    async function addAudioToTimeline(url, trackName) {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        await createTrackNodeFromBuffer(arrayBuffer, trackName);
      } catch (err) {
        console.error('CRITICAL ERROR in addAudioToTimeline:', err);
      }
    }
    
    function getAudioContext() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    recordBtn.addEventListener('click', async () => {
      if (isCountdownActive) return;
      getAudioContext();

      if (!isRecording) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          isCountdownActive = true;
          recordBtn.className = 'btn-countdown';
          
          let count = 3;
          recordBtn.textContent = `⏳ Recording starts in ${count}...`;

          const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
              recordBtn.textContent = `⏳ Recording starts in ${count}...`;
            } else {
              clearInterval(countdownInterval);
              isCountdownActive = false;
              startHardwareRecording();
            }
          }, 1000);

        } catch (err) {
          console.error('Microphone access denied:', err);
          alert('Could not access microphone. Check site permissions.');
        }
      } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        isRecording = false;
      }
    });

    function startHardwareRecording() {
      stopAllTracks();
      recordedChunks = [];
      if (tracks.length > 0) {
        startAllTracks({ monitoringOnly: true });
      }

      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : {};

      mediaRecorder = new MediaRecorder(localStream, recorderOptions);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopAllTracks();
        let rawBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const compensationMs = parseInt(latencySlider.value);
        if (compensationMs > 0 && tracks.length > 0) {
          rawBlob = await sliceAudioBlobLatency(rawBlob, compensationMs);
        }

        await createTrackNode(rawBlob, `Recorded Input ${tracks.length + 1}`);

        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
          localStream = null;
        }
        updateUI();
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '⏹️ Stop recording';
      recordBtn.className = 'btn-recording';
    }

    function getSupportedMimeType() {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
    }

    async function sliceAudioBlobLatency(blob, msToRemove) {
      const tempCtx = getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      
      const sampleRate = audioBuffer.sampleRate;
      const samplesToRemove = Math.floor((msToRemove / 1000) * sampleRate);
      if (samplesToRemove >= audioBuffer.length) return blob;

      const newLength = audioBuffer.length - samplesToRemove;
      const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, newLength, sampleRate);
      
      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start(0, msToRemove / 1000);
      
      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(renderedBuffer);
    }

    async function createTrackNode(blob, customName) {
      const ctx = getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const decodedAudio = await ctx.decodeAudioData(arrayBuffer);

      const trackObject = {
        id: Date.now(),
        name: customName || `Track ${tracks.length + 1}`,
        blob: blob,
        audioBuffer: decodedAudio,
        tonePlayer: null,
        volumeNode: null,
        pannerNode: null,
        currentPan: 0,
        currentVolume: 1.0,
        duration: decodedAudio.duration || 0,
        playheadOffset: 0
      };

      tracks.push(trackObject);
      renderMixerBoard();
    }

    function renderMixerBoard() {
      if (!mixerBoard) return;
      mixerBoard.innerHTML = '';

      tracks.forEach((track) => {
        const row = document.createElement('div');
        row.className = 'track-row';
        
        row.innerHTML = `
          <div class="track-header">
            <span class="track-title">${track.name}</span>
            <button class="btn-delete" id="delete-btn-${track.id}">🗑️</button>
          </div>
          <div class="controls-container">
            <div class="slider-container">
              <div class="slider-label">
                <span>Playback Position</span>
                <span id="pos-val-${track.id}">0.00s</span>
              </div>
              <input type="range" class="progress-slider" id="progress-${track.id}" min="0" max="${track.duration || 0}" step="0.01" value="0">
            </div>

            <div class="sliders-row">
              <div class="slider-container">
                <div class="slider-label">
                  <span>Volume</span>
                  <span id="vol-txt-${track.id}">100%</span>
                </div>
                <input type="range" id="volume-${track.id}" min="0" max="1" step="0.01" value="${track.currentVolume}">
              </div>
              <div class="slider-container">
                <div class="slider-label">
                  <span>Pan</span>
                  <span id="pan-val-${track.id}">${track.currentPan}</span>
                </div>
                <input type="range" id="pan-${track.id}" min="-1" max="1" step="0.1" value="${track.currentPan}">
              </div>
            </div>
          </div> 
        `;
        
        mixerBoard.appendChild(row);

        document.getElementById(`delete-btn-${track.id}`).onclick = () => deleteTrack(track.id);
        
        document.getElementById(`volume-${track.id}`).oninput = (e) => {
          const val = parseFloat(e.target.value);
          track.currentVolume = val;
          document.getElementById(`vol-txt-${track.id}`).textContent = `${Math.round(val * 100)}%`;
          if (track.volumeNode) {
            track.volumeNode.volume.value = Tone.gainToDb(val);
          }
        };

        document.getElementById(`pan-${track.id}`).oninput = (e) => {
          const val = parseFloat(e.target.value);
          track.currentPan = val;
          document.getElementById(`pan-val-${track.id}`).textContent = val;
          if (track.pannerNode) {
            track.pannerNode.pan.value = val;
          }
        };

        const progressSlider = document.getElementById(`progress-${track.id}`);
        if (progressSlider) {
          progressSlider.oninput = (e) => {
            isScrubbing = true;
            const targetTime = parseFloat(e.target.value);
            updateAllProgressUI(targetTime);
          };

          progressSlider.onchange = (e) => {
            const targetTime = parseFloat(e.target.value);
            scrubPlaybackToTimestamp(targetTime);
            isScrubbing = false;
          };
        }
      });

      if (recordBtn && !isRecording) {
        recordBtn.textContent = `🔴 Record Track ${tracks.length + 1} from Microphone`;
      }
      updateUI();
    }

    function deleteTrack(id) {
      stopAllTracks();
      const index = tracks.findIndex(t => t.id === id);
      if (index !== -1) { tracks.splice(index, 1); }
      renderMixerBoard();
    }

    if (masterPlayBtn) {
      masterPlayBtn.addEventListener('click', async () => {
        await Tone.start();
        getAudioContext();

        if (isPlayingMix) {
          stopAllTracks();
        } else {
          startAllTracks();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        getAudioContext();
        stopAllTracks();
        Tone.Transport.seconds = 0;
        tracks.forEach(t => t.playheadOffset = 0);
        resetAllProgressUI();
      });
    }

    function startAllTracks(options = {}) {
      if (!tracks || tracks.length === 0) return;

      let baseOffset = tracks[0].playheadOffset;
      const maxDuration = Math.max(...tracks.map(t => t.duration));
      
      if (baseOffset >= maxDuration) {
        baseOffset = 0;
        tracks.forEach(t => t.playheadOffset = 0);
      }

      Tone.Transport.seconds = baseOffset;

      tracks.forEach(track => {
        if (track.tonePlayer) {
          try { 
            track.tonePlayer.unsync();
            track.tonePlayer.dispose(); 
          } catch(e) {}
        }

        track.tonePlayer = new Tone.Player(track.audioBuffer);
        track.tonePlayer.loop = false; 

        track.volumeNode = new Tone.Volume(Tone.gainToDb(track.currentVolume));
        track.pannerNode = new Tone.Panner(track.currentPan);
        track.tonePlayer.chain(track.volumeNode, track.pannerNode, Tone.Destination);

        if (track.playheadOffset < track.duration) {
          track.tonePlayer.sync().start(0, track.playheadOffset);
        }
      });

      if (!options.monitoringOnly) {
        isPlayingMix = true;
        masterPlayBtn.textContent = '⏸️ Pause Mix';
        
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
        progressAnimationId = requestAnimationFrame(updatePlaybackProgressUI);
      } else {
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
      }
    }

    function stopAllTracks() {
      cancelAnimationFrame(progressAnimationId);

      if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
      }

      Tone.Transport.cancel();

      const currentTimelinePosition = Tone.Transport.seconds;
      
      tracks.forEach(track => {
        if (isPlayingMix) {
          track.playheadOffset = currentTimelinePosition;
        }
        if (track.tonePlayer) {
          try { 
            track.tonePlayer.unsync(); 
            track.tonePlayer.stop(); 
            track.tonePlayer.dispose(); 
          } catch(e) {
            console.error("Error cleaning up track player:", e);
          }
          track.tonePlayer = null;
        }
      });

      isPlayingMix = false;
      masterPlayBtn.textContent = '▶️ Play Mix';
    }

    function scrubPlaybackToTimestamp(targetTime) {
      const originallyPlaying = isPlayingMix;
      stopAllTracks();
      Tone.Transport.seconds = targetTime;
      tracks.forEach(track => { track.playheadOffset = targetTime; });
      updateAllProgressUI(targetTime);
      if (originallyPlaying) {
        startAllTracks();
      }
    }

    function resetAllProgressUI() {
      updateAllProgressUI(0);
    }

    function updateAllProgressUI(timeInSeconds) {
      tracks.forEach(track => {
        const currentPos = Math.min(timeInSeconds, track.duration);
        const progSlider  = document.getElementById(`progress-${track.id}`);
        const currentText = document.getElementById(`pos-val-${track.id}`);
        if (progSlider)  progSlider.value       = currentPos;
        if (currentText) currentText.textContent = currentPos.toFixed(2) + 's';
      });
    }

    function updatePlaybackProgressUI() {
      if (!isPlayingMix || isScrubbing) return;

      const elapsed = Tone.Transport.seconds;
      updateAllProgressUI(elapsed);

      const maxDuration = Math.max(...tracks.map(t => t.duration));
      if (elapsed >= maxDuration) {
        stopAllTracks();
        Tone.Transport.seconds = 0;
        tracks.forEach(t => t.playheadOffset = 0);
        resetAllProgressUI();
        if (loopToggle && loopToggle.checked) {
          startAllTracks();
        }
        return;
      }

      progressAnimationId = requestAnimationFrame(updatePlaybackProgressUI);
    }

    function updateUI() {
      const noTracks = tracks.length === 0;
      masterPlayBtn.disabled = noTracks;
      resetBtn.disabled      = noTracks;
      saveMixBtn.disabled    = noTracks;

      if (isRecording || isCountdownActive) return;

      recordBtn.disabled    = false;
      recordBtn.textContent = `🔴 Record Track ${tracks.length + 1} from Microphone`;
      recordBtn.className   = '';
    }

    saveMixBtn.addEventListener('click', async () => {
      if (!tracks || tracks.length === 0) return;
      saveMixBtn.disabled    = true;
      saveMixBtn.textContent = 'Rendering mix...';

      try {
        const maxDuration = Math.max(...tracks.map(t => t.duration));
        const sampleRate  = tracks[0].audioBuffer.sampleRate;
        const offlineCtx  = new OfflineAudioContext(2, Math.ceil(sampleRate * maxDuration), sampleRate);

        tracks.forEach((track) => {
          const bufferSource = offlineCtx.createBufferSource();
          bufferSource.buffer = track.audioBuffer;

          const offlineGain   = offlineCtx.createGain();
          offlineGain.gain.setValueAtTime(track.currentVolume, 0);

          const offlinePanner = offlineCtx.createStereoPanner();
          offlinePanner.pan.setValueAtTime(track.currentPan, 0);

          bufferSource.connect(offlineGain);
          offlineGain.connect(offlinePanner);
          offlinePanner.connect(offlineCtx.destination);
          bufferSource.start(0);
        });

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob        = audioBufferToWav(renderedBuffer);
        const downloadUrl    = URL.createObjectURL(wavBlob);

        const anchor = document.createElement('a');
        anchor.href     = downloadUrl;
        anchor.download = `multitrack-mix-${Date.now()}.wav`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(downloadUrl);

      } catch (err) {
        console.error('Export failure:', err);
        alert('Failed to export the audio mix.');
      } finally {
        saveMixBtn.disabled    = false;
        saveMixBtn.textContent = '💾 Save Mix';
      }
    });

    function audioBufferToWav(buffer) {
      const numOfChan = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const bitDepth   = 16;
      let result;

      if (numOfChan === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
      } else {
        result = buffer.getChannelData(0);
      }

      const bufferArr = new ArrayBuffer(44 + result.length * 2);
      const view      = new DataView(bufferArr);

      writeString(view, 0,  'RIFF');
      view.setUint32(4,  36 + result.length * 2, true);
      writeString(view, 8,  'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1,  true);
      view.setUint16(22, numOfChan,  true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
      view.setUint16(32, numOfChan * (bitDepth / 8), true);
      view.setUint16(34, bitDepth,   true);
      writeString(view, 36, 'data');
      view.setUint32(40, result.length * 2, true);

      let offset = 44;
      for (let i = 0; i < result.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, result[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }

      return new Blob([view], { type: 'audio/wav' });
    }

    function interleave(inputL, inputR) {
      const length = inputL.length + inputR.length;
      const result = new Float32Array(length);
      let index = 0, inputIndex = 0;
      while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
      }
      return result;
    }

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    updateUI();
