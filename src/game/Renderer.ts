import { ARENA, JUICE } from "../config/balance";
import type { Player } from "../entities/Player";
import type { CombatSystem } from "../systems/Combat";
import type { JuiceSystem } from "../systems/Juice";
import type { MedusaSystem } from "../systems/Medusa";
import type { Corner } from "../systems/SafeZone";

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  resize(): void {
    this.canvas.width = ARENA.width;
    this.canvas.height = ARENA.height;
  }

  draw(
    player: Player,
    combat: CombatSystem,
    juice: JuiceSystem,
    medusa: MedusaSystem,
    opts: {
      pausedHidden: boolean;
      safeCorner?: Corner | null;
      focusDebt?: number;
      chain?: number;
    },
  ): void {
    const ctx = this.ctx;
    const shake = juice.shake;
    const ox = shake && !JUICE.reduceMotion ? (Math.random() - 0.5) * shake * 2 : 0;
    const oy = shake && !JUICE.reduceMotion ? (Math.random() - 0.5) * shake * 2 : 0;

    ctx.save();
    ctx.translate(ox, oy);

    const g = ctx.createRadialGradient(
      ARENA.width * 0.5,
      ARENA.height * 0.45,
      40,
      ARENA.width * 0.5,
      ARENA.height * 0.5,
      ARENA.width * 0.7,
    );
    g.addColorStop(0, "#152030");
    g.addColorStop(0.55, "#0e141c");
    g.addColorStop(1, "#080b10");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, ARENA.width + 40, ARENA.height + 40);

    ctx.strokeStyle = "rgba(80,110,140,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < ARENA.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA.height);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA.width, y);
      ctx.stroke();
    }

    // Pending safe corner highlight
    if (opts.safeCorner) {
      const midX = ARENA.width * 0.5;
      const midY = ARENA.height * 0.5;
      const c = opts.safeCorner;
      const x = c === "tl" || c === "bl" ? 0 : midX;
      const y = c === "tl" || c === "tr" ? 0 : midY;
      ctx.fillStyle = "rgba(94,234,212,0.12)";
      ctx.fillRect(x, y, midX, midY);
      ctx.strokeStyle = "rgba(94,234,212,0.45)";
      ctx.strokeRect(x + 4, y + 4, midX - 8, midY - 8);
    }

    for (const gem of combat.gems) {
      if (!gem.alive) continue;
      ctx.fillStyle = "#5eead4";
      ctx.beginPath();
      ctx.moveTo(gem.x, gem.y - gem.radius);
      ctx.lineTo(gem.x + gem.radius, gem.y);
      ctx.lineTo(gem.x, gem.y + gem.radius);
      ctx.lineTo(gem.x - gem.radius, gem.y);
      ctx.closePath();
      ctx.fill();
    }

    for (const e of combat.enemies) {
      if (!e.alive) continue;
      const alpha = e.telegraph > 0 ? 0.35 + Math.sin(performance.now() / 60) * 0.2 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;

      if (e.echoShield > 0) {
        ctx.strokeStyle = "rgba(103,232,249,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (e.kind === "brute") {
        this.drawPoly(ctx, e.x, e.y, e.radius, 6, e.phase * 0.3);
      } else if (e.kind === "zigzag") {
        this.drawPoly(ctx, e.x, e.y, e.radius, 3, e.phase);
      } else if (e.kind === "siren") {
        // ring that fills as hide-charge builds (shown when focused as invuln cue)
        ctx.strokeStyle = "#f0abfc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        this.drawPoly(ctx, e.x, e.y, e.radius, 8, e.phase);
        ctx.fillStyle = "rgba(240,171,252,0.35)";
        ctx.font = "10px IBM Plex Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("LOOK AWAY", e.x, e.y - e.radius - 10);
      } else if (e.kind === "mirror") {
        this.drawPoly(ctx, e.x, e.y, e.radius, 4, Math.PI / 4 + e.phase * 0.5);
      } else if (e.kind === "boss") {
        ctx.strokeStyle = "#fecdd3";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        this.drawPoly(ctx, e.x, e.y, e.radius, 7, performance.now() / 400);
      } else if (e.kind === "stalker") {
        ctx.strokeStyle = e.evolved ? "#ffe4e6" : "#fda4af";
        ctx.lineWidth = e.evolved ? 4 : 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        this.drawPoly(ctx, e.x, e.y, e.radius, e.evolved ? 6 : 5, performance.now() / 200);
      } else {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (e.hp < e.maxHp) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, e.radius * 2, 3);
        ctx.fillStyle = "#f43f5e";
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, e.radius * 2 * (e.hp / e.maxHp), 3);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#fde68a";
    for (const p of combat.projectiles) {
      if (!p.alive) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const flash = player.flash > 0;
    ctx.fillStyle = flash ? "#fff" : "#5eead4";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#99f6e4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + Math.cos(player.angle) * (player.radius + 10),
      player.y + Math.sin(player.angle) * (player.radius + 10),
    );
    ctx.stroke();

    for (const p of juice.particles) {
      if (!p.alive) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const s of juice.shockwaves) {
      ctx.strokeStyle = `rgba(94,234,212,${Math.max(0, s.life / s.maxLife)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Damage floats
    ctx.textAlign = "center";
    ctx.font = "600 14px IBM Plex Mono, monospace";
    for (const f of combat.floats) {
      ctx.globalAlpha = Math.max(0, f.life / 0.7);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // Edge pulse synced to dread / focus debt
    const edge = Math.max(juice.edgePulse * 0.7, juice.focusDebtPulse);
    if (edge > 0.05 && !JUICE.reduceMotion) {
      const eg = ctx.createRadialGradient(
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.height * 0.35,
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.width * 0.72,
      );
      eg.addColorStop(0, "rgba(0,0,0,0)");
      eg.addColorStop(1, `rgba(244,63,94,${0.15 + edge * 0.45})`);
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    const vig = Math.max(juice.vignette, medusa.state.vignette);
    if (vig > 0.01 && !JUICE.reduceMotion) {
      ctx.fillStyle = `rgba(120, 10, 30, ${vig * 0.45})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      const vg = ctx.createRadialGradient(
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.height * 0.2,
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.height * 0.75,
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,0,${0.55 * vig})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    if (juice.hitFlash > 0) {
      ctx.fillStyle = `rgba(244,63,94,${juice.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
    if (juice.killFlash > 0) {
      ctx.fillStyle = `rgba(94,234,212,${juice.killFlash * 0.2})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }

    if ((opts.chain ?? 0) >= 3) {
      ctx.fillStyle = "#5eead4";
      ctx.font = "700 20px Space Grotesk, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`x${opts.chain} CLEAR`, ARENA.width / 2, 48);
    }

    if ((opts.focusDebt ?? 0) > 0.5) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "600 14px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("FOCUS DEBT — Ctrl+Tab to clear", ARENA.width / 2, ARENA.height - 28);
    }

    if (opts.pausedHidden) {
      ctx.fillStyle = "rgba(6,8,12,0.55)";
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 22px Space Grotesk, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("UNFOCUSED — dread rising in the tab bar", ARENA.width / 2, ARENA.height / 2);
    }

    if (medusa.state.phase === "windup") {
      ctx.fillStyle = "#fecdd3";
      ctx.font = "700 36px Space Grotesk, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LOOK AWAY", ARENA.width / 2, 80);
      ctx.font = "500 16px IBM Plex Mono, monospace";
      ctx.fillStyle = "#fda4af";
      ctx.fillText(
        `Gaze in ${medusa.state.timer.toFixed(1)}s — Ctrl+Tab NOW`,
        ARENA.width / 2,
        112,
      );
    }
  }

  private drawPoly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    sides: number,
    rot: number,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
