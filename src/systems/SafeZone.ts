import { ARENA } from "../config/balance";

export type Corner = "tl" | "tr" | "bl" | "br";

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

export function randomCorner(): Corner {
  return CORNERS[Math.floor(Math.random() * CORNERS.length)]!;
}

export function cornerLabel(c: Corner): string {
  switch (c) {
    case "tl":
      return "top left";
    case "tr":
      return "top right";
    case "bl":
      return "bottom left";
    case "br":
      return "bottom right";
  }
}

export function inCorner(x: number, y: number, c: Corner): boolean {
  const midX = ARENA.width * 0.5;
  const midY = ARENA.height * 0.5;
  const left = x < midX;
  const top = y < midY;
  if (c === "tl") return left && top;
  if (c === "tr") return !left && top;
  if (c === "bl") return left && !top;
  return !left && !top;
}

/** Densest enemy cluster direction from arena center, normalized -1..1 */
export function densestLook(
  enemies: { alive: boolean; x: number; y: number }[],
): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const e of enemies) {
    if (!e.alive) continue;
    sx += e.x;
    sy += e.y;
    n++;
  }
  if (n === 0) return { x: 0, y: 0 };
  const cx = sx / n - ARENA.width * 0.5;
  const cy = sy / n - ARENA.height * 0.5;
  const len = Math.hypot(cx, cy) || 1;
  return { x: cx / len, y: cy / len };
}
