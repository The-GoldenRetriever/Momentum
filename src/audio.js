// audio.js — tiny WebAudio synth. No samples, everything is oscillators + noise.

class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.master = null; }

  #wake() {
    if (!this.ctx) {
      if (typeof window === 'undefined') return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }

  tone({ freq = 440, to = freq, dur = 0.12, type = 'square', gain = 0.5, delay = 0 }) {
    const ctx = this.#wake();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, gain = 0.4, from = 3000, to = 300 }) {
    const ctx = this.#wake();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(from, t);
    filt.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
  }

  jump()    { this.tone({ freq: 340, to: 660, dur: 0.1, gain: 0.35 }); }
  wallJump(){ this.tone({ freq: 260, to: 560, dur: 0.11, type: 'sawtooth', gain: 0.3 }); }
  dash()    { this.noise({ dur: 0.22, from: 5200, to: 400, gain: 0.35 });
              this.tone({ freq: 880, to: 220, dur: 0.16, type: 'sawtooth', gain: 0.18 }); }
  land()    { this.noise({ dur: 0.09, from: 900, to: 120, gain: 0.28 }); }
  step()    { this.noise({ dur: 0.04, from: 2200, to: 800, gain: 0.08 }); }
  ledge()   { this.tone({ freq: 720, to: 980, dur: 0.06, type: 'triangle', gain: 0.16 }); }
  vault()   { this.noise({ dur: 0.12, from: 1600, to: 400, gain: 0.2 });
              this.tone({ freq: 520, to: 880, dur: 0.12, type: 'triangle', gain: 0.22 }); }
  cue()     { this.tone({ freq: 1180, dur: 0.05, type: 'triangle', gain: 0.1 }); }
  // the world dropping away, just before the burst proper
  burstWind() { this.tone({ freq: 1040, to: 300, dur: 0.1, type: 'triangle', gain: 0.16 });
                this.noise({ dur: 0.12, from: 600, to: 2600, gain: 0.1 }); }
  burst()   { this.noise({ dur: 0.5, from: 7000, to: 200, gain: 0.3 });
              this.tone({ freq: 180, to: 1400, dur: 0.35, type: 'sawtooth', gain: 0.24 });
              this.tone({ freq: 90, to: 60, dur: 0.9, type: 'triangle', gain: 0.2 }); }
  slide()   { this.noise({ dur: 0.3, from: 1800, to: 600, gain: 0.16 }); }
  skid()    { this.noise({ dur: 0.09, from: 3400, to: 1400, gain: 0.1 }); }
  spring()  { this.tone({ freq: 300, to: 1100, dur: 0.18, type: 'triangle', gain: 0.4 }); }
  crystal() { this.tone({ freq: 880, dur: 0.07, type: 'triangle', gain: 0.3 });
              this.tone({ freq: 1320, dur: 0.09, type: 'triangle', gain: 0.25, delay: 0.06 }); }
  death()   { this.tone({ freq: 420, to: 60, dur: 0.4, type: 'sawtooth', gain: 0.35 }); }
  checkpoint() { this.tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.25 });
                 this.tone({ freq: 990, dur: 0.14, type: 'triangle', gain: 0.22, delay: 0.07 }); }
  goal()    { [523, 659, 784, 1046].forEach((f, i) =>
                this.tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.28, delay: i * 0.09 })); }
}

export const sfx = new Sfx();
