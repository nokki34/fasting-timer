# Fasting Timer — Design

**Date:** 2026-05-17
**Status:** Draft, awaiting user approval before implementation planning.

## Summary

A small frontend-only web app for tracking intermittent fasts. The user sets a fasting window (e.g. 9pm–9am), taps **Start fast** when they begin, and taps **End fast** when they break it. The central visualization is a circular dial whose full revolution equals the user's fasting window. Over-fasting is rendered as a second, accent-colored arc layered on top of the completed ring — the literal visual overlap the user wanted from the start. State is persisted in `localStorage`. The app is deployed to GitHub Pages.

## Goals & non-goals

**Goals (MVP):**
- Set a single fasting window (start time + end time, wrapping midnight).
- Track exactly one active fast at a time, started and ended explicitly by the user.
- Correct mistakes: edit the start time during an active fast; confirm/edit the end time when ending.
- Show progress as a dial with a clean over-fasting state.
- Persist settings and the last completed fast in `localStorage`.
- Deploy as a static site to GitHub Pages.

**Non-goals (explicit, MVP):**
- History view of past fasts (data is persisted; no UI to browse it).
- Notifications, sounds, or background alerts.
- Multiple fasting plans, weekday/weekend variations.
- PWA install manifest or service worker.
- Charts, stats, streaks.
- Light mode or system-follow theming (dark mode only).
- Sync across devices, accounts, cloud storage.

## Mental model & UX decisions

**Action-driven, not schedule-driven.** The app does not silently track time-of-day against the window. The user explicitly starts and ends each fast. The window setting drives the dial's target duration and the suggested start time of a new fast, nothing else.

**Window-as-dial.** Rather than a traditional 24-hour clock face, one full revolution of the dial equals the user's full fasting window. This makes the over-fasting visualization natural: when elapsed time exceeds the target, the arc wraps a second time and overlays the completed ring.

**Edits are first-class.** Forgetting to tap "Start" is the canonical user failure mode. The start time is always tappable to edit. The end time is always edited via a confirmation sheet rather than a one-tap "end."

**Native pickers.** `<input type="time">` for window setup, `<input type="datetime-local">` for start/end edits. No custom date/time UI in MVP.

## Visual design

### Dial states

1. **Mid-fast** — track ring (dim) + progress arc clockwise from the top of the dial in the primary accent (e.g. blue). Center shows elapsed time as `HH:MM`, with "elapsed" below and "X:XX to go" below that.
2. **Goal reached** — full revolution complete, ring colored success-green, checkmark and elapsed time in the center.
3. **Over-fasting** — completed ring stays as a dimmed green base layer; a second arc in an accent-warning color (e.g. red/pink) is drawn on top, starting at the top of the dial and sweeping clockwise by `(elapsed - target) / target` of a revolution. Center shows total elapsed plus "+X:XX over."

Visual cap: when over-fasting exceeds 2× the target, the overlap arc holds at a full revolution; the numeric counter keeps going.

### Layout

- Header: app name, gear icon (right) for SettingsSheet.
- Dial in the center.
- MetaRow below the dial: left = "STARTED 9:04pm" (tappable), right = "GOAL 9:04am". Both compact, monospace.
- Controls below MetaRow: **Start fast** or **End fast** depending on state. When idle, a small "Last fast: 13h 12m" line appears below if a completed fast exists.

### Perimeter labels

Hours-into-fast at four quarter positions of the ring: `0h` (top), `T/4` (right), `T/2` (bottom), `3T/4` (left), where `T` is the target hours. For a 12h fast that renders as `0h`, `3h`, `6h`, `9h`. Quiet typography, just outside the ring.

### Theming

Dark mode only. A small palette of CSS variables for background, surface, track, primary (in-progress), success (goal-reached), warning (over-fasting), text-primary, text-secondary.

## Data model

Three slices in `localStorage`, each under its own key.

```ts
// "ft.settings"
type Settings = {
  windowStart: string;  // "HH:mm" 24-hour, e.g. "21:00"
  windowEnd:   string;  // "HH:mm" 24-hour, e.g. "09:00"
};

// "ft.activeFast"  (null when no active fast)
type ActiveFast = {
  startedAt: number;  // epoch ms
  targetMs:  number;  // duration target, snapshotted at start
};

// "ft.lastFast"  (null until first completed fast)
type LastFast = {
  startedAt: number;
  endedAt:   number;
  targetMs:  number;
};
```

**Default settings on first launch:** `{ windowStart: "21:00", windowEnd: "09:00" }` (12h window). SettingsSheet opens automatically on first launch so the user can confirm or edit.

**Why snapshot `targetMs` onto the active fast:** Changing the window mid-fast must not retroactively redefine "goal reached" for the in-flight fast. The snapshot decouples the in-flight fast from future settings changes.

## Modules & components

```
src/
├── main.ts              # boot: load state, mount root, start tick loop
├── store.ts             # createStore<T>() — get/set/subscribe, ~50 LOC
├── storage.ts           # localStorage wrapper: typed read/write per slice, try/catch
├── fastingMath.ts       # pure functions: windowToTargetMs, elapsedMs, progress, format
├── components/
│   ├── Dial.ts          # SVG render of state
│   ├── MetaRow.ts       # start + planned-end times
│   ├── Controls.ts      # Start/End buttons + last-fast line
│   ├── SettingsSheet.ts # edit windowStart/windowEnd
│   ├── EditStartSheet.ts# edit activeFast.startedAt
│   └── EndConfirmSheet.ts # confirm end time, default now
└── styles.css           # dark-mode-only theme via CSS vars
```

Each component module exports `mount(el, initialState)` and `update(state)`. No framework. A single tick loop (`setInterval(1000)`) bumps a "now" signal that the Dial reads; everything else re-renders only on state changes.

## State machine

```
[ Idle ] -- tap Start fast ----------> [ Active ]
   ^                                       |
   |                                       | tap End fast
   |                                       v
   |                                 [ EndConfirmSheet ]
   |                                  |        |
   +---- confirm ─────────────────────+        +---- cancel ──> back to Active
         (write lastFast, clear activeFast)
```

**Idle behavior:**
- Big **Start fast** button.
- Below: "Last fast: 13h 12m" if `lastFast` exists.
- Gear opens SettingsSheet.

**Active behavior:**
- Dial ticks every second.
- Tap **End fast** → EndConfirmSheet, datetime-local prefilled to now.
- Tap start time → EditStartSheet, datetime-local prefilled to current `startedAt`.
- Gear opens SettingsSheet. Changing the window does not affect the in-flight fast.

**Page reload during active fast:** read `activeFast` from storage on boot → resume Active state with original `startedAt`.

**First launch:** no settings yet → SettingsSheet opens with defaults pre-filled.

## Edge cases & constraints

**Window math:**
- If `windowEnd ≤ windowStart` in HH:mm comparison, it wraps midnight. So `21:00 → 09:00` = 12h.
- `windowEnd == windowStart` is invalid; SettingsSheet rejects it.

**Editing constraints:**
- `EditStartSheet`: `startedAt ≤ now`. Reject futures before save.
- `EndConfirmSheet`: `endedAt ≥ startedAt`. Reject pre-start endings before save.

**Over-fasting:**
- `progress = elapsed / target`, unclamped.
- `0..1`: regular arc.
- `1..2`: dimmed base ring + accent overlap arc, length `(progress - 1) * full revolution`.
- `≥ 2`: overlap arc caps at full revolution; numeric counter continues without bound.

**Storage:**
- `storage.ts` wraps every read in `try/catch`. Bad JSON or missing key → return `null`; the slice resets to default. App never fails to load due to storage corruption.
- No schema version field in MVP. If the schema changes later, add `ft.schemaVersion` and a migration path.

**Browser quirks:**
- Tab backgrounding throttles `setInterval`. On `visibilitychange → visible`, recompute elapsed from `Date.now()` so the dial snaps to truth.
- DST irrelevant: `startedAt` is epoch ms, arithmetic is monotonic.

## Testing

Vitest. Tests target the pieces that can break silently.

- `fastingMath.test.ts`
  - `windowToTargetMs`: standard, wraps-midnight, equal-times (throws/rejects).
  - `elapsedMs`: `now < startedAt` → 0, `now == startedAt` → 0, normal.
  - `progress`: 0, 0.5, 1, 1.5, 2.5 (over the cap).
  - Formatters for `HH:MM` rendering.
- `storage.test.ts`
  - Round-trip per slice.
  - Bad JSON → `null`.
  - Missing key → `null`.
  - Partial/invalid schema → `null` (reject, don't crash).
- `store.test.ts`
  - `subscribe` notified on `set`.
  - Identical writes do not notify (referential check on the slice).

No DOM / e2e tests in MVP.

## Build & deploy

**Stack:** Vite + TypeScript (vanilla, no framework).

**Config:**
- `vite.config.ts` with `base: '/fasting-timer/'` for GitHub Pages subpath asset resolution.
- No environment variables, no runtime config.

**Deploy:**
- GitHub Action on push to `main`: install → `vite build` → publish `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`.
- Repo Settings → Pages → source = `gh-pages` branch.
- Live URL: `https://nokki34.github.io/fasting-timer/`.

## Project layout

```
fasting-timer/
├── .github/workflows/deploy.yml
├── docs/superpowers/specs/2026-05-17-fasting-timer-design.md
├── index.html
├── src/
│   ├── main.ts
│   ├── store.ts
│   ├── storage.ts
│   ├── fastingMath.ts
│   ├── components/
│   │   ├── Dial.ts
│   │   ├── MetaRow.ts
│   │   ├── Controls.ts
│   │   ├── SettingsSheet.ts
│   │   ├── EditStartSheet.ts
│   │   └── EndConfirmSheet.ts
│   └── styles.css
├── tests/
│   ├── fastingMath.test.ts
│   ├── storage.test.ts
│   └── store.test.ts
├── .gitignore
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Open questions

None at design time.
