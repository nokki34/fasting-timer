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
