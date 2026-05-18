# Strict start & smarter end picker — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Start button snap `startedAt` to the most recent past occurrence of the planned `windowStart`, and make the End sheet show a time-only picker when the planned end is on today's local calendar date.

**Architecture:** Three new pure helpers in `src/fastingMath.ts` (`plannedStartFor`, `sameLocalYMD`, `combineTimeWithDate`), wired into `main.ts` and `EndConfirmSheet.ts`. No storage, dial, or settings changes. Spec: `docs/superpowers/specs/2026-05-18-strict-start-and-end-picker-design.md`.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest (jsdom).

**Convention notes for the implementer:**
- Strict TS — no unused locals, no implicit returns.
- `npm test` runs the full suite once. Use `npm test -- tests/fastingMath.test.ts -t "name"` to run one test.
- Commit messages use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`). Always append:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- Keep new code consistent with existing style in `fastingMath.ts` (small pure functions, named constants, throw on programmer-error inputs unless the function explicitly returns `null` for user input).

---

## File map

- **Modify** `src/fastingMath.ts` — add three exported helpers.
- **Modify** `tests/fastingMath.test.ts` — add `describe` blocks for the three new helpers.
- **Modify** `src/main.ts:160-166` (`handleStart`) and `src/main.ts:168-183` (`handleEnd`).
- **Modify** `src/components/EndConfirmSheet.ts` — extend `EndConfirmParams`, branch on picker mode.

---

## Task 1: `plannedStartFor` helper

**Files:**
- Modify: `src/fastingMath.ts`
- Test: `tests/fastingMath.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/fastingMath.test.ts`:

```ts
describe("plannedStartFor", () => {
  it("returns today's planned time when now is after it", () => {
    const now = new Date();
    now.setHours(21, 7, 0, 0); // 21:07 today
    const expected = new Date(now);
    expected.setHours(21, 0, 0, 0); // 21:00 today
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(expected.getTime());
  });
  it("returns yesterday's planned time when now is before today's", () => {
    const now = new Date();
    now.setHours(20, 55, 0, 0); // 20:55 today, windowStart 21:00
    const expected = new Date(now);
    expected.setHours(21, 0, 0, 0); // 21:00 today
    const yesterday = expected.getTime() - 24 * 60 * 60 * 1000;
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(yesterday);
  });
  it("returns today's planned time when now exactly equals it", () => {
    const now = new Date();
    now.setHours(21, 0, 0, 0);
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(now.getTime());
  });
  it("parses leading-zero hour correctly", () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const expected = new Date(now);
    expected.setHours(9, 0, 0, 0);
    expect(plannedStartFor(now.getTime(), "09:00")).toBe(expected.getTime());
  });
});
```

Also add `plannedStartFor` to the import statement at the top of the test file:

```ts
import {
  windowToTargetMs,
  elapsedMs,
  progress,
  formatDuration,
  formatTimeOfDay,
  plannedStartFor,
} from "../src/fastingMath";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/fastingMath.test.ts -t "plannedStartFor"`
Expected: FAIL with a TypeScript error or "plannedStartFor is not a function" (import resolution will block the run; that's the failing state).

- [ ] **Step 3: Implement `plannedStartFor`**

Append to `src/fastingMath.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/fastingMath.test.ts -t "plannedStartFor"`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fastingMath.ts tests/fastingMath.test.ts
git commit -m "$(cat <<'EOF'
feat(fastingMath): add plannedStartFor for strict-start snapping

Snaps a timestamp to the most recent past occurrence of an "HH:mm"
window start in local time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `sameLocalYMD` helper

**Files:**
- Modify: `src/fastingMath.ts`
- Test: `tests/fastingMath.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/fastingMath.test.ts`:

```ts
describe("sameLocalYMD", () => {
  it("returns true for two times on the same local day", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const evening = new Date(morning);
    evening.setHours(22, 30, 0, 0);
    expect(sameLocalYMD(morning.getTime(), evening.getTime())).toBe(true);
  });
  it("returns false across local midnight (1ms apart)", () => {
    const justBefore = new Date();
    justBefore.setHours(23, 59, 59, 999);
    const justAfter = justBefore.getTime() + 1;
    expect(sameLocalYMD(justBefore.getTime(), justAfter)).toBe(false);
  });
  it("returns true for identical timestamps", () => {
    const t = Date.now();
    expect(sameLocalYMD(t, t)).toBe(true);
  });
});
```

Add `sameLocalYMD` to the import statement:

```ts
import {
  windowToTargetMs,
  elapsedMs,
  progress,
  formatDuration,
  formatTimeOfDay,
  plannedStartFor,
  sameLocalYMD,
} from "../src/fastingMath";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/fastingMath.test.ts -t "sameLocalYMD"`
Expected: FAIL — `sameLocalYMD` not exported.

- [ ] **Step 3: Implement `sameLocalYMD`**

Append to `src/fastingMath.ts`:

```ts
export function sameLocalYMD(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/fastingMath.test.ts -t "sameLocalYMD"`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fastingMath.ts tests/fastingMath.test.ts
git commit -m "$(cat <<'EOF'
feat(fastingMath): add sameLocalYMD calendar-date comparator

Used by the end sheet to decide between time-only and datetime-local
picker modes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `combineTimeWithDate` helper

**Files:**
- Modify: `src/fastingMath.ts`
- Test: `tests/fastingMath.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/fastingMath.test.ts`:

```ts
describe("combineTimeWithDate", () => {
  it("returns a timestamp on the anchor's date with the given time", () => {
    const anchor = new Date();
    anchor.setHours(15, 30, 0, 0);
    const result = combineTimeWithDate("09:15", anchor.getTime());
    expect(result).not.toBeNull();
    const r = new Date(result!);
    expect(r.getFullYear()).toBe(anchor.getFullYear());
    expect(r.getMonth()).toBe(anchor.getMonth());
    expect(r.getDate()).toBe(anchor.getDate());
    expect(r.getHours()).toBe(9);
    expect(r.getMinutes()).toBe(15);
    expect(r.getSeconds()).toBe(0);
    expect(r.getMilliseconds()).toBe(0);
  });
  it("handles 00:00 boundary", () => {
    const anchor = Date.now();
    const result = combineTimeWithDate("00:00", anchor);
    expect(result).not.toBeNull();
    const r = new Date(result!);
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
  });
  it("handles 23:59 boundary", () => {
    const anchor = Date.now();
    const result = combineTimeWithDate("23:59", anchor);
    expect(result).not.toBeNull();
    const r = new Date(result!);
    expect(r.getHours()).toBe(23);
    expect(r.getMinutes()).toBe(59);
  });
  it("returns null on garbage input", () => {
    expect(combineTimeWithDate("nope", Date.now())).toBeNull();
    expect(combineTimeWithDate("", Date.now())).toBeNull();
    expect(combineTimeWithDate("99:99", Date.now())).toBeNull();
    expect(combineTimeWithDate("12", Date.now())).toBeNull();
  });
});
```

Add `combineTimeWithDate` to the import statement:

```ts
import {
  windowToTargetMs,
  elapsedMs,
  progress,
  formatDuration,
  formatTimeOfDay,
  plannedStartFor,
  sameLocalYMD,
  combineTimeWithDate,
} from "../src/fastingMath";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/fastingMath.test.ts -t "combineTimeWithDate"`
Expected: FAIL — `combineTimeWithDate` not exported.

- [ ] **Step 3: Implement `combineTimeWithDate`**

Append to `src/fastingMath.ts`:

```ts
export function combineTimeWithDate(timeStr: string, dateAnchorMs: number): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const d = new Date(dateAnchorMs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
```

(Note: we duplicate the HH:mm regex rather than reusing the private `parseHHmm` because `combineTimeWithDate` must return `null` on invalid user input, whereas `parseHHmm` throws on programmer error. Keep that distinction intact.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/fastingMath.test.ts -t "combineTimeWithDate"`
Expected: All 4 tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: All tests PASS (existing + 11 new).

- [ ] **Step 6: Commit**

```bash
git add src/fastingMath.ts tests/fastingMath.test.ts
git commit -m "$(cat <<'EOF'
feat(fastingMath): add combineTimeWithDate

Combines an "HH:mm" string with the local Y-M-D of an anchor timestamp.
Returns null on invalid input — caller decides how to surface the error.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `plannedStartFor` into `handleStart`

**Files:**
- Modify: `src/main.ts:160-166`

- [ ] **Step 1: Update the import**

In `src/main.ts`, the existing import is:

```ts
import {
  windowToTargetMs,
  elapsedMs as computeElapsed,
} from "./fastingMath";
```

Change it to:

```ts
import {
  windowToTargetMs,
  elapsedMs as computeElapsed,
  plannedStartFor,
} from "./fastingMath";
```

- [ ] **Step 2: Update `handleStart`**

Current code at `src/main.ts:160`:

```ts
function handleStart() {
  const s = store.get();
  const targetMs = windowToTargetMs(s.settings.windowStart, s.settings.windowEnd);
  const fast: ActiveFast = { startedAt: Date.now(), targetMs };
  storage.saveActiveFast(fast);
  store.set({ ...s, activeFast: fast, now: Date.now() });
}
```

Replace with:

```ts
function handleStart() {
  const s = store.get();
  const targetMs = windowToTargetMs(s.settings.windowStart, s.settings.windowEnd);
  const startedAt = plannedStartFor(Date.now(), s.settings.windowStart);
  const fast: ActiveFast = { startedAt, targetMs };
  storage.saveActiveFast(fast);
  store.set({ ...s, activeFast: fast, now: Date.now() });
}
```

- [ ] **Step 3: Type-check and run tests**

Run: `npm run build`
Expected: `tsc --noEmit` passes; Vite build succeeds.

Run: `npm test`
Expected: All tests PASS (no test changes here; this verifies nothing regressed).

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, open http://localhost:5173/fasting-timer/ in a browser:

1. Open settings (gear icon). Confirm `windowStart` (e.g., set to a time a few minutes in the past, like 21:00 if current time is 21:30). Save.
2. If there's an active fast already, end it first (it'll be using old start logic — that's fine).
3. Tap **Start**. Verify the dial's elapsed time matches `now - windowStart`, not zero. Verify the meta row's "Started at" reads the planned `windowStart` time, not the current time.
4. Now temporarily change `windowStart` to a time in the *future* (e.g., 30 min ahead). Save. End the current fast. Tap Start again. Verify `startedAt` is yesterday at the future-of-today time (a ~23-23.5h-old fast).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "$(cat <<'EOF'
feat: snap Start to planned windowStart

Tapping Start now records startedAt at the most recent past occurrence
of windowStart instead of Date.now(). The existing edit-start affordance
on the meta row remains the escape hatch for non-planned starts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: End sheet — time-only picker when planned end is today

**Files:**
- Modify: `src/components/EndConfirmSheet.ts`
- Modify: `src/main.ts:168-183` (`handleEnd`)

- [ ] **Step 1: Extend `EndConfirmSheet` params and branch the picker**

Replace the entire contents of `src/components/EndConfirmSheet.ts` with:

```ts
import { sameLocalYMD, combineTimeWithDate } from "../fastingMath";

function toLocalDateTimeInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalTimeInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInputValue(s: string): number | null {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export type EndConfirmParams = {
  startedAt: number;
  targetMs: number;
};

/** Returns the chosen endedAt (epoch ms) or null on cancel. */
export function openEndConfirmSheet(params: EndConfirmParams): Promise<number | null> {
  const { startedAt, targetMs } = params;
  return new Promise((resolve) => {
    const anchorMs = Date.now();
    const useTimeOnly = sameLocalYMD(anchorMs, startedAt + targetMs);

    const inputType = useTimeOnly ? "time" : "datetime-local";
    const initialValue = useTimeOnly
      ? toLocalTimeInputValue(anchorMs)
      : toLocalDateTimeInputValue(anchorMs);

    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>End fast</h2>
        <label>
          Ended at
          <input type="${inputType}" data-input />
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

    input.value = initialValue;

    function close(result: number | null) {
      backdrop.remove();
      resolve(result);
    }

    saveBtn.addEventListener("click", () => {
      const t = useTimeOnly
        ? combineTimeWithDate(input.value, anchorMs)
        : fromLocalDateTimeInputValue(input.value);
      if (t == null) {
        errorEl.textContent = useTimeOnly ? "Invalid time." : "Invalid date.";
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

Key things to verify after pasting:
- `anchorMs` is captured once at the top of the promise body; nothing reads `Date.now()` after that.
- `useTimeOnly` is computed once from `anchorMs`.
- Input type and initial value are set from the same decision.
- The `Invalid time.` vs `Invalid date.` error matches the input mode.

- [ ] **Step 2: Update `handleEnd` in `src/main.ts:168` to pass `targetMs`**

Current code:

```ts
async function handleEnd() {
  const before = store.get();
  if (!before.activeFast) return;
  const endedAt = await openEndConfirmSheet({ startedAt: before.activeFast.startedAt });
  if (endedAt == null) return;
  ...
}
```

Change the `openEndConfirmSheet` call to include `targetMs`:

```ts
const endedAt = await openEndConfirmSheet({
  startedAt: before.activeFast.startedAt,
  targetMs: before.activeFast.targetMs,
});
```

The rest of the function stays as-is.

- [ ] **Step 3: Type-check and run tests**

Run: `npm run build`
Expected: `tsc --noEmit` passes; Vite build succeeds.

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 4: Manual smoke test — time-only path**

Run `npm run dev`.

1. Set settings to a short same-day window (e.g., windowStart = a time 10 minutes ago, windowEnd = a time 5 minutes from now — so planned end is later today). Save.
2. Start a fast.
3. Tap End. Verify the picker shows **only a time input** (no date field). Verify it defaults to the current `HH:mm`.
4. Try a deliberately invalid input by clearing or pasting garbage if possible (`type="time"` mostly prevents this — that's fine, the null-path is covered by unit tests). Confirm Save with the default time → fast ends correctly, last-fast duration shows on the idle screen.

- [ ] **Step 5: Manual smoke test — datetime-local fallback path**

Continuing the dev server:

1. Open settings. Set windowStart = current hour, windowEnd = some time tomorrow's morning (this creates a multi-day fast). Save.
   - Easiest way: pick windowStart = 21:00 and windowEnd = 09:00 (12h window). If current time is between 09:00 and 21:00 of today, then planned end (`startedAt + 12h`) lands on a different day than today.
   - If your current time happens to be such that planned end falls on today's date, temporarily set windowEnd far enough out that the planned end is tomorrow.
2. End the active fast (if any), then Start a new one.
3. Tap End. Verify the picker shows the **datetime-local input** (with both date and time visible).
4. Confirm Save with the default value → fast ends correctly.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/EndConfirmSheet.ts src/main.ts
git commit -m "$(cat <<'EOF'
feat(end-sheet): time-only picker when planned end is today

When startedAt + targetMs falls on today's local calendar date, the End
sheet renders <input type="time"> instead of datetime-local. The date is
implicit (today, captured once at mount so a midnight crossing while the
sheet is open does not shift it). Cross-day fasts continue to use the
full datetime picker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: All tests PASS, including 11 new ones (4 `plannedStartFor`, 3 `sameLocalYMD`, 4 `combineTimeWithDate`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build into `dist/`.

- [ ] **Step 3: Quick git review**

Run: `git log --oneline -6`
Expected: Five new commits (one per task), each focused and well-described.

Run: `git status`
Expected: clean working tree.
