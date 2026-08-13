import { formatTime } from "../utils/math";
import { DREAD } from "../config/balance";
import type { UpgradeDef } from "../config/balance";
import type { Settings } from "../systems/Settings";

export class Hud {
  private root = document.getElementById("hud")!;
  private hpFill = document.getElementById("hp-fill")!;
  private xpFill = document.getElementById("xp-fill")!;
  private hpText = document.getElementById("hp-text")!;
  private xpText = document.getElementById("xp-text")!;
  private meta = document.getElementById("hud-meta")!;
  private time = document.getElementById("hud-time")!;
  private kills = document.getElementById("hud-kills")!;
  private toastEl = document.getElementById("toast")!;
  private dreadPanel = document.getElementById("dread-panel")!;
  private dreadFill = document.getElementById("dread-fill")!;
  private dreadHint = document.getElementById("dread-hint")!;
  private debtMeter = document.getElementById("debt-meter")!;
  private debugEl = document.getElementById("debug-dread")!;
  private toastTimer = 0;
  private dreadHold = 0;
  private debug = false;

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.hideDread();
  }

  setDebug(on: boolean): void {
    this.debug = on;
    this.debugEl.classList.toggle("show", on);
  }

  update(opts: {
    hp: number;
    maxHp: number;
    xp: number;
    xpToLevel: number;
    level: number;
    shards: number;
    elapsed: number;
    kills: number;
    focusDebt?: number;
    dreadNow?: number;
  }): void {
    this.hpFill.style.transform = `scaleX(${Math.max(0, opts.hp / opts.maxHp)})`;
    this.xpFill.style.transform = `scaleX(${Math.max(0, opts.xp / opts.xpToLevel)})`;
    this.hpText.textContent = `${Math.max(0, Math.ceil(opts.hp))}/${Math.ceil(opts.maxHp)}`;
    this.xpText.textContent = `${Math.floor(opts.xp)}/${opts.xpToLevel}`;
    this.meta.textContent = `Lv ${opts.level} · Shards ${Math.floor(opts.shards)}`;
    this.time.textContent = formatTime(opts.elapsed);
    this.kills.textContent = `${opts.kills} kills`;

    const debt = opts.focusDebt ?? 0;
    if (debt > 0.4) {
      this.debtMeter.classList.add("show");
      this.debtMeter.textContent = `FOCUS DEBT ${Math.round(debt * 100)}%`;
    } else {
      this.debtMeter.classList.remove("show");
    }

    if (this.debug) {
      this.debugEl.textContent = `dread=${(opts.dreadNow ?? 0).toFixed(2)} debt=${debt.toFixed(2)} t=${opts.elapsed.toFixed(1)}`;
    }
  }

  toast(text: string, cls: "perfect" | "danger" | "warn", duration = 1.6): void {
    if (!text) return;
    this.toastEl.textContent = text;
    this.toastEl.className = `toast show ${cls}`;
    this.toastTimer = duration;
  }

  setDread(dread: number, visible: boolean, holdAfter = false): void {
    if (visible || holdAfter) {
      this.dreadPanel.classList.add("show");
      if (holdAfter) this.dreadHold = 2.4;
    } else if (this.dreadHold <= 0) {
      this.hideDread();
      return;
    }

    const d = Math.max(0, Math.min(1, dread));
    this.dreadFill.style.transform = `scaleX(${d})`;

    let hint = "foraging…";
    let cls = "";
    if (d >= 1) {
      hint = "OVERSTAY — Tab Stalker!";
      cls = "danger";
    } else if (d >= DREAD.perfectMin && d < DREAD.perfectMax) {
      hint = "PERFECT WINDOW — return NOW";
    } else if (d >= DREAD.perfectMax) {
      hint = "too late — leave or risk it";
      cls = "danger";
    } else if (d > 0.35) {
      hint = "wait for the teal zone…";
      cls = "warn";
    }
    this.dreadHint.textContent = hint;
    this.dreadHint.className = cls;
  }

  flashReturnDread(dread: number, kind: "safe" | "perfect" | "overstay"): void {
    this.setDread(dread, true, true);
    if (kind === "perfect") {
      this.dreadHint.textContent = "PERFECT RETURN";
      this.dreadHint.className = "";
    } else if (kind === "overstay") {
      this.dreadHint.textContent = "OVERSTAY";
      this.dreadHint.className = "danger";
    } else {
      this.dreadHint.textContent = "forage cashed in";
      this.dreadHint.className = "warn";
    }
  }

  hideDread(): void {
    this.dreadPanel.classList.remove("show");
    this.dreadHold = 0;
  }

  tick(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.className = "toast";
    }
    if (this.dreadHold > 0 && !document.hidden) {
      this.dreadHold -= dt;
      if (this.dreadHold <= 0) this.hideDread();
    }
  }
}

export class LevelUpModal {
  private root = document.getElementById("levelup")!;
  private choices = document.getElementById("upgrade-choices")!;
  private onPick: ((id: string) => void) | null = null;

  open(upgrades: UpgradeDef[], onPick: (id: string) => void): void {
    this.onPick = onPick;
    this.choices.innerHTML = "";
    for (const u of upgrades) {
      const btn = document.createElement("button");
      btn.className = `upgrade-btn rarity-${u.rarity}`;
      const cost = u.shardCost ? ` · ${u.shardCost} shards` : "";
      const tags = u.tags.map((t) => t).join(" · ");
      btn.innerHTML = `<strong><span class="icon">${u.icon}</span>${u.name}${cost}</strong><span>${u.desc}</span><span class="tags">${tags}</span>`;
      btn.addEventListener("click", () => {
        this.close();
        this.onPick?.(u.id);
      });
      this.choices.appendChild(btn);
    }
    this.root.classList.add("open");
  }

  close(): void {
    this.root.classList.remove("open");
  }

  isOpen(): boolean {
    return this.root.classList.contains("open");
  }
}

export class Tutorial {
  private el = document.getElementById("tutorial")!;
  private hideTimer = 0;

  reset(): void {
    this.el.classList.remove("show");
    this.hideTimer = 0;
    this.el.textContent = "";
  }

  set(text: string, hold = true): void {
    if (!text) {
      this.el.classList.remove("show");
      return;
    }
    this.el.textContent = text;
    this.el.classList.add("show");
    this.hideTimer = hold ? 0 : 5;
  }

  update(dt: number): void {
    if (this.hideTimer > 0) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) this.el.classList.remove("show");
    }
  }

  force(text: string, seconds = 3.5): void {
    this.el.textContent = text;
    this.el.classList.add("show");
    this.hideTimer = seconds;
  }
}

export type DeathCause = "contact" | "medusa" | "stalker" | "overstay" | "unknown";

export class Menus {
  private menu = document.getElementById("menu")!;
  private gameover = document.getElementById("gameover")!;
  private goStats = document.getElementById("go-stats")!;
  private goCause = document.getElementById("go-cause")!;
  private goDetail = document.getElementById("go-detail")!;
  private goFlavor = document.getElementById("go-flavor")!;
  private menuMeta = document.getElementById("menu-meta")!;
  private settings = document.getElementById("settings")!;
  private controls = document.getElementById("controls")!;
  private mobile = document.getElementById("mobile-block")!;

  showMenu(): void {
    this.menu.classList.add("open");
    this.gameover.classList.remove("open");
    this.menu.scrollTop = 0;
  }

  hideMenu(): void {
    this.menu.classList.remove("open");
  }

  setMenuMeta(text: string): void {
    this.menuMeta.textContent = text;
  }

  showGameOver(opts: {
    cause: DeathCause;
    causeLabel: string;
    summary: string;
    detail: string;
    flavor: string;
  }): void {
    this.goCause.textContent = opts.causeLabel;
    this.goStats.textContent = opts.summary;
    this.goDetail.innerHTML = opts.detail;
    this.goFlavor.textContent = `“${opts.flavor}”`;
    this.gameover.classList.add("open");
  }

  hideGameOver(): void {
    this.gameover.classList.remove("open");
  }

  openSettings(s: Settings): void {
    (document.getElementById("set-mute") as HTMLInputElement).checked = s.muted;
    (document.getElementById("set-motion") as HTMLInputElement).checked = s.reduceMotion;
    (document.getElementById("set-debug") as HTMLInputElement).checked = s.dreadDebug;
    this.settings.classList.add("open");
  }

  closeSettings(): void {
    this.settings.classList.remove("open");
  }

  isSettingsOpen(): boolean {
    return this.settings.classList.contains("open");
  }

  openControls(): void {
    this.controls.classList.add("open");
  }

  closeControls(): void {
    this.controls.classList.remove("open");
  }

  isControlsOpen(): boolean {
    return this.controls.classList.contains("open");
  }

  toggleControls(): void {
    if (this.isControlsOpen()) this.closeControls();
    else this.openControls();
  }

  showMobileBlock(): void {
    this.mobile.classList.add("open");
  }

  hideMobileBlock(): void {
    this.mobile.classList.remove("open");
  }
}

export function deathCauseLabel(cause: DeathCause): string {
  switch (cause) {
    case "medusa":
      return "Cause: Medusa Gaze — you were still looking";
    case "stalker":
      return "Cause: Tab Stalker — overstay caught up with you";
    case "overstay":
      return "Cause: Overstay shock — dread maxed out";
    case "contact":
      return "Cause: Swarm contact — the arena won";
    default:
      return "Cause: unknown";
  }
}

export function isMobileLike(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 700px)").matches
  );
}
