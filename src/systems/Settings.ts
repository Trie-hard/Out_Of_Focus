const KEY = "oof_settings_v1";

export interface Settings {
  muted: boolean;
  reduceMotion: boolean;
  dreadDebug: boolean;
}

const DEFAULT: Settings = {
  muted: false,
  reduceMotion:
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      : false,
  dreadDebug: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as Settings) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
