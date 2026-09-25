// The Phantom Frequency - Core Telemetry & Web Audio Signal Synthesizer

let audioCtx = null;
let isPlaying = false;
let osc = null;
let gainNode = null;
let masterGainNode = null;
let intervalId = null;
let currentModeIndex = 0;
const modes = ['AM', 'USB', 'LSB'];
let volumeLevel = 0.7;

// QRN Static Audio State
let qrnActive = false;
let noiseNode = null;
let noiseGainNode = null;

const playBtn = document.getElementById('playSignalBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const modeToggleBtn = document.getElementById('modeToggleBtn');
const qrnToggleBtn = document.getElementById('qrnToggleBtn');
const copyCoordsBtn = document.getElementById('copyCoordsBtn');
const toggleDecoderBtn = document.getElementById('toggleDecoderBtn');
const decoderBox = document.getElementById('decoderBox');
const decryptBtn = document.getElementById('decryptBtn');
const decryptedBreakdown = document.getElementById('decryptedBreakdown');
const toastNotification = document.getElementById('toastNotification');
const sMeterBars = document.getElementById('sMeterBars');
const sMeterReadout = document.getElementById('sMeterReadout');

const canvas = document.getElementById('oscilloscope');
const canvasCtx = canvas.getContext('2d');

// Oscilloscope waveform simulation & Dynamic S-Meter update
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
  const modeColors = {
    AM: '#39ff14',
    USB: '#00f0ff',
    LSB: '#ffb830'
  };
  const activeColor = modeColors[modes[currentModeIndex]] || '#39ff14';
  
  canvasCtx.strokeStyle = isPlaying ? activeColor : '#ffb830';
  canvasCtx.shadowBlur = isPlaying ? 8 : 4;
  canvasCtx.shadowColor = isPlaying ? activeColor : '#ffb830';

  canvasCtx.beginPath();
  const amplitude = isPlaying ? 22 * volumeLevel : 6;
  const baseNoise = qrnActive ? 4.5 : 1.2;
  const noiseAmp = isPlaying ? (currentModeIndex === 0 ? baseNoise + 2 : baseNoise) : baseNoise * 0.7;

  for (let x = 0; x < width; x++) {
    const normalX = x / width;
    const noise = (Math.random() - 0.5) * noiseAmp;
    let freqMult = currentModeIndex === 1 ? 32 : currentModeIndex === 2 ? 18 : 24;
    let y = height / 2 + Math.sin(normalX * freqMult + phase) * amplitude + noise;
    
    // If buzzing pulse emulation
    if (isPlaying && Math.floor((phase * 4) % 10) === 0) {
      y += (Math.random() - 0.5) * 14;
    }

    if (x === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0;

  phase += isPlaying ? (currentModeIndex === 1 ? 0.28 : 0.2) : 0.04;

  // Update Signal Gauge (S-Meter)
  updateSMeter();
}

function updateSMeter() {
  if (!sMeterBars || !sMeterReadout) return;
  let level = 2; // Ambient base
  if (qrnActive) level += 2;
  if (isPlaying) {
    const pulsePeak = Math.sin(phase * 3) > 0.3 ? 3 : 1;
    level += Math.floor(volumeLevel * 3) + pulsePeak;
  }
  level = Math.min(8, Math.max(1, level));

  const bars = sMeterBars.querySelectorAll('.s-bar');
  bars.forEach((bar, idx) => {
    bar.classList.toggle('active', idx < level);
  });

  const labels = ['S1', 'S2', 'S3', 'S5', 'S7', 'S9', 'S9+10dB', 'S9+30dB'];
  sMeterReadout.textContent = labels[level - 1] || 'S3';
}

drawScope();

// Atmospheric Static (QRN) Generator via Web Audio Buffer
function createNoiseNode(ctx) {
  const bufferSize = 2 * ctx.sampleRate;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
    b6 = white * 0.115926;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;
  return whiteNoise;
}

function setupQrnAudio() {
  if (!audioCtx || !masterGainNode) return;
  if (qrnActive) {
    try {
      noiseGainNode = audioCtx.createGain();
      noiseGainNode.gain.setValueAtTime(0.04 * volumeLevel, audioCtx.currentTime);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.2, audioCtx.currentTime);

      noiseNode = createNoiseNode(audioCtx);
      noiseNode.connect(filter);
      filter.connect(noiseGainNode);
      noiseGainNode.connect(masterGainNode);
      noiseNode.start();
    } catch(e) {}
  } else {
    if (noiseNode) {
      try { noiseNode.stop(); } catch(e) {}
      noiseNode.disconnect();
      noiseNode = null;
    }
    if (noiseGainNode) {
      noiseGainNode.disconnect();
      noiseGainNode = null;
    }
  }
}

// Web Audio Synthesizer for UVB-76 Buzzer Emulation
function startAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.setValueAtTime(volumeLevel, audioCtx.currentTime);
  masterGainNode.connect(audioCtx.destination);

  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gainNode.connect(masterGainNode);

  osc = audioCtx.createOscillator();
  const oscTypes = ['sawtooth', 'square', 'triangle'];
  osc.type = oscTypes[currentModeIndex] || 'sawtooth';
  const freqs = [140, 165, 120];
  osc.frequency.setValueAtTime(freqs[currentModeIndex] || 140, audioCtx.currentTime);
  osc.connect(gainNode);
  osc.start();

  if (qrnActive) {
    setupQrnAudio();
  }

  // Buzz pulse loop
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
  if (noiseNode) {
    try { noiseNode.stop(); } catch(e) {}
    noiseNode.disconnect();
    noiseNode = null;
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

// Gain Slider Control
if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    volumeLevel = parseFloat(e.target.value) / 100;
    if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
    if (masterGainNode && audioCtx) {
      masterGainNode.gain.setValueAtTime(volumeLevel, audioCtx.currentTime);
    }
    if (noiseGainNode && audioCtx) {
      noiseGainNode.gain.setValueAtTime(0.04 * volumeLevel, audioCtx.currentTime);
    }
  });
}

// Mode Switcher
if (modeToggleBtn) {
  modeToggleBtn.addEventListener('click', () => {
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    const newMode = modes[currentModeIndex];
    modeToggleBtn.textContent = `MODE: ${newMode}`;
    
    if (isPlaying && osc && audioCtx) {
      const oscTypes = ['sawtooth', 'square', 'triangle'];
      const freqs = [140, 165, 120];
      osc.type = oscTypes[currentModeIndex];
      osc.frequency.setValueAtTime(freqs[currentModeIndex], audioCtx.currentTime);
    }
  });
}

// QRN Static Noise Switcher
if (qrnToggleBtn) {
  qrnToggleBtn.addEventListener('click', () => {
    qrnActive = !qrnActive;
    qrnToggleBtn.textContent = qrnActive ? 'QRN NOISE: ON' : 'QRN NOISE: OFF';
    qrnToggleBtn.classList.toggle('active', qrnActive);
    if (isPlaying) {
      setupQrnAudio();
    }
  });
}

// Copy Telemetry Coords
function showToast(msg) {
  if (!toastNotification) return;
  toastNotification.textContent = msg;
  toastNotification.classList.remove('hidden');
  toastNotification.classList.add('visible');
  setTimeout(() => {
    toastNotification.classList.remove('visible');
    toastNotification.classList.add('hidden');
  }, 2400);
}

if (copyCoordsBtn) {
  copyCoordsBtn.addEventListener('click', () => {
    const textToCopy = "56°5′0″N 37°6′37″E | 4625.0 kHz (UVB-76)";
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast("Telemetry coordinates copied!");
    }).catch(() => {
      showToast("56°5′0″N 37°6′37″E copied!");
    });
  });
}

// Phonetic Cipher Reference Toggle
if (toggleDecoderBtn && decoderBox) {
  toggleDecoderBtn.addEventListener('click', () => {
    decoderBox.classList.toggle('hidden');
    toggleDecoderBtn.textContent = decoderBox.classList.contains('hidden')
      ? '🔍 Phonetic Cipher Reference'
      : '✖ Hide Cipher Reference';
  });
}

// Intercept Decryption Breakdown Toggle
if (decryptBtn && decryptedBreakdown) {
  decryptBtn.addEventListener('click', () => {
    decryptedBreakdown.classList.toggle('hidden');
    const isHidden = decryptedBreakdown.classList.contains('hidden');
    decryptBtn.textContent = isHidden
      ? '⚡ Analyze Intercept Telemetry'
      : '✖ Conceal Intercept Telemetry';
    if (!isHidden) {
      showToast('Intercept telemetry analyzed');
    }
  });
}

// Periodic Ionospheric Telemetry Fluctuation Simulation
function simulatePropChanges() {
  const sfiEl = document.getElementById('sfiVal');
  const kIndexEl = document.getElementById('kIndexVal');
  if (sfiEl) {
    const sfiBase = 148;
    const jitter = Math.floor((Math.random() - 0.5) * 6);
    sfiEl.textContent = `${sfiBase + jitter} SFU`;
  }
  if (kIndexEl) {
    const kVal = Math.random() > 0.85 ? 3 : 2;
    kIndexEl.textContent = `${kVal} (${kVal > 2 ? 'UNSETTLED' : 'QUIET'})`;
  }
}
setInterval(simulatePropChanges, 12000);

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
