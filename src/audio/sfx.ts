/**
 * M5 slice 3 — synthesized sound cues (WebAudio, no assets).
 *
 * Every cue is generated on the fly from oscillators + filtered noise, so the lab
 * ships zero audio files. The AudioContext is created lazily on the first cue,
 * which always rides on a user gesture (a click while wiring / entering the lab),
 * satisfying the browser autoplay policy. If WebAudio is unavailable — or the app
 * runs headless — every method is a silent no-op, so callers never need to guard.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume: number;
  private enabled: boolean;
  /** Set once {@link resume} runs from a user gesture; gates context creation. */
  private unlocked = false;

  constructor(volume = 0.5) {
    this.volume = volume;
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(next: boolean): void {
    this.enabled = next;
  }

  setVolume(next: number): void {
    this.volume = Math.max(0, Math.min(1, next));
    if (this.master) this.master.gain.value = this.volume;
  }

  /**
   * Call from a user gesture (e.g. the "Enter the lab" button) to unlock audio.
   * Until this runs, every cue is a silence no-op, so no AudioContext is ever
   * created before the browser allows it (which would log a console warning).
   */
  resume(): void {
    this.unlocked = true;
    if (!this.enabled) return;
    const ctx = this.context();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  }

  /** Banana plug pushed home: a bright click plus a low contact thunk. */
  plug(): void {
    if (!this.ready()) return;
    this.click(2200, 0.05, 0.5);
    this.tone(140, 0.09, "triangle", 0.28, 96);
  }

  /** Cord pulled off a terminal: a softer click only. */
  unplug(): void {
    if (!this.ready()) return;
    this.click(1600, 0.045, 0.32);
  }

  /** Relay / knife-switch clack as the circuit closes (or the figure swaps). */
  switch(): void {
    if (!this.ready()) return;
    this.click(1200, 0.06, 0.4);
    this.tone(90, 0.07, "square", 0.22, 60);
    this.tone(180, 0.05, "triangle", 0.12, 120);
  }

  /** Tiny meter blip when a reading settles on a new value. */
  tick(): void {
    if (!this.ready()) return;
    this.tone(1500, 0.02, "sine", 0.09, 1320);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Ensure there is a live context to play into (creating/resuming as needed). */
  private ready(): boolean {
    if (!this.enabled || !this.unlocked) return false;
    const ctx = this.context();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return true;
  }

  /** Short enveloped tone, optionally swept from `freq` down to `endFreq`. */
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    endFreq?: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Band-passed noise burst — the "click"/"clack" component of a mechanical cue. */
  private click(centerFreq: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = centerFreq;
    bp.Q.value = 6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(env).connect(master);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  /** A single cached white-noise buffer, reused by every {@link click}. */
  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}
