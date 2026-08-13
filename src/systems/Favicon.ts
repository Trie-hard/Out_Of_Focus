import { clamp, lerp } from "../utils/math";

/**
 * Off-screen canvas → data URL favicon.
 * Morphs from calm blue pupil → glaring red eye as dread rises.
 * Pupil looks toward densest enemy cluster while hidden.
 */
export class FaviconSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private link: HTMLLinkElement;
  private lastBucket = -1;
  private lookX = 0;
  private lookY = 0;
  private anger = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 32;
    this.canvas.height = 32;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    const existing = document.getElementById("favicon") as HTMLLinkElement | null;
    this.link = existing ?? document.createElement("link");
    this.link.id = "favicon";
    this.link.rel = "icon";
    if (!existing) document.head.appendChild(this.link);
    this.setDread(0);
  }

  setLook(x: number, y: number): void {
    this.lookX = clamp(x, -1, 1);
    this.lookY = clamp(y, -1, 1);
  }

  setAnger(level: number): void {
    this.anger = clamp(level, 0, 2);
  }

  setDread(dread: number, force = false): void {
    const d = clamp(dread, 0, 1);
    const bucket = Math.floor(d * 12) + Math.floor(this.lookX * 3) + Math.floor(this.lookY * 3) * 5;
    if (!force && bucket === this.lastBucket && d < 1) return;
    this.lastBucket = bucket;
    this.draw(d);
    this.link.href = this.canvas.toDataURL("image/png");
  }

  reset(): void {
    this.lastBucket = -1;
    this.lookX = 0;
    this.lookY = 0;
    this.anger = 0;
    this.setDread(0, true);
  }

  private draw(d: number): void {
    const ctx = this.ctx;
    const s = 32;
    ctx.clearRect(0, 0, s, s);

    const angerBoost = this.anger * 0.15;
    const dd = clamp(d + angerBoost, 0, 1);

    const bgR = Math.round(lerp(42, 70, dd));
    const bgG = Math.round(lerp(58, 6, dd));
    const bgB = Math.round(lerp(74, 10, dd));
    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();

    const eyeW = lerp(10, 13, dd);
    const eyeH = lerp(7, 11, dd);
    ctx.fillStyle = dd > 0.55 ? "#ffe4e6" : "#dbeafe";
    ctx.beginPath();
    ctx.ellipse(16, 16, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisR = Math.round(lerp(138, 244, dd));
    const irisG = Math.round(lerp(180, 40, dd));
    const irisB = Math.round(lerp(255, 80, dd));
    ctx.fillStyle = `rgb(${irisR},${irisG},${irisB})`;
    const pupil = lerp(5, 7.5, dd);
    const ox = this.lookX * 3.2;
    const oy = this.lookY * 2.6;
    ctx.beginPath();
    ctx.arc(16 + ox, 16 + oy, pupil, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(16 + ox * 1.15, 16 + oy * 1.15, lerp(2.2, 3.4, dd), 0, Math.PI * 2);
    ctx.fill();

    if (dd > 0.65) {
      ctx.strokeStyle = `rgba(244,63,94,${(dd - 0.65) / 0.35})`;
      ctx.lineWidth = 1.5 + this.anger * 0.5;
      for (let i = 0; i < 4 + this.anger; i++) {
        const a = (i / (4 + this.anger)) * Math.PI * 2 + dd * 2;
        ctx.beginPath();
        ctx.moveTo(16 + Math.cos(a) * 6, 16 + Math.sin(a) * 5);
        ctx.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 12);
        ctx.stroke();
      }
    }

    if (d >= 0.72 && d < 0.92) {
      ctx.strokeStyle = "#5eead4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, 16, 14.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (d >= 0.92) {
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(16, 16, 14.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
