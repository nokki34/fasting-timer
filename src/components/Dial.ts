import { formatDuration } from "../fastingMath";

export type DialProps = {
  elapsedMs: number;
  targetMs: number;
};

type DialHandle = { update(props: DialProps): void };

const R = 88;
const STROKE = 14;
const VIEW = 110;

/**
 * Describe an SVG arc path from `startAngle` to `endAngle` (degrees, 0 = top, clockwise).
 * Caller guarantees the arc length is <= 360°.
 */
function arcPath(startAngle: number, endAngle: number, radius = R): string {
  const span = Math.max(0, Math.min(360, endAngle - startAngle));
  if (span <= 0) return "";
  const start = polar(startAngle, radius);
  const end = polar(startAngle + span, radius);
  const largeArc = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  // 0deg = top, clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

export function mount(parent: HTMLElement, initial: DialProps): DialHandle {
  const wrap = document.createElement("div");
  wrap.className = "dial-wrap";
  wrap.innerHTML = `
    <svg viewBox="-${VIEW} -${VIEW} ${VIEW * 2} ${VIEW * 2}" role="img" aria-label="fasting progress">
      <circle data-track cx="0" cy="0" r="${R}" fill="none" stroke="var(--track)" stroke-width="${STROKE}"/>
      <path data-progress fill="none" stroke="var(--primary)" stroke-width="${STROKE}" stroke-linecap="round"/>
      <path data-overlap fill="none" stroke="var(--warning)" stroke-width="${STROKE}" stroke-linecap="round"/>
      <g data-labels font-size="11" fill="var(--text-faint)" font-family="ui-monospace,Menlo,monospace" text-anchor="middle"></g>
      <text data-time x="0" y="-4" font-size="28" fill="var(--text)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace" font-weight="600"></text>
      <text data-sub x="0" y="18" font-size="11" fill="var(--text-dim)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace"></text>
      <text data-sub2 x="0" y="36" font-size="11" fill="var(--primary)" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace"></text>
    </svg>`;
  parent.appendChild(wrap);

  const svg = wrap.querySelector("svg")!;
  const trackEl = svg.querySelector<SVGCircleElement>("[data-track]")!;
  const progressEl = svg.querySelector<SVGPathElement>("[data-progress]")!;
  const overlapEl = svg.querySelector<SVGPathElement>("[data-overlap]")!;
  const labelsEl = svg.querySelector<SVGGElement>("[data-labels]")!;
  const timeEl = svg.querySelector<SVGTextElement>("[data-time]")!;
  const subEl = svg.querySelector<SVGTextElement>("[data-sub]")!;
  const sub2El = svg.querySelector<SVGTextElement>("[data-sub2]")!;

  function renderLabels(targetMs: number) {
    const hours = Math.round(targetMs / 3600000);
    const quarters = [
      { label: `0h`, x: 0, y: -R - 16 },
      { label: `${Math.round(hours / 4)}h`, x: R + 18, y: 4 },
      { label: `${Math.round(hours / 2)}h`, x: 0, y: R + 22 },
      { label: `${Math.round((3 * hours) / 4)}h`, x: -R - 18, y: 4 },
    ];
    labelsEl.innerHTML = quarters
      .map((q) => `<text x="${q.x}" y="${q.y}">${q.label}</text>`)
      .join("");
  }

  function update(props: DialProps) {
    const { elapsedMs, targetMs } = props;
    const p = targetMs > 0 ? elapsedMs / targetMs : 0;

    renderLabels(targetMs);

    if (p < 1) {
      // mid-fast: arc 0..360deg
      progressEl.setAttribute("stroke", "var(--primary)");
      progressEl.setAttribute("d", arcPath(0, p * 360));
      overlapEl.setAttribute("d", "");
      trackEl.setAttribute("stroke", "var(--track)");
      trackEl.setAttribute("opacity", "1");

      timeEl.textContent = formatDuration(elapsedMs);
      subEl.textContent = "elapsed";
      sub2El.setAttribute("fill", "var(--primary)");
      sub2El.textContent = `${formatDuration(targetMs - elapsedMs)} to go`;
    } else {
      // goal reached or over: full base ring in success
      progressEl.setAttribute("stroke", "var(--success)");
      // draw the full circle as a near-360 arc (avoid 0-length zero-arc rendering)
      progressEl.setAttribute("d", arcPath(0, 359.99));
      progressEl.setAttribute("opacity", p > 1 ? "0.45" : "1");
      trackEl.setAttribute("stroke", "var(--track)");

      const overspan = Math.min(1, p - 1); // cap at one extra revolution
      if (overspan > 0) {
        overlapEl.setAttribute("d", arcPath(0, overspan * 360));
        overlapEl.setAttribute("opacity", "1");
      } else {
        overlapEl.setAttribute("d", "");
      }

      timeEl.textContent = formatDuration(elapsedMs);
      subEl.textContent = p > 1 ? "elapsed" : "goal reached";
      if (p > 1) {
        sub2El.setAttribute("fill", "var(--warning)");
        sub2El.textContent = `+${formatDuration(elapsedMs - targetMs)} over`;
      } else {
        sub2El.setAttribute("fill", "var(--success)");
        sub2El.textContent = "✓";
      }
    }
  }

  update(initial);
  return { update };
}
