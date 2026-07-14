/**
 * Tiny WebAudio SFX + engine synth — no audio files needed.
 * Must be resumed after a user gesture (handled on PLAY tap).
 */
export class AudioKit {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.siren = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      this.enabled = false;
      return;
    }
    this.ctx = new AC();

    // Continuous engine drone (frequency tracks speed)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    this.engineOsc.connect(lp).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEngine(intensity) {
    if (!this.ctx || !this.enabled) return;
    const f = 55 + intensity * 190;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.06 + intensity * 0.05, this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    if (this.engineGain && this.ctx)
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }

  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.18) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }

  coin() {
    this.blip(1180, 0.07, 'square', 0.16);
    setTimeout(() => this.blip(1560, 0.08, 'square', 0.14), 55);
  }

  nitro() {
    // rising turbo whoosh
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(this.ctx.destination);
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
    lfo.frequency.value = 2.2; // wail speed
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.value = 0.05;
    o.connect(g).connect(this.ctx.destination);
    o.start();
    lfo.start();
    this.siren = { o, lfo, g };
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
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.4;
    noise.connect(g).connect(this.ctx.destination);
    noise.start();
  }
}
