import { MEDUSA } from "../config/balance";

export type MedusaPhase = "idle" | "windup";

export interface MedusaState {
  phase: MedusaPhase;
  /** performance.now() when gaze resolves; 0 if idle */
  resolveAt: number;
  nextAt: number;
  vignette: number;
  /** seconds remaining (for UI), derived */
  timer: number;
}

export class MedusaSystem {
  state: MedusaState = {
    phase: "idle",
    resolveAt: 0,
    nextAt: MEDUSA.firstAt,
    vignette: 0,
    timer: 0,
  };

  reset(firstAt: number = MEDUSA.firstAt): void {
    this.state = {
      phase: "idle",
      resolveAt: 0,
      nextAt: firstAt,
      vignette: 0,
      timer: 0,
    };
  }

  /** Schedule gaze to fire after `inSeconds` of combat time from now */
  scheduleIn(elapsedSec: number, inSeconds: number): void {
    if (this.state.phase === "windup") return;
    this.state.phase = "idle";
    this.state.nextAt = elapsedSec + inSeconds;
  }

  /**
   * Wall-clock Medusa — windup continues even while the game loop is paused.
   * Call every frame while visible AND from visibility dread ticks while hidden.
   */
  sync(
    elapsedSec: number,
    nowMs: number = performance.now(),
    opts?: { blockStart?: boolean },
  ): "look_away" | "resolve" | null {
    const s = this.state;

    if (s.phase === "windup") {
      s.timer = Math.max(0, (s.resolveAt - nowMs) / 1000);
      s.vignette = Math.min(1, 0.35 + (1 - s.timer / MEDUSA.windup) * 0.65);
      if (nowMs >= s.resolveAt) {
        s.phase = "idle";
        s.resolveAt = 0;
        s.timer = 0;
        s.nextAt = elapsedSec + MEDUSA.interval;
        return "resolve";
      }
      return null;
    }

    // idle
    s.vignette = Math.max(0, s.vignette - 0.016 * 1.5);
    if (!opts?.blockStart && elapsedSec >= s.nextAt) {
      s.phase = "windup";
      s.resolveAt = nowMs + MEDUSA.windup * 1000;
      s.timer = MEDUSA.windup;
      s.vignette = 0.35;
      return "look_away";
    }
    return null;
  }
}
