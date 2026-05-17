import { describe, it, expect, beforeEach } from "vitest";
import { storage, type Settings, type ActiveFast, type LastFast } from "../src/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("settings", () => {
  it("returns null when not set", () => {
    expect(storage.loadSettings()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: Settings = { windowStart: "21:00", windowEnd: "09:00" };
    storage.saveSettings(v);
    expect(storage.loadSettings()).toEqual(v);
  });
  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem("ft.settings", "{not json");
    expect(storage.loadSettings()).toBeNull();
  });
  it("returns null when stored value has wrong shape", () => {
    localStorage.setItem("ft.settings", JSON.stringify({ foo: "bar" }));
    expect(storage.loadSettings()).toBeNull();
  });
});

describe("activeFast", () => {
  it("returns null when not set", () => {
    expect(storage.loadActiveFast()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: ActiveFast = { startedAt: 1700000000000, targetMs: 12 * 3600 * 1000 };
    storage.saveActiveFast(v);
    expect(storage.loadActiveFast()).toEqual(v);
  });
  it("clears when saved as null", () => {
    storage.saveActiveFast({ startedAt: 1, targetMs: 1 });
    storage.saveActiveFast(null);
    expect(storage.loadActiveFast()).toBeNull();
  });
  it("returns null when stored value has wrong shape", () => {
    localStorage.setItem("ft.activeFast", JSON.stringify({ startedAt: "x" }));
    expect(storage.loadActiveFast()).toBeNull();
  });
});

describe("lastFast", () => {
  it("returns null when not set", () => {
    expect(storage.loadLastFast()).toBeNull();
  });
  it("round-trips a valid value", () => {
    const v: LastFast = { startedAt: 1, endedAt: 2, targetMs: 3 };
    storage.saveLastFast(v);
    expect(storage.loadLastFast()).toEqual(v);
  });
  it("returns null when missing fields", () => {
    localStorage.setItem("ft.lastFast", JSON.stringify({ startedAt: 1, endedAt: 2 }));
    expect(storage.loadLastFast()).toBeNull();
  });
});
