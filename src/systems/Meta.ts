const KEY = "oof_meta_v1";

export interface MetaSave {
  bestTime: number;
  bestPerfects: number;
  bestKills: number;
  totalRuns: number;
  totalPerfects: number;
  introComplete: boolean;
  unlockedFlavors: string[];
}

const DEFAULT: MetaSave = {
  bestTime: 0,
  bestPerfects: 0,
  bestKills: 0,
  totalRuns: 0,
  totalPerfects: 0,
  introComplete: false,
  unlockedFlavors: [],
};

/** Flavor unlocks keyed by achievement */
export const FLAVORS: { id: string; when: string; text: string }[] = [
  { id: "first_run", when: "Survive your first death", text: "the tab remembers" },
  { id: "first_perfect", when: "Land a Perfect Return", text: "it flinched when you came back right" },
  { id: "first_medusa", when: "Avert a Medusa Gaze", text: "looking away is a kind of courage" },
  { id: "overstay", when: "Overstay once", text: "don't linger in the dark too long" },
  { id: "minute", when: "Survive 1:00", text: "still watching from the favicon" },
  { id: "intro", when: "Finish the intro lesson", text: "you learned the rules. it knows that." },
  { id: "three_perfect", when: "3 Perfect Returns in one run", text: "parry the dread — again" },
];

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, unlockedFlavors: [] };
    return { ...DEFAULT, ...JSON.parse(raw) as MetaSave };
  } catch {
    return { ...DEFAULT, unlockedFlavors: [] };
  }
}

export function saveMeta(meta: MetaSave): void {
  localStorage.setItem(KEY, JSON.stringify(meta));
}

export function unlockFlavor(meta: MetaSave, id: string): string | null {
  if (meta.unlockedFlavors.includes(id)) return null;
  const f = FLAVORS.find((x) => x.id === id);
  if (!f) return null;
  meta.unlockedFlavors.push(id);
  saveMeta(meta);
  return f.text;
}

export function pickFlavor(meta: MetaSave): string {
  if (meta.unlockedFlavors.length === 0) return "the tab is learning your habits";
  const id = meta.unlockedFlavors[meta.unlockedFlavors.length - 1]!;
  return FLAVORS.find((f) => f.id === id)?.text ?? "the tab remembers";
}
