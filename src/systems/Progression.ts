import { PROGRESSION, UPGRADES, type UpgradeDef, type UpgradeId } from "../config/balance";
import type { Player } from "../entities/Player";
import { pick } from "../utils/math";

export class ProgressionSystem {
  level = 1;
  xp = 0;
  xpToLevel: number = PROGRESSION.baseXpToLevel;
  shards = 0;
  stacks = new Map<UpgradeId, number>();
  pendingLevelUps = 0;

  reset(): void {
    this.level = 1;
    this.xp = 0;
    this.xpToLevel = PROGRESSION.baseXpToLevel;
    this.shards = 0;
    this.stacks.clear();
    this.pendingLevelUps = 0;
  }

  addXp(amount: number): boolean {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToLevel) {
      this.xp -= this.xpToLevel;
      this.level++;
      this.xpToLevel = Math.ceil(this.xpToLevel * PROGRESSION.xpGrowth);
      this.pendingLevelUps++;
      leveled = true;
    }
    return leveled;
  }

  addShards(amount: number): void {
    this.shards += amount;
  }

  rollChoices(count = PROGRESSION.choicesPerLevel): UpgradeDef[] {
    const available = UPGRADES.filter((u) => {
      const s = this.stacks.get(u.id) ?? 0;
      if (u.maxStacks != null && s >= u.maxStacks) return false;
      if (u.shardCost != null && this.shards < u.shardCost) return false;
      return true;
    });
    const pool = available.length ? available : UPGRADES.filter((u) => !u.shardCost);
    const chosen: UpgradeDef[] = [];
    const used = new Set<UpgradeId>();
    for (let i = 0; i < count && chosen.length < pool.length; i++) {
      let guard = 0;
      while (guard++ < 20) {
        const u = pick(pool);
        if (!used.has(u.id)) {
          used.add(u.id);
          chosen.push(u);
          break;
        }
      }
    }
    return chosen;
  }

  apply(id: UpgradeId, player: Player): void {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    if (def.shardCost) {
      if (this.shards < def.shardCost) return;
      this.shards -= def.shardCost;
    }
    this.stacks.set(id, (this.stacks.get(id) ?? 0) + 1);
    const st = player.stats;

    switch (id) {
      case "fire_rate":
        st.fireCooldown *= 0.82;
        break;
      case "damage":
        st.projectileDamage *= 1.22;
        break;
      case "pierce":
        st.projectilePierce += 1;
        break;
      case "move_speed":
        st.speed *= 1.12;
        break;
      case "max_hp":
        st.maxHp += 20;
        st.hp = Math.min(st.maxHp, st.hp + 20);
        break;
      case "multishot":
        st.projectileCount += 1;
        break;
      case "shard_blast":
        st.shockwaveBonus *= 1.4;
        break;
    }

    if (this.pendingLevelUps > 0) this.pendingLevelUps--;
  }
}
