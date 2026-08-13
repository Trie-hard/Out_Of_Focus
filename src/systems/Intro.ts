/**
 * Forced first-run lesson: forage → Medusa → Perfect Return.
 * Soft tips only after introComplete in meta.
 */

export type IntroPhase =
  | "move"
  | "forage"
  | "medusa_wait"
  | "medusa"
  | "perfect"
  | "done";

export class IntroDirector {
  phase: IntroPhase = "move";
  enabled = true;
  private prompt = "";

  start(skip: boolean): void {
    if (skip) {
      this.phase = "done";
      this.enabled = false;
      this.prompt = "";
      return;
    }
    this.enabled = true;
    this.phase = "move";
    this.prompt = "WASD to move — weapons fire on their own.";
  }

  /** Called each combat frame with elapsed seconds */
  update(elapsed: number): string {
    if (!this.enabled || this.phase === "done") return "";

    if (this.phase === "move" && elapsed >= 4) {
      this.phase = "forage";
      this.prompt =
        "INTRO 1/3 — Ctrl+Tab or click another tab for ~1s, then return. Forage heals you.";
    }

    if (this.phase === "forage") {
      this.prompt =
        "INTRO 1/3 — Leave this tab (~1 second), then come back to forage HP & shards.";
    }

    if (this.phase === "medusa_wait") {
      this.prompt = "INTRO 2/3 — Get ready. A Medusa Gaze is coming…";
    }

    if (this.phase === "medusa") {
      this.prompt = "INTRO 2/3 — LOOK AWAY! Ctrl+Tab (or click another tab) before the gaze hits.";
    }

    if (this.phase === "perfect") {
      this.prompt =
        "INTRO 3/3 — Leave the tab. Watch the DREAD bar — return in the TEAL zone for a Perfect Return.";
    }

    return this.prompt;
  }

  onForageReturn(deltaSec: number): boolean {
    if (this.phase !== "forage") return false;
    if (deltaSec < 0.55) {
      this.prompt = "Stay away a bit longer (~1s), then return.";
      return false;
    }
    this.phase = "medusa_wait";
    this.prompt = "Good. INTRO 2/3 — Medusa Gaze incoming. Be ready to look away.";
    return true;
  }

  onMedusaStart(): void {
    if (this.phase === "medusa_wait" || this.phase === "forage") {
      this.phase = "medusa";
    }
  }

  onMedusaResolve(survived: boolean): void {
    if (this.phase !== "medusa" && this.phase !== "medusa_wait") return;
    this.phase = "perfect";
    this.prompt = survived
      ? "Gaze averted! INTRO 3/3 — Now land a Perfect Return (teal dread window)."
      : "Ouch. INTRO 3/3 — Recover with a Perfect Return: leave, return in the TEAL dread zone.";
  }

  onPerfectReturn(): boolean {
    if (this.phase !== "perfect") return false;
    this.phase = "done";
    this.enabled = false;
    this.prompt = "Intro complete. The squeeze begins — use the tab to survive.";
    return true;
  }

  blocksNaturalMedusa(): boolean {
    return this.enabled && (this.phase === "move" || this.phase === "forage");
  }

  isDone(): boolean {
    return this.phase === "done" || !this.enabled;
  }
}
