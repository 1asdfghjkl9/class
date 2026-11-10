// ============================================================
// core/audio.js — WebAudio 合成音效
// ============================================================

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
  }

  _ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.enabled = false;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _tone(freq, duration, type = 'sine', vol = 0.3, freqEnd = null) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * this.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  // 统一入口：战斗里用 audio.play('hit')
  play(name) {
    if (!name || name === 'play') return;
    const fn = this[name];
    if (typeof fn === 'function') {
      try { fn.call(this); } catch (err) { /* 音效失败不能影响游戏 */ }
    }
  }

  shoot()    { this._tone(180, 0.12, 'square', 0.15, 80); }
  hit()      { this._tone(220, 0.08, 'square', 0.2); }
  crit()     { this._tone(880, 0.15, 'triangle', 0.25, 1320); }
  superCrit(){ this._tone(440, 0.3, 'sawtooth', 0.3, 1760); setTimeout(() => this._tone(880, 0.2, 'square', 0.2, 2200), 80); }
  destroy()  { this._tone(120, 0.2, 'sawtooth', 0.2, 40); }
  button()   { this._tone(440, 0.05, 'sine', 0.1); }
  win()      { this._tone(523, 0.15, 'sine', 0.2); setTimeout(() => this._tone(659, 0.15, 'sine', 0.2), 150); setTimeout(() => this._tone(784, 0.3, 'sine', 0.2), 300); }
  lose()     { this._tone(330, 0.3, 'sine', 0.2, 110); }
  bossAtk()  { this._tone(150, 0.15, 'sawtooth', 0.2, 60); }
}
