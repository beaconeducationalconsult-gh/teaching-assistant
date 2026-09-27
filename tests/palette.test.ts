import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Palette guard for the two appearances. The stylesheet keeps Warm Light values
 * in :root and overrides the same token names in .theme-dense (Slate Dark), so
 * this suite fails if the palettes drift apart, if text contrast regresses, or
 * if type below the 10px floor creeps back in.
 */
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function tokensFrom(pattern: RegExp) {
  const block = css.match(pattern)?.[0];
  if (!block) throw new Error("palette block not found in styles.css");
  return Object.fromEntries([...block.matchAll(/(--[a-z-]+)\s*:\s*([^;}]+)/g)].map(([, key, value]) => [key.slice(2), value.trim()]));
}

const palettes = {
  "Warm Light": tokensFrom(/:root\{[^}]*\}/),
  "Slate Dark": tokensFrom(/\n\.theme-dense\{[^}]*\}/),
};

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const channel = (offset: number) => {
    const c = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(foreground: string, background: string) {
  const [bright, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
}

/** Text tier -> the surfaces that token is actually used on, and its minimum ratio. */
const textRules: Array<{ token: string; surfaces: string[]; minimum: number }> = [
  { token: "ink", surfaces: ["paper", "surface", "surface-raised", "surface-sunken", "tint", "tint-strong"], minimum: 7 },
  { token: "ink-soft", surfaces: ["paper", "surface", "surface-raised", "surface-sunken", "tint", "tint-strong"], minimum: 4.5 },
  { token: "muted", surfaces: ["paper", "surface", "surface-raised", "surface-sunken", "tint", "tint-strong"], minimum: 4.5 },
  { token: "faint", surfaces: ["paper", "surface", "surface-raised", "surface-sunken"], minimum: 4.5 },
  { token: "olive-ink", surfaces: ["paper", "surface", "surface-raised", "surface-sunken", "tint", "tint-strong", "hover"], minimum: 4.5 },
  { token: "olive", surfaces: ["paper", "surface", "surface-raised", "tint", "tint-strong"], minimum: 4.5 },
  { token: "teal-ink", surfaces: ["paper", "surface", "surface-sunken", "tint"], minimum: 4.5 },
  { token: "field-ink", surfaces: ["field-bg"], minimum: 7 },
  { token: "danger", surfaces: ["paper"], minimum: 4.5 },
  { token: "placeholder", surfaces: ["field-bg"], minimum: 3 },
];

describe("palette tokens", () => {
  const colours = (palette: Record<string, string>) => Object.keys(palette).filter((name) => /^#[0-9a-f]{6}$/.test(palette[name])).sort();

  it("defines the same colour tokens in both appearances", () => {
    const warm = colours(palettes["Warm Light"]);
    const slate = colours(palettes["Slate Dark"]);
    expect(warm).toContain("ink");
    expect(warm).toContain("muted");
    expect(warm).toContain("olive-ink");
    expect(warm.length).toBeGreaterThan(20);
    expect(slate).toEqual(warm);
  });

  it("keeps the palette to plain hex colours, so no rule copies a stray shade", () => {
    for (const [name, value] of Object.entries(palettes["Warm Light"])) {
      if (name === "serif" || name.startsWith("text-")) continue;
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  for (const [name, palette] of Object.entries(palettes)) {
    it(`${name} keeps text readable on every surface it uses`, () => {
      const failures: string[] = [];
      for (const { token, surfaces, minimum } of textRules) {
        for (const surface of surfaces) {
          const ratio = contrast(palette[token], palette[surface]);
          if (ratio < minimum) failures.push(`${token} on ${surface} = ${ratio.toFixed(2)}:1 (needs ${minimum})`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it("no longer ships the low-contrast greys the light theme used to use", () => {
    for (const retired of ["#8c9087", "#999c93", "#9da096", "#a0a399", "#a1a39a", "#9a9d94", "#b1b4aa", "#92958c"]) {
      expect(css.toLowerCase()).not.toContain(retired);
    }
  });
});

describe("type floor", () => {
  it("never sets type below 10px", () => {
    const sizes = [...css.matchAll(/font-size:([0-9.]+)px/g)].map(([, value]) => Number(value));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((size) => size < 10)).toEqual([]);
  });

  it("keeps the two micro sizes on tokens so both palettes stay in step", () => {
    expect(palettes["Warm Light"]["text-micro"]).toBe("10px");
    expect(palettes["Warm Light"]["text-small"]).toBe("11px");
    expect(css).toContain("font-size:var(--text-micro)");
    expect(css).toContain("font-size:var(--text-small)");
  });
});
