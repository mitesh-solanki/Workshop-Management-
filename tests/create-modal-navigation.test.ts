import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createModalNavStorageKey,
  finishCreateModalNavigation,
  hasNavigatedAfterCreate,
  isAlreadyOnCreateTarget,
  markNavigatedAfterCreate,
} from "@/lib/create-modal-navigation";

function installSessionStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("sessionStorage", storage);
  return storage;
}

describe("create-modal-navigation", () => {
  beforeEach(() => {
    installSessionStorage();
    vi.stubGlobal("window", {
      location: { pathname: "/customers" },
      sessionStorage: globalThis.sessionStorage,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a stable storage key per kind and id", () => {
    expect(createModalNavStorageKey("customer", "c1")).toBe(
      "wm:created:customer:c1",
    );
  });

  it("marks and detects navigated creates", () => {
    expect(hasNavigatedAfterCreate("vendor", "v1")).toBe(false);
    markNavigatedAfterCreate("vendor", "v1");
    expect(hasNavigatedAfterCreate("vendor", "v1")).toBe(true);
    expect(hasNavigatedAfterCreate("vendor", "v2")).toBe(false);
  });

  it("isAlreadyOnCreateTarget ignores query strings", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/customers/abc" },
      sessionStorage: globalThis.sessionStorage,
    });
    expect(isAlreadyOnCreateTarget("/customers/abc")).toBe(true);
    expect(isAlreadyOnCreateTarget("/customers/abc?x=1")).toBe(true);
    expect(isAlreadyOnCreateTarget("/customers/other")).toBe(false);
  });

  it("finishCreateModalNavigation closes then replace-navigates once", () => {
    const replace = vi.fn();
    const close = vi.fn();

    finishCreateModalNavigation({
      kind: "customer",
      recordId: "c1",
      href: "/customers/c1",
      router: { replace },
      close,
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/customers/c1");
    expect(hasNavigatedAfterCreate("customer", "c1")).toBe(true);

    finishCreateModalNavigation({
      kind: "customer",
      recordId: "c1",
      href: "/customers/c1",
      router: { replace },
      close,
    });
    expect(close).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
