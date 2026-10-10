/**
 * paper.js
 * Efek suara "kertas dibalik" yang disintesis lewat Web Audio API.
 * Tidak ada berkas audio eksternal — semuanya dibuat runtime.
 */

export class PaperSound {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.enabled = true;
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch (_) {
      return null;
    }

    // 0.6 detik white noise, dipakai ulang untuk setiap sapuan.
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.buffer = buf;
    return this.ctx;
  }

  /** Panggil dari gesture pengguna pertama agar AudioContext boleh hidup. */
  unlock() {
    const ctx = this._ensure();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (on) this.unlock();
  }

  /**
   * Mainkan sapuan kertas.
   * @param {'next'|'prev'} dir
   * @param {number} [intensity] 0..1
   */
  play(dir = "next", intensity = 1) {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx || !this.buffer) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const t0 = ctx.currentTime + 0.01;
    const dur = 0.34 + 0.16 * Math.min(1, intensity);

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    const from = dir === "next" ? 480 : 1900;
    const to = dir === "next" ? 2600 : 620;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 260;

    const gain = ctx.createGain();
    const peak = 0.16 + 0.1 * Math.min(1, intensity);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bp).connect(hp).connect(gain).connect(ctx.destination);
    src.start(t0, Math.random() * 0.2);
    src.stop(t0 + dur + 0.05);
    src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch (_) { /* noop */ } };
  }

  /** Bunyi "buk" pelan saat sampul keras menutup. */
  thud() {
    if (!this.enabled) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(58, t0 + 0.16);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.25);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (_) { /* noop */ } };
  }
}
