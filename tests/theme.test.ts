import { describe, expect, it } from "vitest";
import { applyTheme, isThemeName, parseThemeName, readStoredTheme, storeTheme, type ThemeRoot } from "../src/lib/theme";

const KEY = "teaching-assistant.theme";

function fakeStorage(initial: Record<string, string> = {}, options: { failOn?: "read" | "write" } = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => {
      if (options.failOn === "read") throw new Error("storage blocked");
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (options.failOn === "write") throw new Error("storage blocked");
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  };
  return { storage: storage as unknown as Storage, values };
}

function fakeRoot() {
  const classes = new Set<string>();
  const root: ThemeRoot = {
    classList: { toggle: (token: string, force?: boolean) => (force ? classes.add(token) : classes.delete(token)) },
    dataset: {},
  };
  return { root, classes };
}

describe("theme preference", () => {
  it("accepts only the two shipped appearances and falls back to Warm Light", () => {
    expect(isThemeName("warm")).toBe(true);
    expect(isThemeName("slate")).toBe(true);
    expect(parseThemeName("slate")).toBe("slate");
    expect(parseThemeName("warm")).toBe("warm");
    expect(parseThemeName("dense")).toBe("warm");
    expect(parseThemeName("")).toBe("warm");
    expect(parseThemeName(null)).toBe("warm");
    expect(parseThemeName(undefined)).toBe("warm");
  });

  it("reads a stored preference and ignores anything unrecognised", () => {
    expect(readStoredTheme(fakeStorage({ [KEY]: "slate" }).storage)).toBe("slate");
    expect(readStoredTheme(fakeStorage({ [KEY]: "midnight" }).storage)).toBe("warm");
    expect(readStoredTheme(fakeStorage().storage)).toBe("warm");
    expect(readStoredTheme(null)).toBe("warm");
  });

  it("survives storage that throws, such as blocked private-mode storage", () => {
    expect(readStoredTheme(fakeStorage({}, { failOn: "read" }).storage)).toBe("warm");
    expect(storeTheme("slate", fakeStorage({}, { failOn: "write" }).storage)).toBe(false);
    expect(storeTheme("slate", null)).toBe(false);
  });

  it("persists the choice so a reload keeps the same appearance", () => {
    const { storage, values } = fakeStorage();
    expect(storeTheme("slate", storage)).toBe(true);
    expect(values.get(KEY)).toBe("slate");
    expect(readStoredTheme(storage)).toBe("slate");
    storeTheme("warm", storage);
    expect(readStoredTheme(storage)).toBe("warm");
  });

  it("applies the dark palette class to the document root only for Slate Dark", () => {
    const slate = fakeRoot();
    applyTheme("slate", slate.root);
    expect(slate.classes.has("theme-dense")).toBe(true);
    expect(slate.root.dataset?.theme).toBe("slate");

    const warm = fakeRoot();
    warm.classes.add("theme-dense");
    applyTheme("warm", warm.root);
    expect(warm.classes.has("theme-dense")).toBe(false);
    expect(warm.root.dataset?.theme).toBe("warm");
  });

  it("does nothing when there is no document to theme", () => {
    expect(() => applyTheme("slate", null)).not.toThrow();
  });
});
