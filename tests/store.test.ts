import { describe, it, expect, vi } from "vitest";
import { createStore } from "../src/store";

describe("createStore", () => {
  it("returns the initial state from get()", () => {
    const s = createStore({ n: 1 });
    expect(s.get()).toEqual({ n: 1 });
  });
  it("set(value) replaces state", () => {
    const s = createStore({ n: 1 });
    s.set({ n: 2 });
    expect(s.get()).toEqual({ n: 2 });
  });
  it("set(fn) updates from previous", () => {
    const s = createStore({ n: 1 });
    s.set((prev) => ({ n: prev.n + 1 }));
    expect(s.get()).toEqual({ n: 2 });
  });
  it("notifies subscribers on change", () => {
    const s = createStore({ n: 1 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ n: 2 });
  });
  it("does not notify when value is referentially identical", () => {
    const initial = { n: 1 };
    const s = createStore(initial);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(initial);
    expect(fn).not.toHaveBeenCalled();
  });
  it("unsubscribe stops further notifications", () => {
    const s = createStore({ n: 1 });
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    unsub();
    s.set({ n: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});
