import { DREAD, MEDUSA } from "../config/balance";
import type { Player } from "../entities/Player";
import type { CombatSystem } from "./Combat";
import type { ProgressionSystem } from "./Progression";
import type { VisibilityResult } from "./Visibility";
import { clamp } from "../utils/math";

export interface ConsequenceFeedback {
  toast: string;
  toastClass: "perfect" | "danger" | "warn";
  shake: number;
  shockwave?: { x: number; y: number; radius: number };
  kills: number;
}

export class ConsequencesSystem {
  applyReturn(
    result: VisibilityResult,
    player: Player,
    combat: CombatSystem,
    progression: ProgressionSystem,
    opts?: { evolvedStalker?: boolean },
  ): ConsequenceFeedback {
    // Always apply bribe (forage) — overstay still gets partial forage before penalty
    const heal = result.bribeHp * player.stats.maxHp;
    player.stats.hp = clamp(player.stats.hp + heal, 0, player.stats.maxHp);
    progression.addShards(result.bribeShards);

    if (result.kind === "perfect") {
      const radius = DREAD.shockwaveRadius * player.stats.shockwaveBonus;
      const { killed } = combat.shockwave(
        player.x,
        player.y,
        radius,
        DREAD.shockwaveDamage,
      );
      combat.applyMirrorEcho(result.deltaSec);
      return {
        toast: `PERFECT RETURN · ${killed} erased`,
        toastClass: "perfect",
        shake: 8,
        shockwave: { x: player.x, y: player.y, radius },
        kills: killed,
      };
    }

    if (result.kind === "overstay") {
      const dmg = player.stats.maxHp * DREAD.overstayDamageFrac;
      player.stats.hp -= dmg;
      player.flash = 0.35;
      player.invuln = 0.15;
      const evolved = !!opts?.evolvedStalker;
      combat.spawnStalkerOnPlayer(player, evolved);
      combat.applyMirrorEcho(result.deltaSec);
      return {
        toast: evolved ? "OVERSTAY — EVOLVED Tab Stalker!" : "OVERSTAY — Tab Stalker!",
        toastClass: "danger",
        shake: evolved ? 14 : 10,
        kills: 0,
      };
    }

    if (result.deltaSec > 0.25) combat.applyMirrorEcho(result.deltaSec);

    return {
      toast: result.deltaSec > 0.35 ? `Foraged +${Math.round(heal)} HP` : "",
      toastClass: "warn",
      shake: 0,
      kills: 0,
    };
  }

  applyMedusaResolve(player: Player, wasHidden: boolean): ConsequenceFeedback | null {
    if (wasHidden) {
      return {
        toast: "Gaze averted",
        toastClass: "perfect",
        shake: 2,
        kills: 0,
      };
    }
    player.stats.hp -= player.stats.maxHp * MEDUSA.damageFrac;
    player.flash = 0.4;
    return {
      toast: "MEDUSA GAZE — LOOK AWAY NEXT TIME",
      toastClass: "danger",
      shake: 12,
      kills: 0,
    };
  }
}
