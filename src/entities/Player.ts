import { PLAYER } from "../config/balance";

export interface PlayerStats {
  speed: number;
  maxHp: number;
  hp: number;
  fireCooldown: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileRadius: number;
  projectilePierce: number;
  projectileCount: number;
  pickupRadius: number;
  shockwaveBonus: number;
}

export function createPlayerStats(): PlayerStats {
  return {
    speed: PLAYER.speed,
    maxHp: PLAYER.maxHp,
    hp: PLAYER.maxHp,
    fireCooldown: PLAYER.fireCooldown,
    projectileSpeed: PLAYER.projectileSpeed,
    projectileDamage: PLAYER.projectileDamage,
    projectileRadius: PLAYER.projectileRadius,
    projectilePierce: PLAYER.projectilePierce,
    projectileCount: PLAYER.projectileCount,
    pickupRadius: PLAYER.pickupRadius,
    shockwaveBonus: 1,
  };
}

export interface Player {
  x: number;
  y: number;
  radius: number;
  angle: number;
  invuln: number;
  fireTimer: number;
  stats: PlayerStats;
  flash: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    radius: PLAYER.radius,
    angle: 0,
    invuln: 0,
    fireTimer: 0,
    stats: createPlayerStats(),
    flash: 0,
  };
}
