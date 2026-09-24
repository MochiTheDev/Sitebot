// The Phantom Frequency - Core Telemetry & Web Audio Signal Synthesizer

let audioCtx = null;
let isPlaying = false;
let osc = null;
let gainNode = null;
let intervalId = null;

const playBtn = document.getElementById('playSignalBtn');
const canvas = document.getElementById('oscilloscope');
const canvasCtx = canvas.getContext('2d');

// Oscilloscope waveform simulation
let phase = 0;
function drawScope() {
  requestAnimationFrame(drawScope);

  const width = canvas.width;
  const height = canvas.height;

  canvasCtx.fillStyle = '#040608';
  canvasCtx.fillRect(0, 0, width, height);

  // Grid lines
  canvasCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  canvasCtx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(x, 0);
    canvasCtx.lineTo(x, height);
    canvasCtx.stroke();
  }
  for (let y = 0; y < height; y += 20) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, y);
    canvasCtx.lineTo(width, y);
    canvasCtx.stroke();
  }

  // Signal trace
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = isPlaying ? '#39ff14' : '#ffb830';
  canvasCtx.shadowBlur = isPlaying ? 8 : 4;
  canvasCtx.shadowColor = isPlaying ? '#39ff14' : '#ffb830';

  canvasCtx.beginPath();
  const amplitude = isPlaying ? 22 : 6;
  const noiseAmp = isPlaying ? 2 : 0.8;

  for (let x = 0; x < width; x++) {
    const normalX = x / width;
    const noise = (Math.random() - 0.5) * noiseAmp;
    let y = height / 2 + Math.sin(normalX * 24 + phase) * amplitude + noise;
    
    // If buzzing pulse emulation
    if (isPlaying && Math.floor((phase * 4) % 10) === 0) {
      y += (Math.random() - 0.5) * 14;
    }

    if (x === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0;

  phase += isPlaying ? 0.2 : 0.04;
}
drawScope();

// Web Audio Synthesizer for UVB-76 Buzzer Emulation
function startAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gainNode.connect(audioCtx.destination);

  osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, audioCtx.currentTime); // Low raspy hum
  osc.connect(gainNode);
  osc.start();

  // Buzz pulse loop: 25 repetitions per minute (approx every 2.4s, 0.8s on, 1.6s off)
  function triggerBuzz() {
    if (!isPlaying) return;
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gainNode.gain.setValueAtTime(0.18, now + 0.8);
    gainNode.gain.linearRampToValueAtTime(0.001, now + 0.88);
  }

  triggerBuzz();
  intervalId = setInterval(triggerBuzz, 2200);
}

function stopAudio() {
  if (intervalId) clearInterval(intervalId);
  if (gainNode && audioCtx) {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
  }
  if (osc) {
    try { osc.stop(); } catch(e) {}
    osc.disconnect();
    osc = null;
  }
}

playBtn.addEventListener('click', () => {
  if (!isPlaying) {
    startAudio();
    isPlaying = true;
    playBtn.classList.add('playing');
    playBtn.querySelector('.icon').textContent = '■';
    playBtn.querySelector('.btn-text').textContent = 'Halt Audio Feed';
  } else {
    stopAudio();
    isPlaying = false;
    playBtn.classList.remove('playing');
    playBtn.querySelector('.icon').textContent = '▶';
    playBtn.querySelector('.btn-text').textContent = 'Synthesize Carrier Tone';
  }
});

// Midnight rollover countdown for daily refresh feeling
function updateCountdown() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const diff = tomorrow - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const timerEl = document.getElementById('countdownTimer');
  if (timerEl) {
    timerEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)} UTC`;
  }
}
setInterval(updateCountdown, 1000);
updateCountdown();
