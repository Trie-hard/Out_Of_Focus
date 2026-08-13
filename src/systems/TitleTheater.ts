import { DREAD } from "../config/balance";
import { cornerLabel, randomCorner, type Corner } from "./SafeZone";

const WHISPERS = [
  "still there?",
  "getting closer…",
  "don't look back",
  "we see you",
  "tab is hungry",
  "…",
  "stay away a little longer",
  "focus fading",
];

const PERFECT_HINTS = [
  "NOW — return!",
  "perfect window",
  "come back!",
  "PARRY WINDOW",
];

const OVERSTAY = [
  "TOO LATE",
  "IT FOUND YOU",
  "TAB STALKER INBOUND",
];

const ANGRY = [
  "IT REMEMBERS",
  "AGAIN?!",
  "NO ESCAPE",
  "THE TAB HATES YOU",
];

/**
 * Cycles document.title while hidden.
 * Periodically emits a TRUE safe-zone tip that Game can honor.
 */
export class TitleTheater {
  private idx = 0;
  private lastStage = "";
  private baseTitle = "Out of Focus";
  private medusaLock: string | null = null;
  private anger = 0;
  /** True tip pending for the player */
  pendingSafe: Corner | null = null;
  private tipsSinceTrue = 0;

  setAnger(n: number): void {
    this.anger = n;
  }

  setBase(title: string): void {
    this.baseTitle = title;
    if (!document.hidden && !this.medusaLock) {
      document.title = title;
    }
  }

  flashMedusa(text = "LOOK AWAY"): void {
    this.medusaLock = text;
    document.title = text;
  }

  clearMedusa(): void {
    this.medusaLock = null;
    if (!document.hidden) document.title = this.baseTitle;
  }

  consumeSafeTip(): Corner | null {
    const c = this.pendingSafe;
    this.pendingSafe = null;
    return c;
  }

  updateDread(dread: number): void {
    if (this.medusaLock) {
      document.title = this.medusaLock;
      return;
    }

    let stage: string;
    if (dread >= 1) {
      const pool = this.anger >= 2 ? ANGRY : OVERSTAY;
      stage = pool[this.idx % pool.length]!;
    } else if (dread >= DREAD.perfectMin && dread < DREAD.perfectMax) {
      stage = PERFECT_HINTS[this.idx % PERFECT_HINTS.length]!;
    } else if (dread > 0.3 && this.idx % 4 === 0) {
      this.tipsSinceTrue++;
      // Every 3rd safe-looking tip is TRUE
      if (this.tipsSinceTrue >= 3 || Math.random() < 0.35) {
        this.tipsSinceTrue = 0;
        const c = randomCorner();
        this.pendingSafe = c;
        stage = `safe zone: ${cornerLabel(c)} ✓`;
      } else {
        // Fake tip — different random corner, not pending
        stage = `safe zone: ${cornerLabel(randomCorner())}?`;
      }
    } else if (this.anger >= 2 && this.idx % 3 === 0) {
      stage = ANGRY[this.idx % ANGRY.length]!;
    } else {
      stage = WHISPERS[this.idx % WHISPERS.length]!;
    }

    if (stage !== this.lastStage) {
      document.title = stage;
      this.lastStage = stage;
    }
    this.idx++;
  }

  reset(): void {
    this.idx = 0;
    this.lastStage = "";
    this.medusaLock = null;
    this.pendingSafe = null;
    this.tipsSinceTrue = 0;
    document.title = this.baseTitle;
  }
}
