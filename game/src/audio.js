// Synthesised sound for SOLMAR — no audio files, everything is built
// with WebAudio oscillators and filtered noise, so the game stays fully
// offline. A master gain keeps the mix quiet; M toggles mute.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._sirenTimer = 0;
    this._sirenHigh = false;
    this._unlocked = false;
  }

  // Browsers only let audio start after a user gesture. Call this from
  // the first keypress / click; it is safe to call repeatedly.
  unlock() {
    if (this._unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      this._startSiren();
      this._unlocked = true;
    } catch {
      // No audio on this machine — the game plays fine without it.
      this.ctx = null;
    }
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Engine hum follows speed: quiet on foot, louder and higher in a car.
  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + 0.11 * speed01 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(
      50 + 130 * speed01,
      this.ctx.currentTime,
      0.1,
    );
  }

  // Two-tone police siren. Call every frame; it only sounds while the
  // wanted level is above zero and at least one cruiser is near.
  setSiren(active, dt) {
    if (!this.ctx || !this.sirenGain) return;
    if (!active) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this._sirenTimer += dt;
    if (this._sirenTimer > 0.42) {
      this._sirenTimer = 0;
      this._sirenHigh = !this._sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(
        this._sirenHigh ? 880 : 660,
        this.ctx.currentTime,
        0.02,
      );
    }
    this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.1);
  }

  // A short burst of filtered noise — punches, bumps and crashes.
  thud(strength = 1) {
    if (!this.ctx) return;
    const dur = 0.12;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5 * strength;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  // Two bright notes for picking up cash.
  cash() {
    if (!this.ctx) return;
    this._blip(880, 0.07, 0.12);
    window.setTimeout(() => this._blip(1318, 0.09, 0.14), 70);
  }

  // A small rising arpeggio for mission completion.
  fanfare() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this._blip(freq, 0.14, 0.16), i * 110);
    });
  }

  // A low two-note sting for getting busted or wasted.
  sting() {
    if (!this.ctx) return;
    this._blip(220, 0.3, 0.2);
    window.setTimeout(() => this._blip(165, 0.4, 0.2), 220);
  }

  // A short click for menus and job acceptance.
  click() {
    if (!this.ctx) return;
    this._blip(1200, 0.04, 0.08);
  }

  _blip(freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 0.35;
    }
    return this.muted;
  }
}
