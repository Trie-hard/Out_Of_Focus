/** All tunables in one place — Week 2 is mostly number tweaking. */

export const ARENA = {
  width: 1280,
  height: 720,
  margin: 40,
} as const;

export const PLAYER = {
  radius: 14,
  speed: 220,
  maxHp: 100,
  fireCooldown: 0.28,
  projectileSpeed: 520,
  projectileDamage: 12,
  projectileRadius: 4,
  projectilePierce: 0,
  projectileCount: 1,
  pickupRadius: 48,
  invulnOnHit: 0.35,
} as const;

export const ENEMY = {
  baseRadius: 12,
  baseSpeed: 78,
  baseHp: 20,
  contactDamage: 12,
  xpValue: 1,
  /** Soft-fail without unfocus around ~2 min */
  hpScalePerMin: 2.1,
  speedScalePerMin: 0.32,
  densityRamp: 1.7,
} as const;

export const SPAWNER = {
  startInterval: 0.95,
  minInterval: 0.18,
  intervalDecayPerMin: 0.42,
  maxAlive: 95,
  burstEvery: 14,
  burstCount: 7,
} as const;

export const PROGRESSION = {
  baseXpToLevel: 5,
  xpGrowth: 1.35,
  choicesPerLevel: 3,
} as const;

export const DREAD = {
  maxSeconds: 4.8,
  perfectMin: 0.72,
  perfectMax: 0.92,
  bribeHpPerSecond: 0.1,
  bribeShardsPerSecond: 2.2,
  overstayDamageFrac: 0.45,
  shockwaveRadius: 340,
  shockwaveDamage: 9999,
  titleTickMs: 400,
  faviconTickMs: 300,
} as const;

export const MEDUSA = {
  firstAt: 50,
  interval: 42,
  windup: 2.4,
  damageFrac: 0.85,
} as const;

export const TAB_STALKER = {
  radius: 22,
  speed: 165,
  hp: 180,
  contactDamage: 22,
  color: "#f43f5e",
  evolvedRadius: 28,
  evolvedSpeed: 210,
  evolvedHp: 320,
  evolvedDamage: 34,
  evolvedColor: "#fb7185",
} as const;

export const SIREN = {
  /** Seconds hidden before Sirens shatter */
  breakAfterHide: 1.0,
  radius: 16,
  speed: 55,
  hp: 60,
  contactDamage: 8,
  color: "#f0abfc",
} as const;

export const MIRROR = {
  radius: 14,
  speed: 90,
  hp: 40,
  contactDamage: 14,
  color: "#67e8f9",
  maxEcho: 3.2,
} as const;

export const BOSS = {
  /** Combat-seconds between boss-lite events */
  interval: 120,
  firstAt: 115,
  radius: 36,
  speed: 48,
  hp: 520,
  contactDamage: 28,
  color: "#e11d48",
  stalkerCount: 1,
  swarmCount: 10,
} as const;

/** Focus debt — staying locked on without foraging */
export const FOCUS_DEBT = {
  warnAt: 22,
  punishAt: 32,
  fireRatePenalty: 1.35,
  speedPenalty: 0.82,
  drainPerSecond: 0.04, // maxHp fraction / s at full debt
} as const;

export const JUICE = {
  reduceMotion: false,
  shakeDecay: 6,
  maxShake: 10,
};

export type UpgradeId =
  | "fire_rate"
  | "damage"
  | "pierce"
  | "move_speed"
  | "max_hp"
  | "multishot"
  | "shard_blast";

export type UpgradeRarity = "common" | "rare" | "synergy";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
  rarity: UpgradeRarity;
  tags: string[];
  shardCost?: number;
  maxStacks?: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "fire_rate",
    name: "Rapid Focus",
    desc: "Fire 18% faster",
    icon: "⚡",
    rarity: "common",
    tags: ["Offense"],
    maxStacks: 6,
  },
  {
    id: "damage",
    name: "Hard Gaze",
    desc: "+22% projectile damage",
    icon: "◎",
    rarity: "common",
    tags: ["Offense"],
    maxStacks: 8,
  },
  {
    id: "pierce",
    name: "Through Line",
    desc: "Projectiles pierce +1 enemy",
    icon: "→",
    rarity: "rare",
    tags: ["Offense"],
    maxStacks: 4,
  },
  {
    id: "move_speed",
    name: "Restless Feet",
    desc: "+12% move speed",
    icon: "»",
    rarity: "common",
    tags: ["Mobility"],
    maxStacks: 5,
  },
  {
    id: "max_hp",
    name: "Thick Skin",
    desc: "+20 max HP and heal 20",
    icon: "♥",
    rarity: "common",
    tags: ["Sustain"],
    maxStacks: 5,
  },
  {
    id: "multishot",
    name: "Split Attention",
    desc: "+1 projectile per volley",
    icon: "※",
    rarity: "rare",
    tags: ["Offense"],
    maxStacks: 3,
  },
  {
    id: "shard_blast",
    name: "Shadow Cache",
    desc: "Spend 8 shards: Perfect Return radius +40%",
    icon: "◈",
    rarity: "synergy",
    tags: ["Synergy: Perfect Return"],
    shardCost: 8,
    maxStacks: 3,
  },
];
