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
