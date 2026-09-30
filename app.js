// The Phantom Frequency - Core Telemetry & Web Audio Signal Synthesizer

let audioCtx = null;
let isPlaying = false;
let osc = null;
let gainNode = null;
let masterGainNode = null;
let dspFilterNode = null;
let intervalId = null;
let currentModeIndex = 0;
const modes = ['AM', 'USB', 'LSB'];
let volumeLevel = 0.7;

// CRT Phosphor Color Palette Configuration
const phosphorPalettes = {
  green: {
    primary: '#39ff14',
    grid: 'rgba(57, 255, 20, 0.08)',
    shadow: '#39ff14',
    waterfall: (intensity) => {
      if (intensity < 0.12) return '#040608';
      if (intensity < 0.35) {
        const b = Math.floor(intensity * 255);
        return `rgb(0, ${Math.floor(b * 0.7)}, ${b})`;
      }
      const g = Math.floor(intensity * 255);
      return `rgb(0, ${g}, ${Math.floor(g * 0.3)})`;
    }
  },
  amber: {
    primary: '#ffb830',
    grid: 'rgba(255, 184, 48, 0.08)',
    shadow: '#ffb830',
    waterfall: (intensity) => {
      if (intensity < 0.12) return '#040608';
      const r = Math.floor(intensity * 255);
      const g = Math.floor(intensity * 170);
      return `rgb(${r}, ${g}, 15)`;
    }
  },
  cyan: {
    primary: '#00f0ff',
    grid: 'rgba(0, 240, 255, 0.08)',
    shadow: '#00f0ff',
    waterfall: (intensity) => {
      if (intensity < 0.12) return '#040608';
      const b = Math.floor(intensity * 255);
      const g = Math.floor(intensity * 220);
      return `rgb(0, ${g}, ${b})`;
    }
  },
  white: {
    primary: '#e0f4ff',
    grid: 'rgba(224, 244, 255, 0.08)',
    shadow: '#ffffff',
    waterfall: (intensity) => {
      if (intensity < 0.12) return '#040608';
      const v = Math.floor(intensity * 255);
      return `rgb(${v}, ${v}, ${Math.floor(v * 0.95)})`;
    }
  }
};
let currentPhosphor = 'green';

// RF Front-End Attenuator State (0 dB, -10 dB, -20 dB)
const attLevels = [
  { label: 'ATT: 0 dB', mult: 1.0, sDrop: 0 },
  { label: 'ATT: -10 dB', mult: 0.32, sDrop: 2 },
  { label: 'ATT: -20 dB', mult: 0.1, sDrop: 4 }
];
let currentAttIndex = 0;
const attToggleBtn = document.getElementById('attToggleBtn');

// DSP Filter Bandwidth State (6.0 kHz WIDE, 2.4 kHz SSB, 0.5 kHz CW/NARROW)
const filterBandwidths = [
  { label: 'DSP: 2.4k (SSB)', freq: 2400, q: 1.8 },
  { label: 'DSP: 0.5k (NAR)', freq: 650, q: 4.5 },
  { label: 'DSP: 6.0k (WIDE)', freq: 6000, q: 0.7 }
];
let currentFilterIndex = 0;
const filterBandwidthBtn = document.getElementById('filterBandwidthBtn');

// Receiver Visualizer Display Mode ('SCOPE' or 'WATERFALL')
let visMode = 'SCOPE';
const visModeBtn = document.getElementById('visModeBtn');
if (visModeBtn) {
  visModeBtn.addEventListener('click', () => {
    visMode = visMode === 'SCOPE' ? 'WATERFALL' : 'SCOPE';
    visModeBtn.textContent = `VIS: ${visMode}`;
    visModeBtn.classList.toggle('active', visMode === 'WATERFALL');
  });
}

// Frequency Tuning State (Base 4625.0 kHz)
const baseFreq = 4625.0;
let currentFreq = 4625.0;

// QRN Static & QRM Solar Burst Audio State
let qrnActive = false;
let qrmActive = false;
let noiseNode = null;
let noiseGainNode = null;
let qrmInterval = null;

const playBtn = document.getElementById('playSignalBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const modeToggleBtn = document.getElementById('modeToggleBtn');
const qrnToggleBtn = document.getElementById('qrnToggleBtn');
const qrmToggleBtn = document.getElementById('qrmToggleBtn');
const copyCoordsBtn = document.getElementById('copyCoordsBtn');
const toggleDecoderBtn = document.getElementById('toggleDecoderBtn');
const decoderBox = document.getElementById('decoderBox');
const decryptBtn = document.getElementById('decryptBtn');
const decryptedBreakdown = document.getElementById('decryptedBreakdown');
const toastNotification = document.getElementById('toastNotification');
const sMeterBars = document.getElementById('sMeterBars');
const sMeterReadout = document.getElementById('sMeterReadout');
const freqValueEl = document.getElementById('freqValue');
const freqDownBtn = document.getElementById('freqDownBtn');
const freqResetBtn = document.getElementById('freqResetBtn');
const freqUpBtn = document.getElementById('freqUpBtn');

// SWL Log Elements
const logInterceptBtn = document.getElementById('logInterceptBtn');
const swlTicket = document.getElementById('swlTicket');
const copyTicketBtn = document.getElementById('copyTicketBtn');
const swlZoneSelect = document.getElementById('swlZoneSelect');
const swlRstSelect = document.getElementById('swlRstSelect');
const ticketTimestamp = document.getElementById('ticketTimestamp');
const ticketFreq = document.getElementById('ticketFreq');
const ticketRst = document.getElementById('ticketRst');
const ticketZone = document.getElementById('ticketZone');
const ticketHash = document.getElementById('ticketHash');

const canvas = document.getElementById('oscilloscope');
const canvasCtx = canvas.getContext('2d');

// CRT Phosphor Theme Buttons Listener
const phosBtns = document.querySelectorAll('.phos-btn');
phosBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    phosBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPhosphor = btn.getAttribute('data-phos') || 'green';
    showToast(`CRT Phosphor: ${currentPhosphor.toUpperCase()} mode`);
  });
});

// Oscilloscope & SDR Waterfall Spectrogram visualizer loop
let phase = 0;
function drawScope() {
  requestAnimationFrame(drawScope);

  const width = canvas.width;
  const height = canvas.height;
  const attFactor = attLevels[currentAttIndex].mult;
  const palette = phosphorPalettes[currentPhosphor] || phosphorPalettes.green;

  // Waterfall Spectrogram Mode
  if (visMode === 'WATERFALL') {
    // Scroll previous canvas image downwards 1px
    canvasCtx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1);
    
    const detuneOffset = (currentFreq - baseFreq) * 50;
    const carrierCenterX = width / 2 + detuneOffset;
    
    // Render top 1px spectrograph row
    for (let x = 0; x < width; x++) {
      let intensity = Math.random() * (qrnActive ? 0.35 : 0.08) * attFactor;
      if (qrmActive && Math.random() < 0.12) {
        intensity += Math.random() * 0.5;
      }
      
      if (isPlaying) {
        const dist = Math.abs(x - carrierCenterX);
        const pulseMod = (Math.sin(phase * 4) > 0 ? 0.85 : 0.25);
        const carrierPeak = Math.exp(-(dist * dist) / 30) * pulseMod * volumeLevel * attFactor;
        intensity += carrierPeak;
      }
      
      intensity = Math.min(1, Math.max(0, intensity));
      canvasCtx.fillStyle = palette.waterfall(intensity);
      canvasCtx.fillRect(x, 0, 1, 1);
    }

    phase += isPlaying ? (currentModeIndex === 1 ? 0.28 : 0.2) : 0.04;
    updateSMeter();
    return;
  }

  // Standard Oscilloscope Trace Mode
  canvasCtx.fillStyle = '#040608';
  canvasCtx.fillRect(0, 0, width, height);

  // Grid lines
  canvasCtx.strokeStyle = palette.grid;
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

  // Signal trace styling
  canvasCtx.lineWidth = 2;
  const activeColor = palette.primary;
  
  canvasCtx.strokeStyle = isPlaying ? activeColor : palette.primary;
  canvasCtx.shadowBlur = isPlaying ? 8 : 4;
  canvasCtx.shadowColor = palette.shadow;

  canvasCtx.beginPath();
  
  // Amplitude diminishes if detuned off 4625.0 kHz and with ATT active
  const detuneDist = Math.abs(currentFreq - baseFreq);
  const detuneFactor = Math.max(0.2, 1 - (detuneDist / 3));
  const amplitude = isPlaying ? 22 * volumeLevel * detuneFactor * attFactor : 6 * attFactor;
  const baseNoise = (qrnActive ? 4.5 : 1.2) * attFactor;
  const noiseAmp = isPlaying ? (currentModeIndex === 0 ? baseNoise + 2 : baseNoise) : baseNoise * 0.7;

  for (let x = 0; x < width; x++) {
    const normalX = x / width;
    let noise = (Math.random() - 0.5) * noiseAmp;
    if (qrmActive && Math.random() < 0.1) {
      noise += (Math.random() - 0.5) * 28 * attFactor;
    }

    let freqMult = currentModeIndex === 1 ? 32 : currentModeIndex === 2 ? 18 : 24;
    // Frequency detune adds secondary ripple flutter
    const detuneRipple = detuneDist > 0 ? Math.sin(normalX * 60 + phase * 2) * (detuneDist * 3) : 0;
    let y = height / 2 + Math.sin(normalX * freqMult + phase) * amplitude + noise + detuneRipple;
    
    // If buzzing pulse emulation
    if (isPlaying && Math.floor((phase * 4) % 10) === 0) {
      y += (Math.random() - 0.5) * (14 * detuneFactor * attFactor);
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
  if (qrmActive && Math.random() < 0.3) level += 3;
  if (isPlaying) {
    const pulsePeak = Math.sin(phase * 3) > 0.3 ? 3 : 1;
    level += Math.floor(volumeLevel * 3) + pulsePeak;
    // Off-carrier detune reduces received signal strength
    const detuneOffset = Math.abs(currentFreq - baseFreq);
    level -= Math.floor(detuneOffset * 2);
  }
  
  // Front-end RF attenuation drop
  level -= attLevels[currentAttIndex].sDrop;
  level = Math.min(8, Math.max(1, level));

  const bars = sMeterBars.querySelectorAll('.s-bar');
  bars.forEach((bar, idx) => {
    bar.classList.toggle('active', idx < level);
  });

  const labels = ['S1', 'S2', 'S3', 'S5', 'S7', 'S9', 'S9+10dB', 'S9+30dB'];
  sMeterReadout.textContent = labels[level - 1] || 'S3';
}

drawScope();

// Calculate oscillator frequency taking into account demodulation mode and VFO tuning offset
function getTunedFrequency() {
  const freqs = [140, 165, 120];
  const centerTone = freqs[currentModeIndex] || 140;
  const offset = (currentFreq - baseFreq) * 90; // heterodyne pitch shift in Hz
  return Math.max(50, Math.min(900, centerTone + offset));
}

// Apply DSP bandwidth filter parameters
function updateDspFilterParams() {
  if (!dspFilterNode || !audioCtx) return;
  const filterCfg = filterBandwidths[currentFilterIndex];
  dspFilterNode.frequency.setTargetAtTime(filterCfg.freq, audioCtx.currentTime, 0.05);
  dspFilterNode.Q.setTargetAtTime(filterCfg.q, audioCtx.currentTime, 0.05);
}

// Update Master Gain factoring volume and ATT
function updateMasterGain() {
  if (!masterGainNode || !audioCtx) return;
  const effectiveGain = volumeLevel * attLevels[currentAttIndex].mult;
  masterGainNode.gain.setValueAtTime(effectiveGain, audioCtx.currentTime);
}

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

function triggerQrmBurstSound() {
  if (!audioCtx || !masterGainNode || !isPlaying || !qrmActive) return;
  try {
    const burstOsc = audioCtx.createOscillator();
    const burstGain = audioCtx.createGain();
    burstOsc.type = 'sawtooth';
    burstOsc.frequency.setValueAtTime(300 + Math.random() * 800, audioCtx.currentTime);
    burstOsc.frequency.exponentialRampToValueAtTime(80 + Math.random() * 120, audioCtx.currentTime + 0.12);
    
    burstGain.gain.setValueAtTime(0.12 * volumeLevel, audioCtx.currentTime);
    burstGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    
    burstOsc.connect(burstGain);
    burstGain.connect(masterGainNode);
    burstOsc.start();
    burstOsc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function setupQrnAudio() {
  if (!audioCtx || !masterGainNode || !dspFilterNode) return;
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
      noiseGainNode.connect(dspFilterNode);
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
  updateMasterGain();
  masterGainNode.connect(audioCtx.destination);

  // DSP Bandpass Filtering Node
  dspFilterNode = audioCtx.createBiquadFilter();
  dspFilterNode.type = 'lowpass';
  const filterCfg = filterBandwidths[currentFilterIndex];
  dspFilterNode.frequency.setValueAtTime(filterCfg.freq, audioCtx.currentTime);
  dspFilterNode.Q.setValueAtTime(filterCfg.q, audioCtx.currentTime);
  dspFilterNode.connect(masterGainNode);

  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gainNode.connect(dspFilterNode);

  osc = audioCtx.createOscillator();
  const oscTypes = ['sawtooth', 'square', 'triangle'];
  osc.type = oscTypes[currentModeIndex] || 'sawtooth';
  osc.frequency.setValueAtTime(getTunedFrequency(), audioCtx.currentTime);
  osc.connect(gainNode);
  osc.start();

  if (qrnActive) {
    setupQrnAudio();
  }

  // Periodic QRM burst trigger
  if (qrmInterval) clearInterval(qrmInterval);
  qrmInterval = setInterval(() => {
    if (qrmActive && Math.random() < 0.6) {
      triggerQrmBurstSound();
    }
  }, 1800);

  // Buzz pulse loop
  function triggerBuzz() {
    if (!isPlaying) return;
    const now = audioCtx.currentTime;
    const detuneDist = Math.abs(currentFreq - baseFreq);
    const detuneGain = Math.max(0.03, 0.18 - detuneDist * 0.05);
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(detuneGain, now + 0.05);
    gainNode.gain.setValueAtTime(detuneGain, now + 0.8);
    gainNode.gain.linearRampToValueAtTime(0.001, now + 0.88);
  }

  triggerBuzz();
  intervalId = setInterval(triggerBuzz, 2200);
}

function stopAudio() {
  if (intervalId) clearInterval(intervalId);
  if (qrmInterval) clearInterval(qrmInterval);
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

// RF Front-End Attenuator Toggle
if (attToggleBtn) {
  attToggleBtn.addEventListener('click', () => {
    currentAttIndex = (currentAttIndex + 1) % attLevels.length;
    const activeAtt = attLevels[currentAttIndex];
    attToggleBtn.textContent = activeAtt.label;
    attToggleBtn.classList.toggle('active', currentAttIndex > 0);
    updateMasterGain();
    showToast(`Receiver Front-End: ${activeAtt.label}`);
  });
}

// DSP Filter Bandwidth Toggle Handler
if (filterBandwidthBtn) {
  filterBandwidthBtn.addEventListener('click', () => {
    currentFilterIndex = (currentFilterIndex + 1) % filterBandwidths.length;
    const active = filterBandwidths[currentFilterIndex];
    filterBandwidthBtn.textContent = active.label;
    updateDspFilterParams();
    showToast(`Receiver DSP: ${active.label.replace('DSP: ', '')}`);
  });
}

// Gain Slider Control
if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    volumeLevel = parseFloat(e.target.value) / 100;
    if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
    updateMasterGain();
    if (noiseGainNode && audioCtx) {
      noiseGainNode.gain.setValueAtTime(0.04 * volumeLevel, audioCtx.currentTime);
    }
  });
}

// VFO Frequency Stepper Controls
function updateFrequency(newFreq) {
  currentFreq = Math.round(newFreq * 10) / 10;
  if (currentFreq < 4622.0) currentFreq = 4622.0;
  if (currentFreq > 4628.0) currentFreq = 4628.0;
  
  if (freqValueEl) {
    freqValueEl.textContent = `${currentFreq.toFixed(1)} kHz`;
    freqValueEl.classList.toggle('off-carrier', currentFreq !== baseFreq);
  }

  if (isPlaying && osc && audioCtx) {
    osc.frequency.setTargetAtTime(getTunedFrequency(), audioCtx.currentTime, 0.05);
  }
}

if (freqDownBtn) {
  freqDownBtn.addEventListener('click', () => {
    updateFrequency(currentFreq - 0.5);
  });
}

if (freqUpBtn) {
  freqUpBtn.addEventListener('click', () => {
    updateFrequency(currentFreq + 0.5);
  });
}

if (freqResetBtn) {
  freqResetBtn.addEventListener('click', () => {
    updateFrequency(baseFreq);
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
      osc.type = oscTypes[currentModeIndex];
      osc.frequency.setValueAtTime(getTunedFrequency(), audioCtx.currentTime);
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

// QRM Solar Flare Burst Interference Switcher
if (qrmToggleBtn) {
  qrmToggleBtn.addEventListener('click', () => {
    qrmActive = !qrmActive;
    qrmToggleBtn.textContent = qrmActive ? 'QRM BURST: ON' : 'QRM BURST: OFF';
    qrmToggleBtn.classList.toggle('active', qrmActive);
    showToast(qrmActive ? 'QRM Solar Flare Burst Simulation: ACTIVE' : 'QRM Burst Simulation: OFF');
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

// Direction Finding (DF) Transmitter Triangulation Matrix
const reconSitesData = {
  kerro: {
    title: 'Site 60 &bull; 60th Communication Hub (Kerro Massif)',
    coords: '60°18′49″N 30°16′40″E',
    location: 'Leningrad Oblast (North of St. Petersburg)',
    status: 'ACTIVE MAIN TRANSMITTER',
    statusClass: 'status-active',
    antenna: 'VGDSh Wideband Horizontal Dipole Array (~40m towers)',
    transmitter: 'Molniya-2M / Vyaz-M2 10 kW shortwave unit',
    bearings: [
      { station: 'Stockholm, Sweden (SDR)', dist: '715 km', az: '082°' },
      { station: 'Helsinki, Finland', dist: '320 km', az: '097°' },
      { station: 'Warsaw, Poland', dist: '1,085 km', az: '036°' },
      { station: 'London, UK (SWL)', dist: '2,130 km', az: '058°' }
    ],
    notes: 'Primary transmitter hub since the September 2010 migration. Transmits continuous 4625 kHz skywave covering the Baltic basin and Nordic maritime borders.'
  },
  naro: {
    title: 'Site 43 &bull; 43rd Communications Centre (Naro-Fominsk)',
    coords: '55°25′35″N 36°42′33″E',
    location: 'Moscow Oblast (Southwest of Moscow)',
    status: 'ACTIVE SECONDARY / BACKUP',
    statusClass: 'status-active',
    antenna: 'Dual-feed Inverted VEE &amp; Horizontal T-Dipole',
    transmitter: 'PKV-50 Military HF Transceiver suite',
    bearings: [
      { station: 'Kyiv, Ukraine', dist: '690 km', az: '032°' },
      { station: 'Stockholm, Sweden', dist: '1,190 km', az: '108°' },
      { station: 'Berlin, Germany', dist: '1,560 km', az: '077°' },
      { station: 'London, UK (SWL)', dist: '2,475 km', az: '074°' }
    ],
    notes: 'Secondary transmitter cluster co-located with Western Military District garrison command. Provides groundwave fallback when northern atmospheric conditions fluctuate.'
  },
  povarovo: {
    title: 'Bunker 430 &bull; Historical Military Garrison (Povarovo)',
    coords: '56°05′00″N 37°06′37″E',
    location: 'Solnechnogorsky District, Moscow Oblast',
    status: 'DECOMMISSIONED (1982–2010)',
    statusClass: 'status-decom',
    antenna: 'Remnants of Russian VGDSh mast guywires &amp; feedlines',
    transmitter: 'Soviet-era tube oscillator transmitter (dismantled)',
    bearings: [
      { station: 'Moscow Center', dist: '48 km', az: '315°' },
      { station: 'Saint Petersburg', dist: '590 km', az: '144°' },
      { station: 'Warsaw, Poland', dist: '1,110 km', az: '068°' },
      { station: 'London, UK (SWL)', dist: '2,480 km', az: '072°' }
    ],
    notes: 'The legendary birthplace of the Buzzer. Abandoned abruptly during August 2010 storms. Urban explorers uncovered empty message pads, Soviet tubes, and logbooks in the frozen shelter.'
  }
};

function renderReconSite(siteKey) {
  const data = reconSitesData[siteKey];
  const reconEl = document.getElementById('reconDetails');
  if (!data || !reconEl) return;

  const bearingsHtml = data.bearings.map(b => `
    <div class="recon-bearing-row">
      <span class="b-station">${b.station}</span>
      <span class="b-dist mono-num">${b.dist}</span>
      <span class="b-az mono-num">${b.az}</span>
    </div>
  `).join('');

  reconEl.innerHTML = `
    <div class="recon-content">
      <div class="recon-title-row">
        <h4 class="recon-site-title">${data.title}</h4>
        <span class="recon-status-badge ${data.statusClass}">${data.status}</span>
      </div>
      <div class="recon-coords-row">
        <span class="recon-coords-label">GRID COORDS:</span>
        <code class="recon-coords-code">${data.coords}</code>
        <button class="recon-copy-btn" onclick="navigator.clipboard.writeText('${data.coords}').then(() => showToast('Transmitter coordinates copied!'))">📋 Copy</button>
      </div>
      <div class="recon-meta-grid">
        <div class="recon-meta-item">
          <span class="meta-lbl">LOCATION:</span>
          <span class="meta-val">${data.location}</span>
        </div>
        <div class="recon-meta-item">
          <span class="meta-lbl">ANTENNA RIG:</span>
          <span class="meta-val">${data.antenna}</span>
        </div>
        <div class="recon-meta-item">
          <span class="meta-lbl">ESTIMATED POWER:</span>
          <span class="meta-val">${data.transmitter}</span>
        </div>
      </div>
      <div class="recon-bearings-box">
        <div class="recon-bearings-head">
          <span>GLOBAL SDR DF BEARING</span>
          <span>DISTANCE</span>
          <span>AZIMUTH</span>
        </div>
        ${bearingsHtml}
      </div>
      <p class="recon-notes">${data.notes}</p>
    </div>
  `;
}

// Initialize Recon Section Tabs
const reconTabs = document.querySelectorAll('#reconTabs .recon-tab');
if (reconTabs.length) {
  reconTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      reconTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const siteKey = tab.getAttribute('data-site');
      renderReconSite(siteKey);
    });
  });
  renderReconSite('kerro');
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

// Timeline Filter Chips Handler
const filterChips = document.querySelectorAll('#timelineFilters .filter-chip');
const timelineItems = document.querySelectorAll('#timelineList .timeline-item');

if (filterChips.length && timelineItems.length) {
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filterVal = chip.getAttribute('data-filter');

      timelineItems.forEach(item => {
        const cat = item.getAttribute('data-cat');
        if (filterVal === 'all' || cat === filterVal) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });
}

// Shortwave Listener (SWL) Reception Log Stamp Handler
if (logInterceptBtn && swlTicket) {
  logInterceptBtn.addEventListener('click', () => {
    swlTicket.classList.remove('hidden');
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    
    if (ticketTimestamp) ticketTimestamp.textContent = timeStr;
    if (ticketFreq) ticketFreq.textContent = `${currentFreq.toFixed(1)} kHz`;
    if (ticketRst) ticketRst.textContent = swlRstSelect ? swlRstSelect.value : '356';
    if (ticketZone) ticketZone.textContent = swlZoneSelect ? swlZoneSelect.value.split(' ')[0] : 'Zone 14';
    
    const randToken = Math.random().toString(16).substring(2, 6).toUpperCase();
    const rstVal = swlRstSelect ? swlRstSelect.value : '356';
    if (ticketHash) {
      ticketHash.textContent = `PF-${rstVal}-${randToken}-${Math.round(currentFreq)}`;
    }
    showToast('Reception log stamped & recorded!');
  });
}

if (copyTicketBtn) {
  copyTicketBtn.addEventListener('click', () => {
    const rst = ticketRst ? ticketRst.textContent : '356';
    const zone = ticketZone ? ticketZone.textContent : 'Zone 14';
    const hash = ticketHash ? ticketHash.textContent : 'PF-4625';
    const time = ticketTimestamp ? ticketTimestamp.textContent : 'UTC';
    const ticketText = `[THE PHANTOM FREQUENCY // SWL LOG SLIP]\nTarget: UVB-76 (The Buzzer)\nFrequency: ${currentFreq.toFixed(1)} kHz\nRST Signal: ${rst}\nReceiver QTH: ${zone}\nAuth Token: ${hash}\nTimestamp: ${time}`;
    navigator.clipboard.writeText(ticketText).then(() => {
      showToast('SWL Reception Slip copied!');
    }).catch(() => {
      showToast('Slip copied to clipboard!');
    });
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
