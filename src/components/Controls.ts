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
