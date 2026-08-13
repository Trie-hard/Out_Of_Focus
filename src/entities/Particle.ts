export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

export function createParticle(): Particle {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.4,
    radius: 3,
    color: "#fff",
  };
}

export function resetParticle(p: Particle): void {
  p.alive = false;
}
