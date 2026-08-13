/**
 * Procedural Web Audio — no external assets.
 *
 * Call resume() from a user gesture (Start / Try Again) and await it
 * before playing the first SFX so autoplay policies don't drop audio.
 */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private muted = false;

  /** In-flight resume so concurrent callers share one unlock. */
  private unlocking: Promise<void> | null = null;

  private bgmPlaying = false;
  private bgmTimer: number | null = null;
  private bgmNextNote = 0;
  private bgmStep = 0;
  private bgmFadeTimer: number | null = null;
  /** Prevents overlapping async startBgm unlock races. */
  private bgmStarting: Promise<void> | null = null;

  /** Master peak when unmuted — SFX sit above BGM via bus gains. */
  private static readonly MASTER_GAIN = 0.55;
  private static readonly SFX_BUS = 0.85;
  /** Audible bed under punchy SFX (0.2 + tiny voice gains was effectively silent). */
  private static readonly BGM_BUS = 0.4;

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : AudioSystem.MASTER_GAIN;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = AudioSystem.SFX_BUS;
    this.sfx.connect(this.master);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0;
    this.bgmGain.connect(this.master);
  }

  /**
   * Create (if needed) and resume the AudioContext after a user gesture.
   * Resolves when the context is running so the first SFX is audible.
   */
  async resume(): Promise<void> {
    this.ensureContext();
    const ctx = this.ctx!;
    if (ctx.state === "running") return;

    if (!this.unlocking) {
      this.unlocking = (async () => {
        try {
          // Resume for suspended *and* interrupted — not only "suspended".
          if (ctx.state !== "running") {
            await ctx.resume();
          }
          // Silent buffer poke — unlocks stubborn Chromium / Safari paths.
          const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(ctx.destination);
          src.start(0);
        } catch (err) {
          console.warn("[audio] AudioContext resume failed", err);
        } finally {
          this.unlocking = null;
        }
      })();
    }
    // Capture locally — `this.unlocking` may already be cleared in finally by the time we await.
    const pending = this.unlocking;
    if (pending) await pending;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : AudioSystem.MASTER_GAIN;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Dark tense loop — low pulse + sparse minor melody.
   * Awaits AudioContext unlock so it never silently no-ops when ctx is still suspended.
   */
  async startBgm(): Promise<void> {
    if (this.bgmStarting) {
      await this.bgmStarting;
      return;
    }

    const starting = (async () => {
      try {
        await this.resume();
        this.ensureContext();
        if (!this.ctx || !this.bgmGain) return;
        if (this.ctx.state !== "running") {
          console.warn("[audio] BGM start skipped — AudioContext not running", this.ctx.state);
          return;
        }

        this.clearBgmFade();

        // Already looping: restore level + ensure scheduler is alive (fade/retry races).
        if (this.bgmPlaying) {
          this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.bgmGain.gain.setValueAtTime(AudioSystem.BGM_BUS, this.ctx.currentTime);
          if (this.bgmTimer == null) {
            this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 50);
            this.scheduleBgm();
          }
          return;
        }

        this.bgmPlaying = true;
        this.bgmStep = 0;
        this.bgmNextNote = this.ctx.currentTime + 0.05;
        this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.bgmGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.bgmGain.gain.linearRampToValueAtTime(AudioSystem.BGM_BUS, this.ctx.currentTime + 0.5);

        if (this.bgmTimer != null) {
          clearInterval(this.bgmTimer);
          this.bgmTimer = null;
        }
        // Look-ahead scheduler (~50ms tick, schedule ~200ms ahead).
        this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 50);
        this.scheduleBgm();

        console.info(
          "[audio] BGM started",
          this.muted ? "(muted — unmute with M / Settings)" : `(bus ${AudioSystem.BGM_BUS})`,
        );
      } finally {
        this.bgmStarting = null;
      }
    })();

    this.bgmStarting = starting;
    await starting;
  }

  /** Fade out and stop the BGM loop (menu / game over). */
  stopBgm(fadeSec = 0.8): void {
    if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;

    this.clearBgmFade();
    const t = this.ctx.currentTime;
    const cur = Math.max(this.bgmGain.gain.value, 0.0001);
    this.bgmGain.gain.cancelScheduledValues(t);
    this.bgmGain.gain.setValueAtTime(cur, t);
    this.bgmGain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);

    this.bgmFadeTimer = window.setTimeout(() => {
      this.haltBgm();
    }, fadeSec * 1000 + 40);
  }

  private haltBgm(): void {
    if (this.bgmTimer != null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.clearBgmFade();
    this.bgmPlaying = false;
    this.bgmStep = 0;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  private clearBgmFade(): void {
    if (this.bgmFadeTimer != null) {
      clearTimeout(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
  }

  /**
   * 16-step pattern @ ~92 BPM (step = 0.163s).
   * Pulse on even beats; sparse D-minor melody; occasional noise tick.
   */
  private scheduleBgm(): void {
    if (!this.ctx || !this.bgmGain || !this.bgmPlaying) return;
    if (this.ctx.state !== "running") return;

    const stepDur = 60 / 92 / 4; // sixteenth notes
    const lookAhead = 0.2;
    const now = this.ctx.currentTime;

    // Skip backlog after tab throttle / suspend so we never schedule deep in the past
    // (osc.stop in the past throws and can stall the interval callback).
    if (this.bgmNextNote < now - 0.05) {
      const behind = now - this.bgmNextNote;
      const skip = Math.floor(behind / stepDur) + 1;
      this.bgmStep += skip;
      this.bgmNextNote += skip * stepDur;
    }

    while (this.bgmNextNote < now + lookAhead) {
      const t = this.bgmNextNote;
      const step = this.bgmStep % 16;
      const bar = Math.floor(this.bgmStep / 16) % 4;

      // Pulse — audible on laptop speakers (was 36–48Hz sub-bass = silence).
      if (step % 4 === 0) {
        this.bgmPulse(t, step === 0 ? 110 : 92, step === 0 ? 0.32 : 0.22);
      } else if (step % 4 === 2) {
        this.bgmPulse(t, 82, 0.12);
      }

      // Sparse minor melody (D Aeolian-ish): D F A Bb C — mostly D3–A3 range
      const melody: (number | null)[] = [
        146.83, // D3
        null,
        null,
        174.61, // F3
        null,
        220.0, // A3
        null,
        null,
        233.08, // Bb3
        null,
        196.0, // G3
        null,
        174.61, // F3
        null,
        146.83, // D3
        bar === 3 ? 130.81 : null, // C3 — tension resolve every 4th bar
      ];
      const freq = melody[step];
      if (freq != null) {
        // Odd bars slightly darker, not a full octave into mud.
        this.bgmTone(t, freq * (bar % 2 === 1 ? 0.75 : 1), 0.14 + (step === 0 ? 0.05 : 0));
      }

      // Soft noise tick on offbeats — tab-click unease
      if (step === 3 || step === 11) {
        this.bgmTick(t, 0.06);
      }

      this.bgmStep++;
      this.bgmNextNote += stepDur;
    }
  }

  /** Schedule osc start/stop safely when t may be slightly in the past. */
  private startStop(node: AudioScheduledSourceNode, t: number, dur: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const start = Math.max(t, now);
    const stop = Math.max(start + 0.02, t + dur);
    try {
      node.start(start);
      node.stop(stop);
    } catch (err) {
      console.warn("[audio] BGM voice schedule failed", err);
    }
  }

  private bgmPulse(t: number, freq: number, gain: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, Math.max(t, this.ctx.currentTime));
    filt.type = "lowpass";
    filt.frequency.value = 420;
    const at = Math.max(t, this.ctx.currentTime);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.bgmGain);
    this.startStop(osc, t, 0.32);
  }

  private bgmTone(t: number, freq: number, gain: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const at = Math.max(t, this.ctx.currentTime);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.97, at + 0.35);
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1400, at);
    filt.frequency.exponentialRampToValueAtTime(500, at + 0.4);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.bgmGain);
    this.startStop(osc, t, 0.5);
  }

  private bgmTick(t: number, gain: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const dur = 0.04;
    const buffer = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * dur)), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 2400;
    filt.Q.value = 2;
    const g = this.ctx.createGain();
    const at = Math.max(t, this.ctx.currentTime);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.bgmGain);
    this.startStop(src, t, dur + 0.01);
  }

  // --- SFX -----------------------------------------------------------------

  /** Sharp UI tick — click through menus. */
  playUi(): void {
    this.noiseBurst(0.025, 0.22, 3200, 0.8);
    this.tone(880, 0.04, "square", 0.18, 0.03, 0, 1200);
    this.tone(1320, 0.03, "sine", 0.1, 0.025, 0.015);
  }

  /** Impact — filtered noise + downward pitch snap. */
  playHit(): void {
    this.noiseBurst(0.06, 0.45, 900, 0.6);
    this.sweep(220, 70, 0.12, "square", 0.32, 0.1);
    this.tone(55, 0.1, "sine", 0.28, 0.12);
  }

  /** Bright ascending chime for pickups. */
  playPickup(): void {
    this.tone(660, 0.05, "square", 0.22, 0.04, 0, 2800);
    this.tone(990, 0.06, "sine", 0.2, 0.05, 0.035);
    this.tone(1320, 0.08, "triangle", 0.16, 0.07, 0.07);
    this.noiseBurst(0.02, 0.12, 4000, 1.2, 0.02);
  }

  /** Low siren warning — Medusa approaching. */
  playMedusa(): void {
    this.sweep(90, 55, 0.45, "sawtooth", 0.38, 0.4);
    this.sweep(140, 70, 0.5, "sine", 0.28, 0.45, 0.08);
    this.noiseBurst(0.15, 0.2, 400, 0.4, 0.05);
  }

  /** Triumphant arpeggio — Perfect Return. */
  playPerfect(): void {
    this.tone(523.25, 0.1, "square", 0.28, 0.08, 0, 2000);
    this.tone(659.25, 0.1, "sine", 0.24, 0.09, 0.06);
    this.tone(783.99, 0.12, "triangle", 0.22, 0.12, 0.12);
    this.tone(1046.5, 0.16, "sine", 0.2, 0.18, 0.2);
    this.noiseBurst(0.04, 0.15, 5000, 1.5, 0.08);
  }

  /** Alarming growl — overstayed the tab. */
  playOverstay(): void {
    this.noiseBurst(0.12, 0.4, 500, 0.5);
    this.sweep(90, 40, 0.32, "sawtooth", 0.42, 0.28);
    this.sweep(60, 35, 0.38, "square", 0.3, 0.3, 0.06);
  }

  playForage(): void {
    this.tone(380, 0.07, "triangle", 0.18, 0.06, 0, 1800);
    this.noiseBurst(0.03, 0.1, 2200, 0.9);
  }

  /** Heavy downward collapse — death. */
  playDeath(): void {
    this.noiseBurst(0.25, 0.5, 600, 0.35);
    this.sweep(180, 35, 0.55, "sawtooth", 0.4, 0.5);
    this.sweep(90, 28, 0.65, "sine", 0.35, 0.55, 0.05);
    this.tone(40, 0.4, "sine", 0.3, 0.45, 0.1);
  }

  // --- primitives ----------------------------------------------------------

  private bus(): GainNode | null {
    return this.sfx;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    release: number,
    delay = 0,
    lowpass?: number,
  ): void {
    if (!this.ctx || !this.bus() || this.muted) return;
    if (this.ctx.state !== "running") return;

    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(gain, 0.55), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(release, 0.02));

    if (lowpass != null) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = lowpass;
      osc.connect(filt);
      filt.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.bus()!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private sweep(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    release: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.bus() || this.muted) return;
    if (this.ctx.state !== "running") return;

    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(2200, t);
    filt.frequency.exponentialRampToValueAtTime(400, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(gain, 0.55), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(release, 0.03));
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.bus()!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Short noise burst through a bandpass — punch / grit. */
  private noiseBurst(
    dur: number,
    gain: number,
    centerHz: number,
    q: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.bus() || this.muted) return;
    if (this.ctx.state !== "running") return;

    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.5);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = centerHz;
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(gain, 0.55), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.bus()!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
