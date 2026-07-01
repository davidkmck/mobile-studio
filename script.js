
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
    
    function switchApp(targetAppId) {
      document.querySelectorAll('.app-frame').forEach(frame => frame.classList.remove('active'));
      const activeFrame = document.getElementById(targetAppId);
      if (activeFrame) activeFrame.classList.add('active');

      document.querySelectorAll('.rack-device').forEach(el => {
        el.classList.toggle('active', el.dataset.app === targetAppId);
      });

      if (targetAppId === 'multitrack' && pendingClip && activeFrame) {
        activeFrame.contentWindow.postMessage(pendingClip, '*');
        pendingClip = null;
      }
    }

    function loadApp(appName, event) {
      if (event) event.preventDefault(); 
      switchApp(appName);
    }
