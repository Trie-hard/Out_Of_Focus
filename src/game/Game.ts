import { ARENA, FOCUS_DEBT, JUICE, MEDUSA } from "../config/balance";
import type { UpgradeId } from "../config/balance";
import { createPlayer, type Player } from "../entities/Player";
import { BossDirector, CombatSystem, SpawnerSystem } from "../systems/Combat";
import { ProgressionSystem } from "../systems/Progression";
import { VisibilitySystem, type VisibilityResult } from "../systems/Visibility";
import { FaviconSystem } from "../systems/Favicon";
import { TitleTheater } from "../systems/TitleTheater";
import { MedusaSystem } from "../systems/Medusa";
import { ConsequencesSystem } from "../systems/Consequences";
import { JuiceSystem } from "../systems/Juice";
import { AudioSystem } from "../systems/Audio";
import { IntroDirector } from "../systems/Intro";
import { loadSettings, saveSettings, type Settings } from "../systems/Settings";
import { densestLook, inCorner, type Corner } from "../systems/SafeZone";
import {
  loadMeta,
  saveMeta,
  unlockFlavor,
  pickFlavor,
  type MetaSave,
} from "../systems/Meta";
import {
  Hud,
  LevelUpModal,
  Tutorial,
  Menus,
  deathCauseLabel,
  isMobileLike,
  type DeathCause,
} from "../ui/Hud";
import { Renderer } from "./Renderer";
import { clamp, formatTime } from "../utils/math";

export type GameState = "menu" | "playing" | "levelup" | "gameover";

export class Game {
  private renderer: Renderer;
  private player!: Player;
  private combat = new CombatSystem();
  private spawner = new SpawnerSystem();
  private bossDir = new BossDirector();
  private progression = new ProgressionSystem();
  private favicon = new FaviconSystem();
  private titles = new TitleTheater();
  private medusa = new MedusaSystem();
  private consequences = new ConsequencesSystem();
  private juice = new JuiceSystem();
  private audio = new AudioSystem();
  private intro = new IntroDirector();
  private hud = new Hud();
  private levelUp = new LevelUpModal();
  private tutorial = new Tutorial();
  private menus = new Menus();
  private meta: MetaSave = loadMeta();
  private settings: Settings = loadSettings();

  private visibility: VisibilitySystem;
  private keys = new Set<string>();
  private state: GameState = "menu";
  private elapsed = 0;
  private kills = 0;
  private perfectReturns = 0;
  private shardsEarnedRun = 0;
  private lastTs = 0;
  private loopRunning = false;
  private hideStartedAt: number | null = null;
  private deathCause: DeathCause = "unknown";
  private medusaAvertedRun = false;
  private overstayCount = 0;
  private focusDebtTime = 0;
  private activeSafe: Corner | null = null;
  private safeTimer = 0;
  private mobileDismissed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    this.applySettings();

    this.visibility = new VisibilitySystem({
      onHide: () => {
        this.hideStartedAt = performance.now();
        this.titles.updateDread(0);
        this.hud.setDread(0, true);
        this.focusDebtTime = 0;
      },
      onShow: (result) => this.onFocusReturn(result),
      onDreadTick: (dread, _session) => {
        const look = densestLook(this.combat.enemies);
        this.favicon.setLook(look.x, look.y);
        this.favicon.setAnger(this.overstayCount);
        this.favicon.setDread(dread);
        this.titles.updateDread(dread);
        this.hud.setDread(dread, true);
        this.juice.setEdgePulse(dread);
        // Sirens shatter while hidden
        const shattered = this.combat.tickSirensWhileHidden(0.3);
        if (shattered > 0) {
          this.kills += shattered;
          this.juice.registerKills(shattered);
        }
        this.pollMedusa();
      },
    });

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", () => this.renderer.resize());

    document.getElementById("btn-start")!.addEventListener("click", () => {
      void this.beginFromUserGesture();
    });
    document.getElementById("btn-start-footer")!.addEventListener("click", () => {
      void this.beginFromUserGesture();
    });
    document.getElementById("btn-scroll-guide")!.addEventListener("click", () => {
      document.getElementById("how-to-play")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("btn-restart")!.addEventListener("click", () => {
      void this.beginFromUserGesture();
    });
    document.getElementById("btn-exit-menu")!.addEventListener("click", () => {
      void this.audio.resume().then(() => this.audio.playUi());
      this.returnToMenu();
    });
    document.getElementById("btn-settings")!.addEventListener("click", () => {
      this.menus.openSettings(this.settings);
    });
    document.getElementById("btn-settings-close")!.addEventListener("click", () => {
      this.readSettingsFromDom();
      this.menus.closeSettings();
    });
    document.getElementById("btn-controls")!.addEventListener("click", () => {
      this.menus.openControls();
    });
    document.getElementById("btn-controls-close")!.addEventListener("click", () => {
      this.menus.closeControls();
    });
    document.getElementById("btn-mobile-dismiss")!.addEventListener("click", () => {
      this.mobileDismissed = true;
      this.menus.hideMobileBlock();
    });

    for (const id of ["set-mute", "set-motion", "set-debug"]) {
      document.getElementById(id)!.addEventListener("change", () => this.readSettingsFromDom());
    }

    if (isMobileLike() && !this.mobileDismissed) {
      this.menus.showMobileBlock();
    }

    this.refreshMenuMeta();
    this.menus.showMenu();
    this.drawFrame(true);
  }

  private applySettings(): void {
    JUICE.reduceMotion = this.settings.reduceMotion;
    this.audio.setMuted(this.settings.muted);
    this.hud.setDebug(this.settings.dreadDebug);
  }

  private readSettingsFromDom(): void {
    this.settings.muted = (document.getElementById("set-mute") as HTMLInputElement).checked;
    this.settings.reduceMotion = (document.getElementById("set-motion") as HTMLInputElement).checked;
    this.settings.dreadDebug = (document.getElementById("set-debug") as HTMLInputElement).checked;
    saveSettings(this.settings);
    this.applySettings();
  }

  private refreshMenuMeta(): void {
    const m = this.meta;
    const best = m.bestTime > 0 ? formatTime(m.bestTime) : "—";
    this.menus.setMenuMeta(
      `Best ${best} · ${m.totalPerfects} perfects lifetime · ${m.totalRuns} runs`,
    );
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === "KeyM") {
      this.settings.muted = !this.settings.muted;
      saveSettings(this.settings);
      this.applySettings();
      this.hud.toast(this.settings.muted ? "Muted" : "Unmuted", "warn", 1);
    }
    if (e.code === "Escape" && this.state === "gameover") {
      this.returnToMenu();
      return;
    }
    if (e.code === "KeyH" || e.code === "Escape") {
      if (this.menus.isSettingsOpen()) {
        this.readSettingsFromDom();
        this.menus.closeSettings();
      } else {
        this.menus.toggleControls();
      }
    }
    if (e.code === "KeyR" && this.state === "gameover") void this.beginFromUserGesture();
  };

  /** Unlock AudioContext on the user gesture, then start (first SFX stays audible). */
  private async beginFromUserGesture(): Promise<void> {
    await this.audio.resume();
    this.audio.playUi();
    this.startRun();
    // Await after unlock — startBgm self-resumes; startRun also best-effort starts it.
    await this.audio.startBgm();
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  startRun(): void {
    if (isMobileLike() && !this.mobileDismissed) {
      this.menus.showMobileBlock();
      return;
    }

    this.menus.hideMenu();
    this.menus.hideGameOver();
    this.menus.closeControls();
    this.menus.closeSettings();
    this.levelUp.close();
    this.hud.show();

    this.player = createPlayer(ARENA.width / 2, ARENA.height / 2);
    this.combat.clear();
    this.spawner.reset();
    this.bossDir.reset();
    this.progression.reset();
    this.juice.clear();
    this.favicon.reset();
    this.titles.reset();
    this.titles.setAnger(0);
    this.tutorial.reset();

    const skipIntro = this.meta.introComplete;
    this.intro.start(skipIntro);
    this.medusa.reset(skipIntro ? MEDUSA.firstAt : 9999);

    this.elapsed = 0;
    this.kills = 0;
    this.perfectReturns = 0;
    this.shardsEarnedRun = 0;
    this.hideStartedAt = null;
    this.deathCause = "unknown";
    this.medusaAvertedRun = false;
    this.overstayCount = 0;
    this.focusDebtTime = 0;
    this.activeSafe = null;
    this.safeTimer = 0;
    this.state = "playing";

    this.visibility.enable();
    this.titles.setBase("Out of Focus");
    // Best-effort if startRun is reached without beginFromUserGesture (startBgm self-resumes).
    void this.audio.startBgm();
    this.ensureLoop();

    if (!skipIntro) this.tutorial.set(this.intro.update(0));
    else this.tutorial.force("WASD · Ctrl+Tab / click a tab to forage · H help · M mute", 4);
  }

  private combatElapsedSec(): number {
    return this.elapsed;
  }

  private focusDebtRatio(): number {
    return clamp(
      (this.focusDebtTime - FOCUS_DEBT.warnAt) / (FOCUS_DEBT.punishAt - FOCUS_DEBT.warnAt),
      0,
      1,
    );
  }

  private ensureLoop(): void {
    if (this.loopRunning) return;
    this.loopRunning = true;
    this.lastTs = performance.now();
    const frame = (ts: number) => {
      requestAnimationFrame(frame);
      const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      const hidden = document.hidden;

      if (this.state === "playing" && !hidden) this.update(rawDt);

      this.hud.tick(rawDt);
      this.tutorial.update(rawDt);
      this.drawFrame(hidden && this.state === "playing");
    };
    requestAnimationFrame(frame);
  }

  private update(dt: number): void {
    this.elapsed += dt;

    const tip = this.intro.update(this.elapsed);
    if (this.intro.enabled && tip) this.tutorial.set(tip);

    // Focus debt while continuously focused
    this.focusDebtTime += dt;
    const debt = this.focusDebtRatio();
    this.juice.focusDebtPulse = debt;
    if (this.focusDebtTime >= FOCUS_DEBT.punishAt) {
      this.player.stats.hp -= this.player.stats.maxHp * FOCUS_DEBT.drainPerSecond * dt;
      this.deathCause = "contact";
    }

    let mx = 0;
    let my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;

    const speedMul = this.focusDebtTime >= FOCUS_DEBT.punishAt ? FOCUS_DEBT.speedPenalty : 1;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      this.player.x += (mx / len) * this.player.stats.speed * speedMul * dt;
      this.player.y += (my / len) * this.player.stats.speed * speedMul * dt;
    }
    this.player.x = clamp(this.player.x, this.player.radius, ARENA.width - this.player.radius);
    this.player.y = clamp(this.player.y, this.player.radius, ARENA.height - this.player.radius);

    if (this.player.flash > 0) this.player.flash -= dt;

    // Safe zone cash-in
    if (this.activeSafe && this.safeTimer > 0) {
      this.safeTimer -= dt;
      if (inCorner(this.player.x, this.player.y, this.activeSafe)) {
        const cleared = this.combat.clearCorner(this.activeSafe);
        if (cleared > 0) {
          this.kills += cleared;
          this.juice.registerKills(cleared);
          this.juice.addShockwave(this.player.x, this.player.y, 180);
          this.hud.toast(`Safe zone clear · ${cleared}`, "perfect");
          this.audio.playPerfect();
        }
        this.activeSafe = null;
        this.safeTimer = 0;
      } else if (this.safeTimer <= 0) {
        this.activeSafe = null;
      }
    }

    const fireMul = this.focusDebtTime >= FOCUS_DEBT.punishAt ? FOCUS_DEBT.fireRatePenalty : 1;
    this.player.fireTimer -= dt;
    if (this.player.fireTimer <= 0) {
      this.combat.fire(this.player);
      this.player.fireTimer = this.player.stats.fireCooldown * fireMul;
    }

    this.spawner.update(dt, this.combat, this.elapsed);
    if (this.bossDir.update(this.elapsed, this.combat)) {
      this.hud.toast("BOSS-LITE — Medusa pressure incoming", "danger", 2.5);
      this.audio.playMedusa();
      this.medusa.scheduleIn(this.elapsed, 2.2);
      this.juice.vignette = 0.6;
    }

    this.combat.updateEnemies(dt, this.player);
    const { kills, positions } = this.combat.updateProjectiles(dt, !document.hidden);
    if (kills) {
      this.kills += kills;
      this.juice.registerKills(kills);
      for (const pos of positions) this.juice.burst(pos.x, pos.y, pos.color, 6);
    }
    this.combat.updateFloats(dt);

    const xp = this.combat.updateGems(dt, this.player);
    if (xp) {
      this.audio.playPickup();
      if (this.progression.addXp(xp)) {
        this.openLevelUp();
        return;
      }
    }

    const contact = this.combat.resolvePlayerContact(this.player, dt);
    if (contact.damage > 0) {
      this.player.stats.hp -= contact.damage;
      this.juice.addShake(4);
      this.juice.hitFlash = 0.25;
      this.audio.playHit();
      this.deathCause = contact.fromStalker ? "stalker" : "contact";
    }

    this.pollMedusa();
    this.juice.update(dt);
    this.syncHud();

    if (this.player.stats.hp <= 0) this.die();
  }

  private openLevelUp(): void {
    this.state = "levelup";
    this.audio.playUi();
    const choices = this.progression.rollChoices();
    this.levelUp.open(choices, (id) => {
      this.progression.apply(id as UpgradeId, this.player);
      this.audio.playUi();
      if (this.progression.pendingLevelUps > 0) this.openLevelUp();
      else this.state = "playing";
    });
  }

  private pollMedusa(): void {
    if (this.state !== "playing" && this.state !== "levelup") return;
    const evt = this.medusa.sync(this.combatElapsedSec(), performance.now(), {
      blockStart: this.intro.blocksNaturalMedusa(),
    });
    if (evt === "look_away") {
      this.intro.onMedusaStart();
      this.titles.flashMedusa("LOOK AWAY");
      this.juice.vignette = 0.5;
      this.hud.toast("LOOK AWAY — Ctrl+Tab!", "danger", 2.2);
      this.audio.playMedusa();
      if (this.intro.enabled) this.tutorial.set(this.intro.update(this.elapsed));
      else this.tutorial.force("Medusa Gaze! Leave this tab before the timer hits zero.", 4);
    } else if (evt === "resolve") {
      this.titles.clearMedusa();
      this.applyMedusa(document.hidden);
    } else if (this.medusa.state.phase === "windup" && !document.hidden) {
      this.titles.flashMedusa("LOOK AWAY");
    }
  }

  private onFocusReturn(result: VisibilityResult): void {
    if (this.state !== "playing" && this.state !== "levelup") {
      this.hideStartedAt = null;
      this.favicon.reset();
      this.titles.reset();
      this.hud.hideDread();
      return;
    }

    const hadHide = this.hideStartedAt != null;
    this.pollMedusa();
    if (hadHide) this.hideStartedAt = null;
    this.focusDebtTime = 0;

    if (this.medusa.state.phase === "windup") this.titles.flashMedusa("LOOK AWAY");
    else this.titles.clearMedusa();

    // True safe-zone tip from title theater
    const tip = this.titles.consumeSafeTip();
    if (tip && result.deltaSec > 0.4) {
      this.activeSafe = tip;
      this.safeTimer = 5;
      this.hud.toast(`Safe tip live — reach ${tip.toUpperCase()} corner`, "warn", 2.5);
    }

    const shardsBefore = this.progression.shards;
    const evolved = this.overstayCount >= 1;
    const fb = this.consequences.applyReturn(
      result,
      this.player,
      this.combat,
      this.progression,
      { evolvedStalker: evolved },
    );
    this.shardsEarnedRun += Math.max(0, this.progression.shards - shardsBefore);
    this.hud.flashReturnDread(result.dread, result.kind);
    this.juice.setEdgePulse(0);

    if (result.kind === "perfect") {
      this.perfectReturns++;
      this.audio.playPerfect();
      this.juice.registerKills(Math.max(1, fb.kills));
      if (this.intro.onPerfectReturn()) {
        this.meta.introComplete = true;
        unlockFlavor(this.meta, "intro");
        saveMeta(this.meta);
        this.tutorial.force("Intro complete. Use the tab to survive the squeeze.", 5);
      }
    } else if (result.kind === "overstay") {
      this.overstayCount++;
      this.titles.setAnger(this.overstayCount);
      this.favicon.setAnger(this.overstayCount);
      this.audio.playOverstay();
      unlockFlavor(this.meta, "overstay");
      if (this.player.stats.hp <= 0) this.deathCause = "overstay";
    } else if (result.deltaSec > 0.35) {
      this.audio.playForage();
    }

    if (this.intro.onForageReturn(result.deltaSec)) {
      this.medusa.scheduleIn(this.elapsed, 3.5);
      this.tutorial.set(this.intro.update(this.elapsed));
      this.hud.toast("Medusa incoming — get ready", "warn", 2);
    }

    if (fb.toast) this.hud.toast(fb.toast, fb.toastClass);
    if (fb.shake) this.juice.addShake(fb.shake);
    if (fb.shockwave) {
      this.juice.addShockwave(fb.shockwave.x, fb.shockwave.y, fb.shockwave.radius);
      this.juice.burst(fb.shockwave.x, fb.shockwave.y, "#5eead4", 24);
    }
    if (fb.kills) this.kills += fb.kills;

    this.favicon.reset();
    this.favicon.setAnger(this.overstayCount);
    if (this.medusa.state.phase !== "windup") this.titles.setBase("Out of Focus");

    this.syncHud();
    if (this.player.stats.hp <= 0) this.die();
  }

  private applyMedusa(wasHidden: boolean): void {
    const safe = wasHidden || this.hideStartedAt != null;
    const fb = this.consequences.applyMedusaResolve(this.player, safe);
    if (!fb) return;

    this.intro.onMedusaResolve(safe);
    if (this.intro.enabled) this.tutorial.set(this.intro.update(this.elapsed));

    if (safe) {
      this.medusaAvertedRun = true;
      unlockFlavor(this.meta, "first_medusa");
      this.audio.playForage();
    } else {
      this.deathCause = "medusa";
      this.audio.playHit();
      this.juice.hitFlash = 0.5;
    }

    this.hud.toast(fb.toast, fb.toastClass, 2.4);
    this.juice.addShake(fb.shake);
    this.juice.vignette = safe ? 0.2 : 1;
    this.syncHud();
    if (this.player.stats.hp <= 0) this.die();
  }

  private returnToMenu(): void {
    this.state = "menu";
    this.visibility.disable();
    this.favicon.reset();
    this.titles.reset();
    this.hud.hide();
    this.levelUp.close();
    this.menus.hideGameOver();
    this.menus.closeControls();
    this.menus.closeSettings();
    this.combat.clear();
    this.juice.clear();
    this.tutorial.reset();
    this.hideStartedAt = null;
    this.audio.stopBgm(0.6);
    this.refreshMenuMeta();
    this.menus.showMenu();
    this.drawFrame(true);
  }

  private die(): void {
    if (this.state === "gameover") return;
    this.state = "gameover";
    this.visibility.disable();
    this.favicon.reset();
    this.titles.reset();
    this.hud.hide();
    this.audio.stopBgm(1.2);
    this.audio.playDeath();

    this.meta.totalRuns += 1;
    this.meta.totalPerfects += this.perfectReturns;
    if (this.elapsed > this.meta.bestTime) this.meta.bestTime = this.elapsed;
    if (this.perfectReturns > this.meta.bestPerfects) this.meta.bestPerfects = this.perfectReturns;
    if (this.kills > this.meta.bestKills) this.meta.bestKills = this.kills;

    unlockFlavor(this.meta, "first_run");
    if (this.perfectReturns > 0) unlockFlavor(this.meta, "first_perfect");
    if (this.perfectReturns >= 3) unlockFlavor(this.meta, "three_perfect");
    if (this.elapsed >= 60) unlockFlavor(this.meta, "minute");
    if (this.medusaAvertedRun) unlockFlavor(this.meta, "first_medusa");
    if (this.overstayCount > 0) unlockFlavor(this.meta, "overstay");

    saveMeta(this.meta);
    this.refreshMenuMeta();

    const detail = [
      `Time <strong>${formatTime(this.elapsed)}</strong>`,
      `Kills <strong>${this.kills}</strong>`,
      `Perfect Returns <strong>${this.perfectReturns}</strong>`,
      `Focus Shards earned <strong>${Math.floor(this.shardsEarnedRun)}</strong>`,
      `Overstays <strong>${this.overstayCount}</strong>`,
      `Best time <strong>${formatTime(this.meta.bestTime)}</strong>`,
    ].join("<br/>");

    this.menus.showGameOver({
      cause: this.deathCause,
      causeLabel: deathCauseLabel(this.deathCause),
      summary: `Survived ${formatTime(this.elapsed)}`,
      detail,
      flavor: pickFlavor(this.meta),
    });
  }

  private syncHud(): void {
    this.hud.update({
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      xp: this.progression.xp,
      xpToLevel: this.progression.xpToLevel,
      level: this.progression.level,
      shards: this.progression.shards,
      elapsed: this.elapsed,
      kills: this.kills,
      focusDebt: this.focusDebtRatio(),
      dreadNow: this.visibility.getDreadNow(),
    });
  }

  private drawFrame(pausedHidden: boolean): void {
    if (!this.player) {
      const ctx = this.renderer.ctx;
      ctx.fillStyle = "#0d1218";
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      return;
    }
    this.renderer.draw(this.player, this.combat, this.juice, this.medusa, {
      pausedHidden,
      safeCorner: this.activeSafe,
      focusDebt: this.focusDebtRatio(),
      chain: this.juice.chain,
    });
  }
}
