export interface Projectile {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierceLeft: number;
  life: number;
  hitIds: Set<number>;
}

export function createProjectile(): Projectile {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 4,
    damage: 10,
    pierceLeft: 0,
    life: 1.6,
    hitIds: new Set(),
  };
}

export function resetProjectile(p: Projectile): void {
  p.alive = false;
  p.hitIds.clear();
  p.life = 1.6;
}
