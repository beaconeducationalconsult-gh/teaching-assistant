import { useEffect, useState } from "react";

/**
 * The two shipped appearances. "warm" is the original editorial palette and the
 * default; "slate" is the denser dark palette that used to be hard-coded on the
 * page shell. The chosen value is persisted in localStorage so a reload, a new
 * tab, or a later visit on the same browser keeps the same appearance.
 */
export type ThemeName = "warm" | "slate";

export const THEME_STORAGE_KEY = "teaching-assistant.theme";
export const DEFAULT_THEME: ThemeName = "warm";
/** Class the stylesheet uses for the dark palette; it must sit on <html>. */
export const THEME_CLASS = "theme-dense";
export const THEME_ORDER: ThemeName[] = ["warm", "slate"];
export const THEME_LABELS: Record<ThemeName, string> = { warm: "Warm Light", slate: "Slate Dark" };
export const THEME_COLORS: Record<ThemeName, string> = { warm: "#f6f5f0", slate: "#0e1115" };

export function isThemeName(value: unknown): value is ThemeName {
  return value === "warm" || value === "slate";
}

/** Stored values are untrusted input: anything unrecognised falls back to Warm Light. */
export function parseThemeName(value: string | null | undefined): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Blocked storage (for example Safari private mode) throws on access.
    return null;
  }
}

export function readStoredTheme(storage: Storage | null = browserStorage()): ThemeName {
  try {
    return parseThemeName(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: ThemeName, storage: Storage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Minimal shape of the element the theme class is applied to, so it stays testable. */
export type ThemeRoot = {
  classList: { toggle(token: string, force?: boolean): unknown };
  dataset?: { [key: string]: string | undefined };
};

function documentRoot(): ThemeRoot | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function applyTheme(theme: ThemeName, root: ThemeRoot | null = documentRoot()): void {
  if (!root) return;
  root.classList.toggle(THEME_CLASS, theme === "slate");
  if (root.dataset) root.dataset.theme = theme;
}

/** Keeps the mobile browser chrome (`<meta name="theme-color">`) in step with the palette. */
export function syncThemeColor(theme: ThemeName, target: Document | null = typeof document === "undefined" ? null : document): void {
  target?.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    syncThemeColor(theme);
    storeTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === "warm" ? "slate" : "warm")),
  };
}
