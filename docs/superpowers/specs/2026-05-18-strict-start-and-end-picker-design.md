# Strict start & smarter end picker

Date: 2026-05-18

## Problem

Two friction points in the current fasting flow:

1. **Start records "now", not the planned time.** A strict faster who plans to start at the configured `windowStart` (e.g., 21:00) but actually taps Start at 21:07 ends up with a fast that records as starting at 21:07. The user wants `startedAt` to default to the *planned* time, while still being able to adjust afterward.
2. **End sheet always shows a full datetime picker.** When the fast's expected end is on today's calendar date, the date component is noise. The user wants a time-only picker for that common case.

The existing tap-to-edit start affordance on the meta row already covers "ability to change later" for problem 1 — no new UI is needed there.

## Goals

- Pressing Start snaps `startedAt` to the most recent past occurrence of `windowStart`. No prompt.
- The End sheet shows a time-only picker when `Date.now()` and `startedAt + targetMs` fall on the same local calendar date; otherwise it shows the existing `datetime-local` picker.
- All new logic lives in pure helpers in `src/fastingMath.ts` and is unit-tested.
- No changes to storage schema, dial geometry, settings, or the active-fast model.

## Non-goals

- No "start sheet" with a confirm step. Silent snap by design; the existing edit-start path is the escape hatch.
- No date-picker reveal toggle inside the time-only end mode. If the date matters, the planned end is on a different day and the full picker shows automatically.
- No new tests for sheet rendering (no harness exists today and the new branching is mechanical).

## Design

### Start flow

`handleStart` in `src/main.ts:160` currently sets `startedAt = Date.now()`. Replace with:

```ts
const startedAt = plannedStartFor(Date.now(), s.settings.windowStart);
```

A new pure helper in `src/fastingMath.ts`:

```ts
/** Snap `now` to the most recent past occurrence of `windowStart` ("HH:mm") in local time. */
export function plannedStartFor(now: number, windowStart: string): number;
```

Algorithm:
1. Parse `windowStart` into `hh`, `mm`.
2. Build `todayPlanned` = a `Date` at today's Y-M-D and `hh:mm:00.000` in local time.
3. If `todayPlanned.getTime() <= now`: return `todayPlanned.getTime()`.
4. Else: return `todayPlanned.getTime() - 24 * 60 * 60 * 1000` (yesterday's planned time).

Behavior examples (with `windowStart = "21:00"`):
- Tap at 21:07 → today 21:00.
- Tap at 09:00 next morning → still yesterday 21:00 (12h fast in progress; matches the typical "I forgot to tap until now" flow).
- Tap at 20:55 → yesterday 21:00 (a ~23h-old fast). User can correct via the existing edit-start affordance. This is a rare case and the trade-off is deterministic, predictable behavior.

### End sheet

`src/components/EndConfirmSheet.ts` currently takes `{ startedAt }`. Extend to `{ startedAt, targetMs }`. Internally, decide picker mode at mount time:

```ts
const anchorMs = Date.now();
const useTimeOnly = sameLocalYMD(anchorMs, startedAt + targetMs);
```

Capture `anchorMs` once on mount so a midnight crossing while the sheet is open does not shift the inferred date.

**Time-only path:**
- Render `<input type="time">` with value defaulting to the local `HH:mm` of `anchorMs`.
- On Save, compute `endedAt = combineTimeWithDate(input.value, anchorMs)`.
- If `combineTimeWithDate` returns `null` → show "Invalid time." error.
- If `endedAt < startedAt` → keep the existing "End time can't be before start." error.

**Datetime-local path:** unchanged from today's implementation.

`main.ts:171` is updated to pass `{ startedAt: before.activeFast.startedAt, targetMs: before.activeFast.targetMs }`.

### New helpers in `src/fastingMath.ts`

```ts
/** True iff `a` and `b` fall on the same local Y-M-D. */
export function sameLocalYMD(a: number, b: number): boolean;

/** Combine an "HH:mm" string with the local Y-M-D of `dateAnchorMs`. Returns null on invalid input. */
export function combineTimeWithDate(timeStr: string, dateAnchorMs: number): number | null;
```

Both are tiny, pure, and easy to unit-test.

## File touchpoints

- `src/fastingMath.ts` — add `plannedStartFor`, `sameLocalYMD`, `combineTimeWithDate`.
- `src/main.ts` — `handleStart` uses `plannedStartFor`; `handleEnd` passes `targetMs` to the end sheet.
- `src/components/EndConfirmSheet.ts` — accept `targetMs`; branch on `sameLocalYMD`; capture anchor date once at mount.
- `tests/fastingMath.test.ts` — new tests for the three helpers.

Files explicitly unchanged: `EditStartSheet.ts`, `SettingsSheet.ts`, `Dial.ts`, `MetaRow.ts`, `Controls.ts`, `storage.ts`, `store.ts`.

## Test plan

Unit tests in `tests/fastingMath.test.ts`:

- **`plannedStartFor`**
  - Now is after today's planned time → returns today's planned time.
  - Now is before today's planned time → returns yesterday's planned time.
  - Now exactly equals today's planned time (millisecond boundary) → returns today's planned time.
  - `windowStart` with leading-zero hour (`"09:00"`) parses correctly.
- **`sameLocalYMD`**
  - Same Y-M-D, different times of day → true.
  - One millisecond on either side of local midnight → false.
  - Identical timestamps → true.
- **`combineTimeWithDate`**
  - Valid `"HH:mm"` + anchor → returns a timestamp on the anchor's Y-M-D with the given time.
  - Invalid string (`"99:99"`, empty, garbage) → null.
  - Boundary values `"00:00"` and `"23:59"`.

Manual smoke check via `npm run dev`:
- Start at various times of day; confirm dial elapsed matches the snap.
- End with same-day planned end → time-only picker; pick a time; verify saved `lastFast.endedAt` is sensible.
- End with cross-day planned end (e.g., set window to 24h+) → datetime-local picker.

## Out of scope

- No dial geometry changes.
- No new persisted fields.
- No changes to first-launch settings flow.
- No DST-specific gymnastics beyond what JavaScript `Date` already provides; the snap rule is "subtract 24h", which on DST transition days will be off by an hour. Acceptable given the edit-start escape hatch and the rarity.
