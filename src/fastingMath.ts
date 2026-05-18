const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MIN = 24 * 60;

function parseHHmm(s: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!match) throw new Error(`Invalid time: ${s}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error(`Out of range: ${s}`);
  return h * 60 + m;
}

export function windowToTargetMs(windowStart: string, windowEnd: string): number {
  const a = parseHHmm(windowStart);
  const b = parseHHmm(windowEnd);
  if (a === b) throw new Error("Window start and end must differ");
  const minutes = b > a ? b - a : DAY_MIN - a + b;
  return minutes * MIN_MS;
}

export function elapsedMs(startedAt: number, now: number): number {
  return Math.max(0, now - startedAt);
}

export function progress(elapsed: number, target: number): number {
  if (target <= 0) throw new Error("target must be positive");
  return elapsed / target;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / MIN_MS);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function formatTimeOfDay(epochMs: number): string {
  const d = new Date(epochMs);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}

export function plannedStartFor(now: number, windowStart: string): number {
  const minutes = parseHHmm(windowStart);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const todayPlanned = new Date(now);
  todayPlanned.setHours(h, m, 0, 0);
  if (todayPlanned.getTime() <= now) {
    return todayPlanned.getTime();
  }
  return todayPlanned.getTime() - 24 * HOUR_MS;
}

export function sameLocalYMD(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export { HOUR_MS, MIN_MS };
