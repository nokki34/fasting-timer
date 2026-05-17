export type Settings = { windowStart: string; windowEnd: string };
export type ActiveFast = { startedAt: number; targetMs: number };
export type LastFast = { startedAt: number; endedAt: number; targetMs: number };

const KEYS = {
  settings: "ft.settings",
  activeFast: "ft.activeFast",
  lastFast: "ft.lastFast",
} as const;

function read<T>(key: string, validate: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T | null): void {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function isSettings(v: unknown): v is Settings {
  return isObject(v) && typeof v.windowStart === "string" && typeof v.windowEnd === "string";
}
function isActiveFast(v: unknown): v is ActiveFast {
  return isObject(v) && typeof v.startedAt === "number" && typeof v.targetMs === "number";
}
function isLastFast(v: unknown): v is LastFast {
  return isObject(v)
    && typeof v.startedAt === "number"
    && typeof v.endedAt === "number"
    && typeof v.targetMs === "number";
}

export const storage = {
  loadSettings: (): Settings | null => read(KEYS.settings, isSettings),
  saveSettings: (v: Settings): void => write(KEYS.settings, v),
  loadActiveFast: (): ActiveFast | null => read(KEYS.activeFast, isActiveFast),
  saveActiveFast: (v: ActiveFast | null): void => write(KEYS.activeFast, v),
  loadLastFast: (): LastFast | null => read(KEYS.lastFast, isLastFast),
  saveLastFast: (v: LastFast): void => write(KEYS.lastFast, v),
};
