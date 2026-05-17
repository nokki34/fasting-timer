# Fasting Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-only fasting timer that tracks one active fast with a window-as-dial visualization (full revolution = target fast duration; over-fasting overlays a second arc). Persists state in localStorage. Deploys to GitHub Pages.

**Architecture:** Single-page Vite + TypeScript app, no framework. Three pure modules (`fastingMath`, `storage`, `store`) cover all logic; six component modules render their slice of state into a fixed DOM root. A tick loop (`setInterval(1000)`) drives dial updates. localStorage persists three independent slices. Static build deployed to GH Pages via official Action.

**Tech Stack:** Vite 5+, TypeScript 5+, Vitest 1+ (jsdom env), no runtime dependencies, GitHub Actions for deploy.

**Spec:** `docs/superpowers/specs/2026-05-17-fasting-timer-design.md`

---

## File Structure

**Created in order:**

```
.github/workflows/deploy.yml      # GH Pages deploy
.gitignore                        # node_modules, dist (exists)
index.html                        # entry HTML, mounts #app
package.json                      # deps + scripts
tsconfig.json                     # TS config
vite.config.ts                    # Vite + base path
vitest.config.ts                  # Vitest jsdom env

src/
  main.ts                         # boot: load state, mount components, tick loop, state machine wiring
  store.ts                        # createStore<T>() — get/set/subscribe
  storage.ts                      # typed localStorage slices with validation
  fastingMath.ts                  # pure: windowToTargetMs, elapsedMs, progress, formatters
  styles.css                      # dark theme via CSS vars; layout for shell + sheets
  components/
    Dial.ts                       # SVG: track, progress arc, overlap arc, center text
    MetaRow.ts                    # "STARTED 9:04pm" + "GOAL 9:04am", start tappable
    Controls.ts                   # Start/End button + "Last fast: 13h 12m" line
    SettingsSheet.ts              # window editor, auto-opens on first launch
    EditStartSheet.ts             # datetime-local for activeFast.startedAt
    EndConfirmSheet.ts            # datetime-local for end time, default now

tests/
  fastingMath.test.ts
  storage.test.ts
  store.test.ts
```

Each component module exports `mount(parent: HTMLElement, props): { update(props): void }`. Components own their DOM and re-render only on `update`. The store dispatches updates from `main.ts`.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/styles.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fasting-timer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/fasting-timer/",
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="color-scheme" content="dark" />
    <title>Fasting Timer</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/styles.css` (dark theme + shell layout)**

```css
:root {
  --bg: #0f1115;
  --surface: #181b22;
  --surface-2: #20242d;
  --track: #2a2f3a;
  --primary: #7aa2f7;
  --success: #9ece6a;
  --warning: #f7768e;
  --text: #e6e8ee;
  --text-dim: #8a93a4;
  --text-faint: #5b6273;
  --radius: 12px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#app {
  max-width: 480px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px 20px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-dim);
  letter-spacing: 0.02em;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 20px;
  padding: 6px;
  cursor: pointer;
  border-radius: 8px;
}
.icon-btn:hover { background: var(--surface); color: var(--text); }

.dial-wrap { display: flex; justify-content: center; padding: 12px 0; }
.dial-wrap svg { width: 100%; max-width: 320px; height: auto; }

.meta-row {
  display: flex;
  justify-content: space-between;
  padding: 0 12px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 13px;
}
.meta-row .meta-label { font-size: 10px; color: var(--text-faint); letter-spacing: 0.08em; }
.meta-row .meta-val { color: var(--text); }
.meta-row button.meta-val {
  background: transparent;
  border: none;
  color: var(--text);
  font: inherit;
  padding: 0;
  cursor: pointer;
  text-decoration: underline dotted var(--text-faint);
  text-underline-offset: 3px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  padding-top: 8px;
}
.btn-primary {
  width: 100%;
  max-width: 320px;
  padding: 16px;
  border-radius: var(--radius);
  border: none;
  background: var(--primary);
  color: #0a0c10;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary.danger { background: var(--warning); color: #1a0a0f; }
.last-fast {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: var(--text-dim);
}

.sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 10;
}
.sheet {
  background: var(--surface);
  width: 100%; max-width: 480px;
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 20px 20px 28px;
  display: flex; flex-direction: column; gap: 14px;
}
.sheet h2 { margin: 0; font-size: 16px; }
.sheet label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.sheet input[type="time"], .sheet input[type="datetime-local"] {
  background: var(--surface-2);
  border: 1px solid var(--track);
  color: var(--text);
  font: inherit;
  padding: 10px;
  border-radius: 8px;
  color-scheme: dark;
}
.sheet .sheet-actions { display: flex; gap: 10px; margin-top: 4px; }
.sheet .sheet-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: none;
  font: inherit; font-weight: 600;
  cursor: pointer;
}
.sheet .btn-cancel { background: var(--surface-2); color: var(--text); }
.sheet .btn-save   { background: var(--primary); color: #0a0c10; }
.sheet .error { color: var(--warning); font-size: 12px; min-height: 1em; }
```

- [ ] **Step 7: Create `src/main.ts` (placeholder boot)**

```ts
import "./styles.css";

const root = document.getElementById("app")!;
root.innerHTML = `<div class="header"><h1>FASTING TIMER</h1></div><p style="color:var(--text-dim)">scaffold loaded</p>`;
```

- [ ] **Step 8: Install and verify dev server**

```bash
npm install
npm run dev
```

Expected: Vite reports a local URL (e.g. `http://localhost:5173/fasting-timer/`). Open in browser → see "FASTING TIMER" header + "scaffold loaded" text on dark background. Stop with Ctrl+C.

- [ ] **Step 9: Verify type-check and build**

```bash
npm run build
```

Expected: `tsc --noEmit` produces no errors, then `vite build` produces `dist/` with `index.html` and assets.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src/main.ts src/styles.css
git commit -m "chore: scaffold vite + ts project with dark theme shell"
```

---

## Task 2: `fastingMath` module (TDD)

**Files:**
- Test: `tests/fastingMath.test.ts`
- Create: `src/fastingMath.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/fastingMath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  windowToTargetMs,
  elapsedMs,
  progress,
  formatDuration,
  formatTimeOfDay,
} from "../src/fastingMath";

const HOUR = 60 * 60 * 1000;

describe("windowToTargetMs", () => {
  it("returns 12h for 21:00 → 09:00 (wraps midnight)", () => {
    expect(windowToTargetMs("21:00", "09:00")).toBe(12 * HOUR);
  });
  it("returns 8h for 08:00 → 16:00 (same day)", () => {
    expect(windowToTargetMs("08:00", "16:00")).toBe(8 * HOUR);
  });
  it("returns 23h for 09:00 → 08:00 (just shy of full day)", () => {
    expect(windowToTargetMs("09:00", "08:00")).toBe(23 * HOUR);
  });
  it("throws when start equals end", () => {
    expect(() => windowToTargetMs("09:00", "09:00")).toThrow();
  });
  it("throws on invalid format", () => {
    expect(() => windowToTargetMs("nope", "09:00")).toThrow();
  });
});

describe("elapsedMs", () => {
  it("returns 0 when now equals startedAt", () => {
    expect(elapsedMs(1000, 1000)).toBe(0);
  });
  it("returns 0 (clamped) when now is before startedAt", () => {
    expect(elapsedMs(2000, 1000)).toBe(0);
  });
  it("returns the difference for normal case", () => {
    expect(elapsedMs(1000, 5000)).toBe(4000);
  });
});

describe("progress", () => {
  it("returns 0 for elapsed=0", () => {
    expect(progress(0, 12 * HOUR)).toBe(0);
  });
  it("returns 0.5 for half-target", () => {
    expect(progress(6 * HOUR, 12 * HOUR)).toBe(0.5);
  });
  it("returns 1 at exactly target", () => {
    expect(progress(12 * HOUR, 12 * HOUR)).toBe(1);
  });
  it("returns >1 when over", () => {
    expect(progress(15 * HOUR, 12 * HOUR)).toBe(1.25);
  });
  it("throws on non-positive target", () => {
    expect(() => progress(1000, 0)).toThrow();
  });
});

describe("formatDuration", () => {
  it("formats 5h exactly", () => {
    expect(formatDuration(5 * HOUR)).toBe("5:00");
  });
  it("formats 5h 7m", () => {
    expect(formatDuration(5 * HOUR + 7 * 60 * 1000)).toBe("5:07");
  });
  it("formats 0 as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
  it("clamps negative to 0:00", () => {
    expect(formatDuration(-1000)).toBe("0:00");
  });
  it("formats 13h 12m", () => {
    expect(formatDuration(13 * HOUR + 12 * 60 * 1000)).toBe("13:12");
  });
});

describe("formatTimeOfDay", () => {
  it("formats a known epoch in local 12h time", () => {
    // Use any epoch and only check shape; we cannot assert exact value due to local tz.
    const out = formatTimeOfDay(Date.now());
    expect(out).toMatch(/^\d{1,2}:\d{2}(am|pm)$/);
  });
  it("renders 12-hour cycle correctly for noon", () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    expect(formatTimeOfDay(d.getTime())).toBe("12:00pm");
  });
  it("renders 12-hour cycle correctly for midnight", () => {
    const d = new Date();
    d.setHours(0, 5, 0, 0);
    expect(formatTimeOfDay(d.getTime())).toBe("12:05am");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: Vitest fails — "Failed to resolve import '../src/fastingMath'" or similar.

- [ ] **Step 3: Implement `src/fastingMath.ts`**

```ts
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

export { HOUR_MS, MIN_MS };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All `fastingMath` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fastingMath.ts tests/fastingMath.test.ts
git commit -m "feat: add fastingMath pure functions with tests"
```

---

## Task 3: `storage` module (TDD)

**Files:**
- Test: `tests/storage.test.ts`
- Create: `src/storage.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { storage, type Settings, type ActiveFast, type LastFast } from "../src/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("settings", () => {
  it("returns null when not set", () => {
    expect(storage.loadSettings()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: Settings = { windowStart: "21:00", windowEnd: "09:00" };
    storage.saveSettings(v);
    expect(storage.loadSettings()).toEqual(v);
  });
  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem("ft.settings", "{not json");
    expect(storage.loadSettings()).toBeNull();
  });
  it("returns null when stored value has wrong shape", () => {
    localStorage.setItem("ft.settings", JSON.stringify({ foo: "bar" }));
    expect(storage.loadSettings()).toBeNull();
  });
});

describe("activeFast", () => {
  it("returns null when not set", () => {
    expect(storage.loadActiveFast()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: ActiveFast = { startedAt: 1700000000000, targetMs: 12 * 3600 * 1000 };
    storage.saveActiveFast(v);
    expect(storage.loadActiveFast()).toEqual(v);
  });
  it("clears when saved as null", () => {
    storage.saveActiveFast({ startedAt: 1, targetMs: 1 });
    storage.saveActiveFast(null);
    expect(storage.loadActiveFast()).toBeNull();
  });
  it("returns null when stored value has wrong shape", () => {
    localStorage.setItem("ft.activeFast", JSON.stringify({ startedAt: "x" }));
    expect(storage.loadActiveFast()).toBeNull();
  });
});

describe("lastFast", () => {
  it("returns null when not set", () => {
    expect(storage.loadLastFast()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: LastFast = { startedAt: 1, endedAt: 2, targetMs: 3 };
    storage.saveLastFast(v);
    expect(storage.loadLastFast()).toEqual(v);
  });
  it("returns null when missing fields", () => {
    localStorage.setItem("ft.lastFast", JSON.stringify({ startedAt: 1, endedAt: 2 }));
    expect(storage.loadLastFast()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: "Failed to resolve import '../src/storage'".

- [ ] **Step 3: Implement `src/storage.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All `storage` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: add typed localStorage wrapper with validation"
```

---

## Task 4: `store` module (TDD)

**Files:**
- Test: `tests/store.test.ts`
- Create: `src/store.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/store.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createStore } from "../src/store";

describe("createStore", () => {
  it("returns the initial state from get()", () => {
    const s = createStore({ n: 1 });
    expect(s.get()).toEqual({ n: 1 });
  });
  it("set(value) replaces state", () => {
    const s = createStore({ n: 1 });
    s.set({ n: 2 });
    expect(s.get()).toEqual({ n: 2 });
  });
  it("set(fn) updates from previous", () => {
    const s = createStore({ n: 1 });
    s.set((prev) => ({ n: prev.n + 1 }));
    expect(s.get()).toEqual({ n: 2 });
  });
  it("notifies subscribers on change", () => {
    const s = createStore({ n: 1 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ n: 2 });
  });
  it("does not notify when value is referentially identical", () => {
    const initial = { n: 1 };
    const s = createStore(initial);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(initial);
    expect(fn).not.toHaveBeenCalled();
  });
  it("unsubscribe stops further notifications", () => {
    const s = createStore({ n: 1 });
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    unsub();
    s.set({ n: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: "Failed to resolve import '../src/store'".

- [ ] **Step 3: Implement `src/store.ts`**

```ts
export type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(updater: T | ((prev: T) => T)): void;
  subscribe(fn: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(state)
          : updater;
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((l) => l(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All `store` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store.ts tests/store.test.ts
git commit -m "feat: add minimal reactive store"
```

---

## Task 5: `Dial` component

**Files:**
- Create: `src/components/Dial.ts`

Pure SVG render: track ring + progress arc + (over-fast overlap arc) + center text. Driven by props `{ elapsedMs, targetMs }`.

- [ ] **Step 1: Create `src/components/Dial.ts`**

```ts
import { formatDuration } from "../fastingMath";

export type DialProps = {
  elapsedMs: number;
  targetMs: number;
};

type DialHandle = { update(props: DialProps): void };

const R = 88;
const STROKE = 14;
const VIEW = 110;

/**
 * Describe an SVG arc path from `startAngle` to `endAngle` (degrees, 0 = top, clockwise).
 * Caller guarantees the arc length is <= 360°.
 */
function arcPath(startAngle: number, endAngle: number, radius = R): string {
  const span = Math.max(0, Math.min(360, endAngle - startAngle));
  if (span <= 0) return "";
  const start = polar(startAngle, radius);
  const end = polar(startAngle + span, radius);
  const largeArc = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  // 0deg = top, clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

export function mount(parent: HTMLElement, initial: DialProps): DialHandle {
  const wrap = document.createElement("div");
  wrap.className = "dial-wrap";
  wrap.innerHTML = `
    <svg viewBox="-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}" role="img" aria-label="fasting progress">
      <circle data-track cx="0" cy="0" r="${R}" fill="none" stroke="var(--track)" stroke-width="${STROKE}"/>
      <path data-progress fill="none" stroke="var(--primary)" stroke-width="${STROKE}" stroke-linecap="round"/>
      <path data-overlap fill="none" stroke="var(--warning)" stroke-width="${STROKE}" stroke-linecap="round"/>
      <g data-labels font-size="11" fill="var(--text-faint)" font-family="ui-monospace,Menlo,monospace" text-anchor="middle"></g>
      <text data-time x="0" y="-4" font-size="28" fill="var(--text)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace" font-weight="600"></text>
      <text data-sub x="0" y="18" font-size="11" fill="var(--text-dim)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace"></text>
      <text data-sub2 x="0" y="36" font-size="11" fill="var(--primary)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace"></text>
    </svg>`;
  parent.appendChild(wrap);

  const svg = wrap.querySelector("svg")!;
  const trackEl = svg.querySelector<SVGCircleElement>("[data-track]")!;
  const progressEl = svg.querySelector<SVGPathElement>("[data-progress]")!;
  const overlapEl = svg.querySelector<SVGPathElement>("[data-overlap]")!;
  const labelsEl = svg.querySelector<SVGGElement>("[data-labels]")!;
  const timeEl = svg.querySelector<SVGTextElement>("[data-time]")!;
  const subEl = svg.querySelector<SVGTextElement>("[data-sub]")!;
  const sub2El = svg.querySelector<SVGTextElement>("[data-sub2]")!;

  function renderLabels(targetMs: number) {
    const hours = Math.round(targetMs / 3600000);
    const quarters = [
      { label: `0h`, x: 0, y: -R - 16 },
      { label: `${Math.round(hours / 4)}h`, x: R + 18, y: 4 },
      { label: `${Math.round(hours / 2)}h`, x: 0, y: R + 22 },
      { label: `${Math.round((3 * hours) / 4)}h`, x: -R - 18, y: 4 },
    ];
    labelsEl.innerHTML = quarters
      .map((q) => `<text x="${q.x}" y="${q.y}">${q.label}</text>`)
      .join("");
  }

  function update(props: DialProps) {
    const { elapsedMs, targetMs } = props;
    const p = targetMs > 0 ? elapsedMs / targetMs : 0;

    renderLabels(targetMs);

    if (p < 1) {
      // mid-fast: arc 0..360deg
      progressEl.setAttribute("stroke", "var(--primary)");
      progressEl.setAttribute("d", arcPath(0, p * 360));
      overlapEl.setAttribute("d", "");
      trackEl.setAttribute("stroke", "var(--track)");
      trackEl.setAttribute("opacity", "1");

      timeEl.textContent = formatDuration(elapsedMs);
      subEl.textContent = "elapsed";
      sub2El.setAttribute("fill", "var(--primary)");
      sub2El.textContent = `${formatDuration(targetMs - elapsedMs)} to go`;
    } else {
      // goal reached or over: full base ring in success
      progressEl.setAttribute("stroke", "var(--success)");
      // draw the full circle as a near-360 arc (avoid 0-length zero-arc rendering)
      progressEl.setAttribute("d", arcPath(0, 359.99));
      progressEl.setAttribute("opacity", p > 1 ? "0.45" : "1");
      trackEl.setAttribute("stroke", "var(--track)");

      const overspan = Math.min(1, p - 1); // cap at one extra revolution
      if (overspan > 0) {
        overlapEl.setAttribute("d", arcPath(0, overspan * 360));
        overlapEl.setAttribute("opacity", "1");
      } else {
        overlapEl.setAttribute("d", "");
      }

      timeEl.textContent = formatDuration(elapsedMs);
      subEl.textContent = p > 1 ? "elapsed" : "goal reached";
      if (p > 1) {
        sub2El.setAttribute("fill", "var(--warning)");
        sub2El.textContent = `+${formatDuration(elapsedMs - targetMs)} over`;
      } else {
        sub2El.setAttribute("fill", "var(--success)");
        sub2El.textContent = "✓";
      }
    }
  }

  update(initial);
  return { update };
}
```

- [ ] **Step 2: Wire a temporary preview into `src/main.ts`**

Replace `src/main.ts`:

```ts
import "./styles.css";
import { mount as mountDial } from "./components/Dial";

const root = document.getElementById("app")!;
root.innerHTML = `<div class="header"><h1>FASTING TIMER</h1></div>`;

const dial = mountDial(root, { elapsedMs: 5 * 3600 * 1000, targetMs: 12 * 3600 * 1000 });

// Quick state cycle for visual verification:
let n = 5;
(window as any).cycle = () => {
  n = (n + 3) % 26;
  dial.update({ elapsedMs: n * 3600 * 1000, targetMs: 12 * 3600 * 1000 });
  console.log(`elapsed: ${n}h`);
};
console.log("Run window.cycle() to advance the dial");
```

- [ ] **Step 3: Visually verify in dev**

```bash
npm run dev
```

Open the page. Should show a dial reading "5:00 / elapsed / 7:00 to go" with a partial blue arc. In devtools console, call `window.cycle()` repeatedly — verify:
- 8h → arc grows past 180°
- 11h → arc nearly full
- 14h → green base + red overlap arc, "+2:00 over"
- 23h → red overlap nearly full
- 26h → red overlap locked at full

Stop dev server.

- [ ] **Step 4: Revert the preview wiring in `src/main.ts`**

Restore minimal version:

```ts
import "./styles.css";

const root = document.getElementById("app")!;
root.innerHTML = `<div class="header"><h1>FASTING TIMER</h1></div>`;
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Dial.ts src/main.ts
git commit -m "feat: add Dial component with mid-fast, goal, and overlap states"
```

---

## Task 6: `MetaRow` component

**Files:**
- Create: `src/components/MetaRow.ts`

- [ ] **Step 1: Create `src/components/MetaRow.ts`**

```ts
import { formatTimeOfDay } from "../fastingMath";

export type MetaRowProps = {
  startedAt: number;
  goalAt: number;
  onEditStart: () => void;
};

type MetaRowHandle = { update(props: Omit<MetaRowProps, "onEditStart">): void };

export function mount(parent: HTMLElement, initial: MetaRowProps): MetaRowHandle {
  const row = document.createElement("div");
  row.className = "meta-row";
  row.innerHTML = `
    <div>
      <div class="meta-label">STARTED</div>
      <button class="meta-val" data-start></button>
    </div>
    <div style="text-align:right">
      <div class="meta-label">GOAL</div>
      <div class="meta-val" data-goal></div>
    </div>`;
  parent.appendChild(row);

  const startBtn = row.querySelector<HTMLButtonElement>("[data-start]")!;
  const goalEl = row.querySelector<HTMLDivElement>("[data-goal]")!;
  startBtn.addEventListener("click", initial.onEditStart);

  function update(props: Omit<MetaRowProps, "onEditStart">) {
    startBtn.textContent = formatTimeOfDay(props.startedAt);
    goalEl.textContent = formatTimeOfDay(props.goalAt);
  }

  update(initial);
  return { update };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MetaRow.ts
git commit -m "feat: add MetaRow component"
```

---

## Task 7: `Controls` component

**Files:**
- Create: `src/components/Controls.ts`

- [ ] **Step 1: Create `src/components/Controls.ts`**

```ts
import { formatDuration } from "../fastingMath";

export type ControlsProps = {
  active: boolean;
  lastFastDurationMs: number | null;
  onStart: () => void;
  onEnd: () => void;
};

type ControlsHandle = { update(props: Omit<ControlsProps, "onStart" | "onEnd">): void };

export function mount(parent: HTMLElement, initial: ControlsProps): ControlsHandle {
  const wrap = document.createElement("div");
  wrap.className = "controls";
  wrap.innerHTML = `
    <button class="btn-primary" data-btn></button>
    <div class="last-fast" data-last hidden></div>`;
  parent.appendChild(wrap);

  const btn = wrap.querySelector<HTMLButtonElement>("[data-btn]")!;
  const lastEl = wrap.querySelector<HTMLDivElement>("[data-last]")!;

  btn.addEventListener("click", () => {
    if (btn.dataset.mode === "start") initial.onStart();
    else initial.onEnd();
  });

  function update(props: Omit<ControlsProps, "onStart" | "onEnd">) {
    if (props.active) {
      btn.textContent = "End fast";
      btn.classList.add("danger");
      btn.dataset.mode = "end";
      lastEl.hidden = true;
    } else {
      btn.textContent = "Start fast";
      btn.classList.remove("danger");
      btn.dataset.mode = "start";
      if (props.lastFastDurationMs != null) {
        lastEl.textContent = `Last fast: ${formatDuration(props.lastFastDurationMs)}`;
        lastEl.hidden = false;
      } else {
        lastEl.hidden = true;
      }
    }
  }

  update(initial);
  return { update };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Controls.ts
git commit -m "feat: add Controls component"
```

---

## Task 8: `SettingsSheet` component

**Files:**
- Create: `src/components/SettingsSheet.ts`

A modal sheet with two `<input type="time">` fields. Validates that start != end. Resolves on confirm or cancel.

- [ ] **Step 1: Create `src/components/SettingsSheet.ts`**

```ts
import type { Settings } from "../storage";

export type OpenSettingsParams = {
  initial: Settings;
  /** When false, the backdrop click and Cancel button are disabled (first-launch). */
  dismissible?: boolean;
};

/** Returns a Promise resolving to the saved settings, or null if cancelled. */
export function openSettingsSheet(params: OpenSettingsParams): Promise<Settings | null> {
  const { initial, dismissible = true } = params;

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>Fasting window</h2>
        <label>
          Window start
          <input type="time" data-start value="${initial.windowStart}" required />
        </label>
        <label>
          Window end
          <input type="time" data-end value="${initial.windowEnd}" required />
        </label>
        <div class="error" data-error></div>
        <div class="sheet-actions">
          <button class="btn-cancel" data-cancel ${dismissible ? "" : "hidden"}>Cancel</button>
          <button class="btn-save" data-save>Save</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const startInput = backdrop.querySelector<HTMLInputElement>("[data-start]")!;
    const endInput = backdrop.querySelector<HTMLInputElement>("[data-end]")!;
    const errorEl = backdrop.querySelector<HTMLDivElement>("[data-error]")!;
    const saveBtn = backdrop.querySelector<HTMLButtonElement>("[data-save]")!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>("[data-cancel]")!;

    function close(result: Settings | null) {
      backdrop.remove();
      resolve(result);
    }

    saveBtn.addEventListener("click", () => {
      const windowStart = startInput.value;
      const windowEnd = endInput.value;
      if (!windowStart || !windowEnd) {
        errorEl.textContent = "Please enter both times.";
        return;
      }
      if (windowStart === windowEnd) {
        errorEl.textContent = "Start and end must differ.";
        return;
      }
      close({ windowStart, windowEnd });
    });

    if (dismissible) {
      cancelBtn.addEventListener("click", () => close(null));
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(null);
      });
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsSheet.ts
git commit -m "feat: add SettingsSheet modal"
```

---

## Task 9: `EditStartSheet` component

**Files:**
- Create: `src/components/EditStartSheet.ts`

- [ ] **Step 1: Create `src/components/EditStartSheet.ts`**

Convert between epoch ms and the `datetime-local` string format `YYYY-MM-DDTHH:mm`.

```ts
function toLocalInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(s: string): number | null {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Returns the new startedAt (epoch ms) or null on cancel. */
export function openEditStartSheet(currentStartedAt: number): Promise<number | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>Edit start time</h2>
        <label>
          Started at
          <input type="datetime-local" data-input value="${toLocalInputValue(currentStartedAt)}" />
        </label>
        <div class="error" data-error></div>
        <div class="sheet-actions">
          <button class="btn-cancel" data-cancel>Cancel</button>
          <button class="btn-save" data-save>Save</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector<HTMLInputElement>("[data-input]")!;
    const errorEl = backdrop.querySelector<HTMLDivElement>("[data-error]")!;
    const saveBtn = backdrop.querySelector<HTMLButtonElement>("[data-save]")!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>("[data-cancel]")!;

    function close(result: number | null) {
      backdrop.remove();
      resolve(result);
    }

    saveBtn.addEventListener("click", () => {
      const t = fromLocalInputValue(input.value);
      if (t == null) {
        errorEl.textContent = "Invalid date.";
        return;
      }
      if (t > Date.now()) {
        errorEl.textContent = "Start time can't be in the future.";
        return;
      }
      close(t);
    });
    cancelBtn.addEventListener("click", () => close(null));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EditStartSheet.ts
git commit -m "feat: add EditStartSheet modal"
```

---

## Task 10: `EndConfirmSheet` component

**Files:**
- Create: `src/components/EndConfirmSheet.ts`

- [ ] **Step 1: Create `src/components/EndConfirmSheet.ts`**

```ts
function toLocalInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(s: string): number | null {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export type EndConfirmParams = {
  startedAt: number;
};

/** Returns the chosen endedAt (epoch ms) or null on cancel. */
export function openEndConfirmSheet(params: EndConfirmParams): Promise<number | null> {
  const { startedAt } = params;
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>End fast</h2>
        <label>
          Ended at
          <input type="datetime-local" data-input value="${toLocalInputValue(Date.now())}" />
        </label>
        <div class="error" data-error></div>
        <div class="sheet-actions">
          <button class="btn-cancel" data-cancel>Cancel</button>
          <button class="btn-save" data-save>Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector<HTMLInputElement>("[data-input]")!;
    const errorEl = backdrop.querySelector<HTMLDivElement>("[data-error]")!;
    const saveBtn = backdrop.querySelector<HTMLButtonElement>("[data-save]")!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>("[data-cancel]")!;

    function close(result: number | null) {
      backdrop.remove();
      resolve(result);
    }

    saveBtn.addEventListener("click", () => {
      const t = fromLocalInputValue(input.value);
      if (t == null) {
        errorEl.textContent = "Invalid date.";
        return;
      }
      if (t < startedAt) {
        errorEl.textContent = "End time can't be before start.";
        return;
      }
      close(t);
    });
    cancelBtn.addEventListener("click", () => close(null));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EndConfirmSheet.ts
git commit -m "feat: add EndConfirmSheet modal"
```

---

## Task 11: Wire it all together in `main.ts`

**Files:**
- Modify: `src/main.ts`

This task assembles state, tick loop, first-launch flow, and the state machine.

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import "./styles.css";
import { createStore } from "./store";
import { storage, type Settings, type ActiveFast, type LastFast } from "./storage";
import {
  windowToTargetMs,
  elapsedMs as computeElapsed,
} from "./fastingMath";
import { mount as mountDial } from "./components/Dial";
import { mount as mountMetaRow } from "./components/MetaRow";
import { mount as mountControls } from "./components/Controls";
import { openSettingsSheet } from "./components/SettingsSheet";
import { openEditStartSheet } from "./components/EditStartSheet";
import { openEndConfirmSheet } from "./components/EndConfirmSheet";

type AppState = {
  settings: Settings;
  activeFast: ActiveFast | null;
  lastFast: LastFast | null;
  now: number;
};

const DEFAULT_SETTINGS: Settings = { windowStart: "21:00", windowEnd: "09:00" };

async function bootstrap() {
  const root = document.getElementById("app")!;

  // Header
  root.innerHTML = `
    <div class="header">
      <h1>FASTING TIMER</h1>
      <button class="icon-btn" data-gear aria-label="Settings">⚙</button>
    </div>`;
  const gearBtn = root.querySelector<HTMLButtonElement>("[data-gear]")!;

  // Mounting container for the body (everything below header)
  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:14px;";
  root.appendChild(body);

  // Load or default settings; first-launch opens settings sheet (non-dismissible)
  let settings = storage.loadSettings();
  if (settings == null) {
    const result = await openSettingsSheet({ initial: DEFAULT_SETTINGS, dismissible: false });
    settings = result ?? DEFAULT_SETTINGS;
    storage.saveSettings(settings);
  }

  const store = createStore<AppState>({
    settings,
    activeFast: storage.loadActiveFast(),
    lastFast: storage.loadLastFast(),
    now: Date.now(),
  });

  // Mount the variable section that re-renders on state change
  const variable = document.createElement("div");
  variable.style.cssText = "display:flex;flex-direction:column;gap:14px;";
  body.appendChild(variable);

  type Mounted = {
    dial?: { update(p: { elapsedMs: number; targetMs: number }): void };
    meta?: { update(p: { startedAt: number; goalAt: number }): void };
    controls?: { update(p: { active: boolean; lastFastDurationMs: number | null }): void };
    mode: "idle" | "active" | "uninit";
  };
  const mounted: Mounted = { mode: "uninit" };

  function rebuild(state: AppState) {
    variable.innerHTML = "";
    if (state.activeFast) {
      const { startedAt, targetMs } = state.activeFast;
      const dial = mountDial(variable, {
        elapsedMs: computeElapsed(startedAt, state.now),
        targetMs,
      });
      const meta = mountMetaRow(variable, {
        startedAt,
        goalAt: startedAt + targetMs,
        onEditStart: handleEditStart,
      });
      const controls = mountControls(variable, {
        active: true,
        lastFastDurationMs: null,
        onStart: handleStart,
        onEnd: handleEnd,
      });
      mounted.dial = dial;
      mounted.meta = meta;
      mounted.controls = controls;
      mounted.mode = "active";
    } else {
      // Idle: show an inert "preview" dial at 0/target and the Start button
      const targetMs = windowToTargetMs(state.settings.windowStart, state.settings.windowEnd);
      const dial = mountDial(variable, { elapsedMs: 0, targetMs });
      const controls = mountControls(variable, {
        active: false,
        lastFastDurationMs: state.lastFast ? state.lastFast.endedAt - state.lastFast.startedAt : null,
        onStart: handleStart,
        onEnd: handleEnd,
      });
      mounted.dial = dial;
      mounted.meta = undefined;
      mounted.controls = controls;
      mounted.mode = "idle";
    }
  }

  function applyTick(state: AppState) {
    if (state.activeFast && mounted.mode === "active" && mounted.dial && mounted.meta) {
      mounted.dial.update({
        elapsedMs: computeElapsed(state.activeFast.startedAt, state.now),
        targetMs: state.activeFast.targetMs,
      });
      mounted.meta.update({
        startedAt: state.activeFast.startedAt,
        goalAt: state.activeFast.startedAt + state.activeFast.targetMs,
      });
    }
  }

  function reactToStructuralChange(prev: AppState, next: AppState) {
    const wasActive = !!prev.activeFast;
    const isActive = !!next.activeFast;
    const settingsChanged =
      prev.settings.windowStart !== next.settings.windowStart ||
      prev.settings.windowEnd !== next.settings.windowEnd;
    const activeIdChanged = prev.activeFast?.startedAt !== next.activeFast?.startedAt;
    if (wasActive !== isActive || activeIdChanged || (!isActive && settingsChanged) || (!isActive && prev.lastFast !== next.lastFast)) {
      rebuild(next);
    }
  }

  let prev = store.get();
  rebuild(prev);
  applyTick(prev);

  store.subscribe((next) => {
    reactToStructuralChange(prev, next);
    applyTick(next);
    prev = next;
  });

  // Tick loop
  setInterval(() => {
    store.set((s) => ({ ...s, now: Date.now() }));
  }, 1000);

  // Re-sync on visibility / focus (background-throttled tabs)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      store.set((s) => ({ ...s, now: Date.now() }));
    }
  });
  window.addEventListener("focus", () => {
    store.set((s) => ({ ...s, now: Date.now() }));
  });

  // ---- Handlers ----

  function handleStart() {
    const s = store.get();
    const targetMs = windowToTargetMs(s.settings.windowStart, s.settings.windowEnd);
    const fast: ActiveFast = { startedAt: Date.now(), targetMs };
    storage.saveActiveFast(fast);
    store.set({ ...s, activeFast: fast, now: Date.now() });
  }

  async function handleEnd() {
    const s = store.get();
    if (!s.activeFast) return;
    const endedAt = await openEndConfirmSheet({ startedAt: s.activeFast.startedAt });
    if (endedAt == null) return;
    const last: LastFast = {
      startedAt: s.activeFast.startedAt,
      endedAt,
      targetMs: s.activeFast.targetMs,
    };
    storage.saveLastFast(last);
    storage.saveActiveFast(null);
    store.set({ ...s, activeFast: null, lastFast: last, now: Date.now() });
  }

  async function handleEditStart() {
    const s = store.get();
    if (!s.activeFast) return;
    const newStartedAt = await openEditStartSheet(s.activeFast.startedAt);
    if (newStartedAt == null) return;
    const updated: ActiveFast = { ...s.activeFast, startedAt: newStartedAt };
    storage.saveActiveFast(updated);
    store.set({ ...s, activeFast: updated, now: Date.now() });
  }

  // Gear → settings sheet
  gearBtn.addEventListener("click", async () => {
    const s = store.get();
    const result = await openSettingsSheet({ initial: s.settings });
    if (!result) return;
    storage.saveSettings(result);
    store.set({ ...s, settings: result });
  });
}

bootstrap();
```

- [ ] **Step 2: Manually verify the full flow in dev**

```bash
npm run dev
```

Open page in browser. Run through these checks in order:

1. **First launch:** SettingsSheet appears with `21:00` / `09:00` pre-filled and no Cancel button. Hit Save → sheet closes, "Start fast" button visible.
2. **Set a short window for testing:** click gear icon, change to `00:00` / `00:01` (one minute), Save. Reload page. Confirm dial shows 1m target.
3. **Start a fast:** click "Start fast." Dial flips to active, ticking elapsed time. MetaRow shows STARTED/GOAL times. Page reload mid-fast: state persists.
4. **Wait past target (≥ 1 minute):** verify dial transitions to green base + red overlap arc, "+X:XX over" text appears.
5. **Edit start time:** tap the STARTED time. Picker opens with current value. Set to 30 minutes ago. Save. Dial elapsed jumps forward 30 min.
6. **Edit-start rejects future:** open picker, set to far-future time, Save. Error "Start time can't be in the future." Cancel.
7. **End the fast:** tap "End fast." Picker prefilled with now. Confirm. App returns to idle, "Last fast: …" line appears below Start button.
8. **End-rejects pre-start:** start another fast, immediately end, set end time to before start, Save → error.
9. **Settings change mid-fast:** during an active fast, open settings, change window. Save. Verify the active dial's targetMs/goal is unchanged (snapshot semantics).
10. **Clear storage** via devtools to reset to a clean state.

Fix any visual or behavior bug before committing.

- [ ] **Step 3: Run type-check + tests**

```bash
npm run build
npm test
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire components, state machine, and first-launch flow"
```

---

## Task 12: GitHub Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add github pages deploy workflow"
```

- [ ] **Step 3: Create the GitHub repo and push (user step)**

Tell the user to:

1. Create an empty public repo at `https://github.com/nokki34/fasting-timer`.
2. Add the remote and push:

```bash
git remote add origin https://github.com/nokki34/fasting-timer.git
git push -u origin main
```

3. In the repo's Settings → Pages, set Source to "GitHub Actions."
4. Wait for the Action to complete; the site will be live at `https://nokki34.github.io/fasting-timer/`.

If the URL 404s on first deploy, verify the `base` in `vite.config.ts` matches the repo name exactly (case-sensitive).

---

## Done

When all tasks are checked off, the app is feature-complete per the spec and live on GitHub Pages. The codebase is small enough that future additions (history view, notifications) plug in by adding a new component plus a new storage slice.
