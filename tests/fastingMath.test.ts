import { describe, it, expect } from "vitest";
import {
  windowToTargetMs,
  elapsedMs,
  progress,
  formatDuration,
  formatTimeOfDay,
  plannedStartFor,
  sameLocalYMD,
} from "../src/fastingMath";

const HOUR = 60 * 60 * 1000;

describe("windowToTargetMs", () => {
  it("returns 12h for 21:00 → 09:00 (wraps midnight)", () => {
    expect(windowToTargetMs("21:00", "09:00")).toBe(12 * HOUR);
  });
  it("returns 8h for 08:00 → 16:00 (same day)", () => {
    expect(windowToTargetMs("08:00", "16:00")).toBe(8 * HOUR);
  });
  it("returns 23h for 09:00 → 08:00 (just shy of full day)", () => {
    expect(windowToTargetMs("09:00", "08:00")).toBe(23 * HOUR);
  });
  it("throws when start equals end", () => {
    expect(() => windowToTargetMs("09:00", "09:00")).toThrow();
  });
  it("throws on invalid format", () => {
    expect(() => windowToTargetMs("nope", "09:00")).toThrow();
  });
});

describe("elapsedMs", () => {
  it("returns 0 when now equals startedAt", () => {
    expect(elapsedMs(1000, 1000)).toBe(0);
  });
  it("returns 0 (clamped) when now is before startedAt", () => {
    expect(elapsedMs(2000, 1000)).toBe(0);
  });
  it("returns the difference for normal case", () => {
    expect(elapsedMs(1000, 5000)).toBe(4000);
  });
});

describe("progress", () => {
  it("returns 0 for elapsed=0", () => {
    expect(progress(0, 12 * HOUR)).toBe(0);
  });
  it("returns 0.5 for half-target", () => {
    expect(progress(6 * HOUR, 12 * HOUR)).toBe(0.5);
  });
  it("returns 1 at exactly target", () => {
    expect(progress(12 * HOUR, 12 * HOUR)).toBe(1);
  });
  it("returns >1 when over", () => {
    expect(progress(15 * HOUR, 12 * HOUR)).toBe(1.25);
  });
  it("throws on non-positive target", () => {
    expect(() => progress(1000, 0)).toThrow();
  });
});

describe("formatDuration", () => {
  it("formats 5h exactly", () => {
    expect(formatDuration(5 * HOUR)).toBe("5:00");
  });
  it("formats 5h 7m", () => {
    expect(formatDuration(5 * HOUR + 7 * 60 * 1000)).toBe("5:07");
  });
  it("formats 0 as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
  it("clamps negative to 0:00", () => {
    expect(formatDuration(-1000)).toBe("0:00");
  });
  it("formats 13h 12m", () => {
    expect(formatDuration(13 * HOUR + 12 * 60 * 1000)).toBe("13:12");
  });
});

describe("formatTimeOfDay", () => {
  it("formats a known epoch in local 12h time", () => {
    const out = formatTimeOfDay(Date.now());
    expect(out).toMatch(/^\d{1,2}:\d{2}(am|pm)$/);
  });
  it("renders 12-hour cycle correctly for noon", () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    expect(formatTimeOfDay(d.getTime())).toBe("12:00pm");
  });
  it("renders 12-hour cycle correctly for midnight", () => {
    const d = new Date();
    d.setHours(0, 5, 0, 0);
    expect(formatTimeOfDay(d.getTime())).toBe("12:05am");
  });
});

describe("plannedStartFor", () => {
  it("returns today's planned time when now is after it", () => {
    const now = new Date();
    now.setHours(21, 7, 0, 0); // 21:07 today
    const expected = new Date(now);
    expected.setHours(21, 0, 0, 0); // 21:00 today
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(expected.getTime());
  });
  it("returns yesterday's planned time when now is before today's", () => {
    const now = new Date();
    now.setHours(20, 55, 0, 0); // 20:55 today, windowStart 21:00
    const expected = new Date(now);
    expected.setHours(21, 0, 0, 0); // 21:00 today
    const yesterday = expected.getTime() - 24 * 60 * 60 * 1000;
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(yesterday);
  });
  it("returns today's planned time when now exactly equals it", () => {
    const now = new Date();
    now.setHours(21, 0, 0, 0);
    expect(plannedStartFor(now.getTime(), "21:00")).toBe(now.getTime());
  });
  it("parses leading-zero hour correctly", () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    const expected = new Date(now);
    expected.setHours(9, 0, 0, 0);
    expect(plannedStartFor(now.getTime(), "09:00")).toBe(expected.getTime());
  });
});

describe("sameLocalYMD", () => {
  it("returns true for two times on the same local day", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const evening = new Date(morning);
    evening.setHours(22, 30, 0, 0);
    expect(sameLocalYMD(morning.getTime(), evening.getTime())).toBe(true);
  });
  it("returns false across local midnight (1ms apart)", () => {
    const justBefore = new Date();
    justBefore.setHours(23, 59, 59, 999);
    const justAfter = justBefore.getTime() + 1;
    expect(sameLocalYMD(justBefore.getTime(), justAfter)).toBe(false);
  });
  it("returns true for identical timestamps", () => {
    const t = Date.now();
    expect(sameLocalYMD(t, t)).toBe(true);
  });
});
