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
