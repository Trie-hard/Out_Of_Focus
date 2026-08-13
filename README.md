# Out of Focus

> Survive the arena. The deadliest threat lives in your **browser tab bar**.

**Out of Focus** is a top-down, wave-based roguelite survival browser game that weaponizes the Page Visibility API. Leaving the tab isn't cheating — it's the core mechanic.

## Play

- **Local:** `npm install && npm run dev`
- **Build:** `npm run build` → static files in `dist/`
- **Preview build:** `npm run preview`

### Hosting (hackathon playable link)

| Host | How |
|------|-----|
| **Vercel** | `npx vercel --prod` (uses [`vercel.json`](vercel.json)) |
| **GitHub Pages** | Push to `main` — [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds & deploys `dist/` |
| **itch.io** | Upload `dist/` as HTML zip; see [`itch.md`](itch.md) for store copy |

Playable URL: https://trie-hard.github.io/Out_Of_Focus/

Demo script: [`DEMO.md`](DEMO.md)

## Controls

| Input | Action |
|--------|--------|
| WASD / Arrows | Move |
| Auto | Weapons fire at nearest enemy |
| Ctrl+Tab / click another tab | Unfocus — pause combat, forage HP & Focus Shards, dread rises |
| Click back | Cash in — safe forage, Perfect Return shockwave, or Overstay Tab Stalker |
| M | Mute / unmute |
| R | Restart from game over |

First run teaches forage → Medusa → Perfect Return. Later runs skip the forced intro (progress saved in `localStorage`).

## The tab fantasy

1. **Bribe (Shadow Foraging)** — HP regen and Focus Shards only accrue while the tab is hidden.
2. **Force (Medusa Gaze)** — Periodic screen-wide gaze. Leave the tab before it resolves or take massive damage.
3. **Dread** — While away, the favicon morphs (pupil tracks densest enemies) and the title whispers. Teal = Perfect Return window. Tips with ✓ are real safe corners.
4. **Cash-in** — Overstay spawns a Tab Stalker (evolves on repeat). Perfect Return clears the screen.
5. **Focus Debt** — Stay locked on too long without foraging and the arena punishes you.
6. **Sirens / Mirrors / Boss-lite** — enemies and events that force unfocus as strategy.

## Stack

Vite + TypeScript + HTML5 Canvas. No heavy engine — maximum control over `visibilitychange`, favicon data-URLs, and `<title>` theater.

## Demo video tips

Film the **browser chrome** (favicon + title), not only the canvas. Suggested beats:

1. Hook / title
2. Arena combat + level-up
3. Medusa → Ctrl+Tab / switch tabs to survive
4. Favicon / title dread escalation
5. Perfect Return vs Overstay stalker
6. Close on the unique claim: this can't exist on a console

## What changed today

Initial implementation: full MVP vertical slice (arena, visibility dread, favicon/title, perfect return, overstay, shadow foraging, Medusa, tutorial, pooling, juice).

## License

Created for BTT Web Game Jam. All code/assets produced during the hackathon period.
