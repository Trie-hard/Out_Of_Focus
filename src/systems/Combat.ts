import {
  ARENA,
  BOSS,
  ENEMY,
  MIRROR,
  PLAYER,
  SIREN,
  SPAWNER,
  TAB_STALKER,
} from "../config/balance";
import type { Enemy, EnemyKind } from "../entities/Enemy";
import type { Player } from "../entities/Player";
import type { Projectile } from "../entities/Projectile";
import type { Gem } from "../entities/Gem";
import { Pool } from "../utils/pool";
import { circlesOverlap, clamp, normalize, randRange } from "../utils/math";
import { createEnemy, resetEnemy } from "../entities/Enemy";
import { createProjectile, resetProjectile } from "../entities/Projectile";
import { createGem, resetGem } from "../entities/Gem";

export interface DamageFloat {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export class CombatSystem {
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly gems: Gem[] = [];
  readonly floats: DamageFloat[] = [];
  private enemyPool = new Pool(createEnemy, resetEnemy, 64);
  private projPool = new Pool(createProjectile, resetProjectile, 64);
  private gemPool = new Pool(createGem, resetGem, 64);
  private nextEnemyId = 1;
  private enemyIds = new WeakMap<Enemy, number>();

  clear(): void {
    for (const e of this.enemies) this.enemyPool.release(e);
    for (const p of this.projectiles) this.projPool.release(p);
    for (const g of this.gems) this.gemPool.release(g);
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.gems.length = 0;
    this.floats.length = 0;
  }

  spawnEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    elapsedMin: number,
    opts?: { evolved?: boolean },
  ): Enemy {
    const e = this.enemyPool.acquire();
    e.alive = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.phase = Math.random() * Math.PI * 2;
    e.evolved = !!opts?.evolved;
    e.echoShield = 0;
    e.sirenCharge = 0;

    const hpMul = 1 + elapsedMin * ENEMY.hpScalePerMin;
    const spdMul = 1 + elapsedMin * ENEMY.speedScalePerMin;

    if (kind === "boss") {
      e.radius = BOSS.radius;
      e.speed = BOSS.speed * (1 + elapsedMin * 0.1);
      e.hp = BOSS.hp * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = BOSS.contactDamage;
      e.xp = 25;
      e.color = BOSS.color;
      e.telegraph = 0.8;
    } else if (kind === "stalker") {
      if (e.evolved) {
        e.radius = TAB_STALKER.evolvedRadius;
        e.speed = TAB_STALKER.evolvedSpeed;
        e.hp = TAB_STALKER.evolvedHp;
        e.maxHp = e.hp;
        e.contactDamage = TAB_STALKER.evolvedDamage;
        e.xp = 14;
        e.color = TAB_STALKER.evolvedColor;
      } else {
        e.radius = TAB_STALKER.radius;
        e.speed = TAB_STALKER.speed;
        e.hp = TAB_STALKER.hp;
        e.maxHp = e.hp;
        e.contactDamage = TAB_STALKER.contactDamage;
        e.xp = 8;
        e.color = TAB_STALKER.color;
      }
      e.telegraph = 0.55;
    } else if (kind === "siren") {
      e.radius = SIREN.radius;
      e.speed = SIREN.speed * spdMul;
      e.hp = SIREN.hp * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = SIREN.contactDamage;
      e.xp = 4;
      e.color = SIREN.color;
      e.telegraph = 0;
    } else if (kind === "mirror") {
      e.radius = MIRROR.radius;
      e.speed = MIRROR.speed * spdMul;
      e.hp = MIRROR.hp * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = MIRROR.contactDamage;
      e.xp = 3;
      e.color = MIRROR.color;
      e.telegraph = 0;
    } else if (kind === "brute") {
      e.radius = ENEMY.baseRadius * 1.55;
      e.speed = ENEMY.baseSpeed * 0.55 * spdMul;
      e.hp = ENEMY.baseHp * 3.2 * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = ENEMY.contactDamage * 1.6;
      e.xp = 3;
      e.color = "#a78bfa";
    } else if (kind === "zigzag") {
      e.radius = ENEMY.baseRadius * 0.9;
      e.speed = ENEMY.baseSpeed * 1.35 * spdMul;
      e.hp = ENEMY.baseHp * 0.85 * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = ENEMY.contactDamage;
      e.xp = 1;
      e.color = "#38bdf8";
    } else {
      e.radius = ENEMY.baseRadius;
      e.speed = ENEMY.baseSpeed * spdMul;
      e.hp = ENEMY.baseHp * hpMul;
      e.maxHp = e.hp;
      e.contactDamage = ENEMY.contactDamage;
      e.xp = ENEMY.xpValue;
      e.color = "#94a3b8";
    }

    this.enemyIds.set(e, this.nextEnemyId++);
    this.enemies.push(e);
    return e;
  }

  spawnStalkerOnPlayer(player: Player, evolved = false): Enemy {
    return this.spawnEnemy("stalker", player.x, player.y, 0, { evolved });
  }

  spawnAtEdge(kind: EnemyKind, elapsedMin: number): Enemy {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = randRange(0, ARENA.width);
      y = -20;
    } else if (edge === 1) {
      x = ARENA.width + 20;
      y = randRange(0, ARENA.height);
    } else if (edge === 2) {
      x = randRange(0, ARENA.width);
      y = ARENA.height + 20;
    } else {
      x = -20;
      y = randRange(0, ARENA.height);
    }
    return this.spawnEnemy(kind, x, y, elapsedMin);
  }

  /** Apply echo shields to mirrors based on last hide duration */
  applyMirrorEcho(hideSec: number): void {
    const echo = Math.min(MIRROR.maxEcho, Math.max(0.4, hideSec));
    for (const e of this.enemies) {
      if (e.alive && e.kind === "mirror") e.echoShield = echo;
    }
  }

  /** While hidden, charge sirens; shatter when charged */
  tickSirensWhileHidden(dt: number): number {
    let shattered = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.kind !== "siren") continue;
      e.sirenCharge += dt;
      if (e.sirenCharge >= SIREN.breakAfterHide) {
        e.alive = false;
        shattered++;
        this.dropGem(e.x, e.y, e.xp);
        this.addFloat(e.x, e.y, "SHATTER", "#f0abfc");
      }
    }
    if (shattered) this.compactEnemies();
    return shattered;
  }

  clearCorner(corner: "tl" | "tr" | "bl" | "br"): number {
    const midX = ARENA.width * 0.5;
    const midY = ARENA.height * 0.5;
    let killed = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const left = e.x < midX;
      const top = e.y < midY;
      const match =
        (corner === "tl" && left && top) ||
        (corner === "tr" && !left && top) ||
        (corner === "bl" && left && !top) ||
        (corner === "br" && !left && !top);
      if (match && e.kind !== "boss") {
        e.alive = false;
        killed++;
        this.dropGem(e.x, e.y, e.xp);
        this.addFloat(e.x, e.y, "SAFE", "#5eead4");
      }
    }
    this.compactEnemies();
    return killed;
  }

  fire(player: Player, damageMul = 1): void {
    const nearest = this.findNearestEnemy(player.x, player.y);
    let aimX = Math.cos(player.angle);
    let aimY = Math.sin(player.angle);
    if (nearest) {
      const n = normalize(nearest.x - player.x, nearest.y - player.y);
      aimX = n.x;
      aimY = n.y;
      player.angle = Math.atan2(aimY, aimX);
    }

    const count = player.stats.projectileCount;
    const spread = count > 1 ? 0.22 : 0;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * (count + 1);
      const ca = Math.cos(t);
      const sa = Math.sin(t);
      const dx = aimX * ca - aimY * sa;
      const dy = aimX * sa + aimY * ca;
      const p = this.projPool.acquire();
      p.alive = true;
      p.x = player.x + dx * (player.radius + 4);
      p.y = player.y + dy * (player.radius + 4);
      p.vx = dx * player.stats.projectileSpeed;
      p.vy = dy * player.stats.projectileSpeed;
      p.radius = player.stats.projectileRadius;
      p.damage = player.stats.projectileDamage * damageMul;
      p.pierceLeft = player.stats.projectilePierce;
      p.life = 1.6;
      p.hitIds.clear();
      this.projectiles.push(p);
    }
  }

  shockwave(
    x: number,
    y: number,
    radius: number,
    damage: number,
  ): { killed: number; hits: { x: number; y: number; color: string }[] } {
    let killed = 0;
    const hits: { x: number; y: number; color: string }[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (circlesOverlap(x, y, radius, e.x, e.y, e.radius)) {
        if (e.echoShield > 0) continue;
        e.hp -= damage;
        hits.push({ x: e.x, y: e.y, color: e.color });
        this.addFloat(e.x, e.y - 10, `${Math.round(damage)}`, "#fde68a");
        if (e.hp <= 0) {
          e.alive = false;
          killed++;
          this.dropGem(e.x, e.y, e.xp);
        }
      }
    }
    this.compactEnemies();
    return { killed, hits };
  }

  updateEnemies(dt: number, player: Player): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.echoShield > 0) e.echoShield -= dt;
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        continue;
      }
      e.phase += dt;
      let tx = player.x - e.x;
      let ty = player.y - e.y;
      if (e.kind === "zigzag" || e.kind === "siren") {
        const side = Math.sin(e.phase * (e.kind === "siren" ? 3 : 6)) * (e.kind === "siren" ? 50 : 80);
        const n = normalize(tx, ty);
        tx = n.x * e.speed + -n.y * side;
        ty = n.y * e.speed + n.x * side;
        const m = normalize(tx, ty);
        e.vx = m.x * e.speed;
        e.vy = m.y * e.speed;
      } else {
        const n = normalize(tx, ty);
        e.vx = n.x * e.speed;
        e.vy = n.y * e.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, e.radius, ARENA.width - e.radius);
      e.y = clamp(e.y, e.radius, ARENA.height - e.radius);
    }
  }

  updateProjectiles(
    dt: number,
    tabFocused: boolean,
  ): {
    kills: number;
    positions: { x: number; y: number; color: string }[];
    damageHits: { x: number; y: number; dmg: number }[];
  } {
    let kills = 0;
    const positions: { x: number; y: number; color: string }[] = [];
    const damageHits: { x: number; y: number; dmg: number }[] = [];
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (
        p.life <= 0 ||
        p.x < -40 ||
        p.y < -40 ||
        p.x > ARENA.width + 40 ||
        p.y > ARENA.height + 40
      ) {
        p.alive = false;
        continue;
      }

      for (const e of this.enemies) {
        if (!e.alive || e.telegraph > 0) continue;
        // Sirens only take damage while tab is hidden
        if (e.kind === "siren" && tabFocused) continue;
        if (e.echoShield > 0) continue;
        const id = this.enemyIds.get(e) ?? 0;
        if (p.hitIds.has(id)) continue;
        if (circlesOverlap(p.x, p.y, p.radius, e.x, e.y, e.radius)) {
          p.hitIds.add(id);
          e.hp -= p.damage;
          damageHits.push({ x: e.x, y: e.y, dmg: p.damage });
          this.addFloat(e.x + randRange(-6, 6), e.y - 12, `${Math.round(p.damage)}`, "#fef3c7");
          if (e.hp <= 0) {
            e.alive = false;
            kills++;
            positions.push({ x: e.x, y: e.y, color: e.color });
            this.dropGem(e.x, e.y, e.xp);
          }
          if (p.pierceLeft <= 0) {
            p.alive = false;
            break;
          }
          p.pierceLeft--;
        }
      }
    }
    this.compactProjectiles();
    this.compactEnemies();
    return { kills, positions, damageHits };
  }

  updateFloats(dt: number): void {
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      if (this.floats[i]!.life <= 0) this.floats.splice(i, 1);
    }
  }

  resolvePlayerContact(player: Player, dt: number): { damage: number; fromStalker: boolean } {
    if (player.invuln > 0) {
      player.invuln -= dt;
      return { damage: 0, fromStalker: false };
    }
    for (const e of this.enemies) {
      if (!e.alive || e.telegraph > 0) continue;
      if (circlesOverlap(player.x, player.y, player.radius, e.x, e.y, e.radius)) {
        player.invuln = PLAYER.invulnOnHit;
        player.flash = 0.2;
        return { damage: e.contactDamage, fromStalker: e.kind === "stalker" };
      }
    }
    return { damage: 0, fromStalker: false };
  }

  updateGems(dt: number, player: Player): number {
    let gained = 0;
    const magnet = player.stats.pickupRadius;
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.alive = false;
        continue;
      }
      const d2 = (g.x - player.x) ** 2 + (g.y - player.y) ** 2;
      if (d2 < magnet * magnet) {
        const n = normalize(player.x - g.x, player.y - g.y);
        g.x += n.x * 420 * dt;
        g.y += n.y * 420 * dt;
      }
      if (circlesOverlap(g.x, g.y, g.radius, player.x, player.y, player.radius + 4)) {
        g.alive = false;
        gained += g.value;
      }
    }
    this.compactGems();
    return gained;
  }

  aliveEnemyCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  private addFloat(x: number, y: number, text: string, color: string): void {
    if (this.floats.length > 40) this.floats.shift();
    this.floats.push({ x, y, text, life: 0.7, color });
  }

  private dropGem(x: number, y: number, value: number): void {
    const g = this.gemPool.acquire();
    g.alive = true;
    g.x = x;
    g.y = y;
    g.value = value;
    g.radius = 6;
    this.gems.push(g);
  }

  private findNearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.telegraph > 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private compactEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      if (!e.alive) {
        this.enemyPool.release(e);
        this.enemies.splice(i, 1);
      }
    }
  }

  private compactProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      if (!p.alive) {
        this.projPool.release(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private compactGems(): void {
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i]!;
      if (!g.alive) {
        this.gemPool.release(g);
        this.gems.splice(i, 1);
      }
    }
  }
}

export class SpawnerSystem {
  private timer = 0;
  private burstTimer = 0;

  reset(): void {
    this.timer = 0.4;
    this.burstTimer = SPAWNER.burstEvery;
  }

  update(dt: number, combat: CombatSystem, elapsed: number): void {
    const minutes = elapsed / 60;
    const interval = Math.max(
      SPAWNER.minInterval,
      SPAWNER.startInterval - minutes * SPAWNER.intervalDecayPerMin,
    );
    this.timer -= dt;
    this.burstTimer -= dt;

    if (combat.aliveEnemyCount() >= SPAWNER.maxAlive) return;

    if (this.timer <= 0) {
      this.timer = interval;
      this.spawnOne(combat, minutes);
    }

    if (this.burstTimer <= 0) {
      this.burstTimer = SPAWNER.burstEvery;
      const n = SPAWNER.burstCount + Math.floor(minutes * ENEMY.densityRamp);
      for (let i = 0; i < n; i++) {
        if (combat.aliveEnemyCount() >= SPAWNER.maxAlive) break;
        this.spawnOne(combat, minutes);
      }
    }
  }

  private spawnOne(combat: CombatSystem, minutes: number): void {
    let kind: EnemyKind = "chaser";
    const r = Math.random();
    if (minutes > 1.5 && r < 0.1) kind = "siren";
    else if (minutes > 0.9 && r < 0.2) kind = "mirror";
    else if (minutes > 1.0 && r < 0.32) kind = "brute";
    else if (minutes > 0.4 && r < 0.5) kind = "zigzag";

    combat.spawnAtEdge(kind, minutes);
  }
}

export class BossDirector {
  private nextAt: number = BOSS.firstAt;

  reset(): void {
    this.nextAt = BOSS.firstAt;
  }

  update(elapsed: number, combat: CombatSystem): boolean {
    if (elapsed < this.nextAt) return false;
    this.nextAt = elapsed + BOSS.interval;
    const minutes = elapsed / 60;
    combat.spawnAtEdge("boss", minutes);
    for (let i = 0; i < BOSS.swarmCount; i++) combat.spawnAtEdge("chaser", minutes);
    combat.spawnAtEdge("stalker", minutes);
    return true;
  }
}
