import { createParticle, resetParticle, type Particle } from "../entities/Particle";
import { Pool } from "../utils/pool";
import { JUICE } from "../config/balance";
import { randRange } from "../utils/math";

export class JuiceSystem {
  particles: Particle[] = [];
  private pool = new Pool(createParticle, resetParticle, 80);
  shake = 0;
  shockwaves: { x: number; y: number; radius: number; life: number; maxLife: number; target?: number }[] =
    [];
  vignette = 0;
  hitFlash = 0;
  killFlash = 0;
  chain = 0;
  chainTimer = 0;
  /** 0..1 edge pulse synced to dread / favicon */
  edgePulse = 0;
  focusDebtPulse = 0;

  clear(): void {
    this.pool.releaseAll(this.particles);
    this.shockwaves.length = 0;
    this.shake = 0;
    this.vignette = 0;
    this.hitFlash = 0;
    this.killFlash = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.edgePulse = 0;
    this.focusDebtPulse = 0;
  }

  burst(x: number, y: number, color: string, n = 8): void {
    if (JUICE.reduceMotion) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const p = this.pool.acquire();
      p.alive = true;
      p.x = x;
      p.y = y;
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(40, 180);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = randRange(0.25, 0.55);
      p.life = p.maxLife;
      p.radius = randRange(2, 4);
      p.color = color;
      this.particles.push(p);
    }
  }

  registerKills(n: number): void {
    if (n <= 0) return;
    this.chain += n;
    this.chainTimer = 1.4;
    this.killFlash = Math.min(1, 0.25 + n * 0.08);
  }

  addShake(amount: number): void {
    if (JUICE.reduceMotion) amount *= 0.35;
    this.shake = Math.min(JUICE.maxShake, this.shake + amount);
  }

  addShockwave(x: number, y: number, radius: number): void {
    this.shockwaves.push({ x, y, radius: 10, life: 0.45, maxLife: 0.45, target: radius });
  }

  setEdgePulse(dread: number): void {
    this.edgePulse = dread;
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - JUICE.shakeDecay * dt * Math.max(this.shake, 0.01));
    this.vignette = Math.max(0, this.vignette - dt * 0.8);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2);
    this.killFlash = Math.max(0, this.killFlash - dt * 2.2);
    this.focusDebtPulse = Math.max(0, this.focusDebtPulse - dt * 0.5);
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }

    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i]!.alive) {
        this.pool.release(this.particles[i]!);
        this.particles.splice(i, 1);
      }
    }

    for (const s of this.shockwaves) {
      s.life -= dt;
      const target = s.target ?? 200;
      const t = 1 - s.life / s.maxLife;
      s.radius = 10 + target * t;
    }
    this.shockwaves = this.shockwaves.filter((s) => s.life > 0);
  }
}
