export type EnemyKind =
  | "chaser"
  | "zigzag"
  | "brute"
  | "stalker"
  | "siren"
  | "mirror"
  | "boss";

export interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  xp: number;
  color: string;
  phase: number;
  telegraph: number;
  /** Tab Stalker evolution */
  evolved: boolean;
  /** Mirror: invuln seconds remaining after return */
  echoShield: number;
  /** Siren: progress toward break while hidden */
  sirenCharge: number;
}

export function createEnemy(): Enemy {
  return {
    alive: false,
    kind: "chaser",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: 1,
    maxHp: 1,
    speed: 70,
    contactDamage: 10,
    xp: 1,
    color: "#94a3b8",
    phase: 0,
    telegraph: 0,
    evolved: false,
    echoShield: 0,
    sirenCharge: 0,
  };
}

export function resetEnemy(e: Enemy): void {
  e.alive = false;
  e.vx = 0;
  e.vy = 0;
  e.phase = 0;
  e.telegraph = 0;
  e.evolved = false;
  e.echoShield = 0;
  e.sirenCharge = 0;
}
