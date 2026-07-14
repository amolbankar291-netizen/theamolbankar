/**
 * Realistic, fully-synthesised car audio — no sound files needed.
 *  - Multi-oscillator engine with fake gearbox (RPM rises then drops on shift)
 *  - Rolling tire rumble + wind noise that scale with speed
 *  - Turbo whoosh on nitro
 *  - Stereo-panned police siren (positioned by the cop's location = "3D")
 *  - Coin / crash SFX (coins can be panned by world X)
 * Must be resumed after a user gesture (handled on PLAY tap).
 */
export class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.engine = null;
    this.tire = null;
    this.wind = null;
    this.siren = null;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      this.enabled = false;
      return;
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this._noiseBuf = this._makeNoise(2);
    this._buildEngine();
    this._buildRoadNoise();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _buildEngine() {
    const now = this.ctx.currentTime;
    // fundamental + harmonic oscillators through a resonant lowpass
    const base = this.ctx.createOscillator();
    base.type = 'sawtooth';
    base.frequency.value = 60;
    const harm = this.ctx.createOscillator();
    harm.type = 'square';
    harm.frequency.value = 120;
    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 30;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 6;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    // amplitude wobble for a lumpy idle
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 22;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);

    base.connect(lp);
    harm.connect(lp);
    sub.connect(lp);
    lp.connect(gain).connect(this.master);
    base.start(now);
    harm.start(now);
    sub.start(now);
    lfo.start(now);
    this.engine = { base, harm, sub, lp, gain, lfo };
  }

  _buildRoadNoise() {
    // tire rumble (lowpassed noise)
    const tireSrc = this.ctx.createBufferSource();
    tireSrc.buffer = this._noiseBuf;
    tireSrc.loop = true;
    const tireLp = this.ctx.createBiquadFilter();
    tireLp.type = 'lowpass';
    tireLp.frequency.value = 520;
    const tireGain = this.ctx.createGain();
    tireGain.gain.value = 0;
    tireSrc.connect(tireLp).connect(tireGain).connect(this.master);
    tireSrc.start();
    this.tire = { gain: tireGain };

    // wind (highpassed noise)
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this._noiseBuf;
    windSrc.loop = true;
    const windHp = this.ctx.createBiquadFilter();
    windHp.type = 'highpass';
    windHp.frequency.value = 1600;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windHp).connect(windGain).connect(this.master);
    windSrc.start();
    this.wind = { gain: windGain };
  }

  // intensity: 0..1 (roughly speed). Simulates a 6-speed gearbox.
  setEngine(intensity) {
    if (!this.ctx || !this.enabled || !this.engine) return;
    const t = this.ctx.currentTime;
    const gears = 6;
    const span = 1 / gears;
    const gearPos = (intensity % span) / span; // 0..1 within the gear
    const rpm = 0.28 + gearPos * 0.72; // revs climb then reset on shift
    const f = 46 + rpm * 250;
    this.engine.base.frequency.setTargetAtTime(f, t, 0.04);
    this.engine.harm.frequency.setTargetAtTime(f * 2, t, 0.04);
    this.engine.sub.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engine.lp.frequency.setTargetAtTime(420 + rpm * 2400 + intensity * 800, t, 0.05);
    this.engine.gain.gain.setTargetAtTime(0.05 + intensity * 0.06, t, 0.1);

    this.tire.gain.gain.setTargetAtTime(intensity * 0.05, t, 0.15);
    this.wind.gain.gain.setTargetAtTime(Math.max(0, intensity - 0.3) * 0.07, t, 0.2);
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engine) this.engine.gain.gain.setTargetAtTime(0, t, 0.15);
    if (this.tire) this.tire.gain.gain.setTargetAtTime(0, t, 0.15);
    if (this.wind) this.wind.gain.gain.setTargetAtTime(0, t, 0.15);
  }

  _panned(vol) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let node = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      g.connect(p).connect(this.master);
      node = g;
      g._panner = p;
    } else {
      g.connect(this.master);
    }
    return g;
  }

  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.18, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this._panned(vol);
    if (g._panner) g._panner.pan.value = Math.max(-1, Math.min(1, pan));
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }

  coin(pan = 0) {
    this.blip(1180, 0.07, 'square', 0.16, pan);
    setTimeout(() => this.blip(1560, 0.08, 'square', 0.14, pan), 55);
  }

  nitro() {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(950, t + 0.4);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
  }

  startSiren() {
    if (!this.ctx || !this.enabled || this.siren) return;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 720;
    lfo.type = 'sine';
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.value = 0.04;
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      o.connect(g).connect(panner).connect(this.master);
    } else {
      o.connect(g).connect(this.master);
    }
    o.start();
    lfo.start();
    this.siren = { o, lfo, g, panner };
  }

  // pan: -1 (left) .. 1 (right); vol: 0..1 (distance-based)
  updateSiren(pan, vol) {
    if (!this.siren || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.siren.panner) this.siren.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
    this.siren.g.gain.setTargetAtTime(0.015 + vol * 0.06, t, 0.12);
  }

  stopSiren() {
    if (!this.siren) return;
    try {
      this.siren.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      this.siren.o.stop(this.ctx.currentTime + 0.3);
      this.siren.lfo.stop(this.ctx.currentTime + 0.3);
    } catch (_) {}
    this.siren = null;
  }

  crash() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    // impact noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuf || this._makeNoise(0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    noise.connect(lp).connect(g).connect(this.master);
    noise.start(t);
    noise.stop(t + 0.55);
    // metallic clang
    this.blip(180, 0.3, 'square', 0.2);
  }
}
