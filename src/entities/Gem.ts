export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  radius: number;
  vx: number;
  vy: number;
  life: number;
}

export function createGem(): Gem {
  return {
    alive: false,
    x: 0,
    y: 0,
    value: 1,
    radius: 6,
    vx: 0,
    vy: 0,
    life: 20,
  };
}

export function resetGem(g: Gem): void {
  g.alive = false;
  g.vx = 0;
  g.vy = 0;
  g.life = 20;
}
