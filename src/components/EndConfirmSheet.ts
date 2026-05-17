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
          <input type="datetime-local" data-input />
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

    input.value = toLocalInputValue(Date.now());

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
