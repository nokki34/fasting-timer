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
          <input type="datetime-local" data-input />
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

    input.value = toLocalInputValue(currentStartedAt);

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
