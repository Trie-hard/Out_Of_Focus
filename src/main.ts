import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Missing #game-canvas");
}

new Game(canvas);

// Helpful console blurb for judges / demos
console.info(
  "%cOut of Focus",
  "color:#5eead4;font-size:14px;font-weight:bold",
  "\nThe threat lives in your tab bar. Ctrl+Tab / click another tab to forage. Return in the teal favicon window for a Perfect Return.",
);
