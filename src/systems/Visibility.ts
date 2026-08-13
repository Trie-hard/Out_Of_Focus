import { DREAD } from "../config/balance";
import { clamp } from "../utils/math";

export type ReturnKind = "safe" | "perfect" | "overstay";

export interface HideSession {
  hiddenAt: number;
  dread: number;
  bribeHp: number;
  bribeShards: number;
}

export interface VisibilityResult {
  deltaSec: number;
  dread: number;
  kind: ReturnKind;
  bribeHp: number;
  bribeShards: number;
}

export type VisibilityHandlers = {
  onHide: (session: HideSession) => void;
  onShow: (result: VisibilityResult) => void;
  onDreadTick: (dread: number, session: HideSession) => void;
};

/**
 * Page Visibility API — no expensive background sim.
 * Dread is derived from wall-clock timestamps on return.
 */
export class VisibilitySystem {
  private hiddenAt: number | null = null;
  private tickId: number | null = null;
  private handlers: VisibilityHandlers;
  private enabled = false;
  private session: HideSession | null = null;

  constructor(handlers: VisibilityHandlers) {
    this.handlers = handlers;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  disable(): void {
    this.enabled = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearTick();
    this.hiddenAt = null;
    this.session = null;
  }

  isHidden(): boolean {
    return document.hidden;
  }

  getDreadNow(): number {
    if (this.hiddenAt == null) return 0;
    return clamp((performance.now() - this.hiddenAt) / 1000 / DREAD.maxSeconds, 0, 1);
  }

  private onVisibility = (): void => {
    if (!this.enabled) return;
    if (document.hidden) {
      this.beginHide();
    } else {
      this.endHide();
    }
  };

  private beginHide(): void {
    if (this.hiddenAt != null) return;
    this.hiddenAt = performance.now();
    this.session = {
      hiddenAt: this.hiddenAt,
      dread: 0,
      bribeHp: 0,
      bribeShards: 0,
    };
    this.handlers.onHide(this.session);
    this.clearTick();
    this.tickId = window.setInterval(() => {
      if (!this.session || this.hiddenAt == null) return;
      const elapsed = (performance.now() - this.hiddenAt) / 1000;
      this.session.dread = clamp(elapsed / DREAD.maxSeconds, 0, 1);
      this.session.bribeHp = elapsed * DREAD.bribeHpPerSecond;
      this.session.bribeShards = elapsed * DREAD.bribeShardsPerSecond;
      this.handlers.onDreadTick(this.session.dread, this.session);
    }, Math.min(DREAD.faviconTickMs, DREAD.titleTickMs));
  }

  private endHide(): void {
    if (this.hiddenAt == null) return;
    const now = performance.now();
    const deltaSec = (now - this.hiddenAt) / 1000;
    const dread = clamp(deltaSec / DREAD.maxSeconds, 0, 1);
    const bribeHp = deltaSec * DREAD.bribeHpPerSecond;
    const bribeShards = deltaSec * DREAD.bribeShardsPerSecond;

    let kind: ReturnKind = "safe";
    if (dread >= 1) kind = "overstay";
    else if (dread >= DREAD.perfectMin && dread < DREAD.perfectMax) kind = "perfect";

    this.clearTick();
    this.hiddenAt = null;
    this.session = null;

    this.handlers.onShow({ deltaSec, dread, kind, bribeHp, bribeShards });
  }

  private clearTick(): void {
    if (this.tickId != null) {
      clearInterval(this.tickId);
      this.tickId = null;
    }
  }
}
