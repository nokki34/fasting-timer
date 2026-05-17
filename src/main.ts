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
