import { describe, expect, it } from "vitest";
import { builtInThemes, defaultTheme, parseTheme, themeRoles, themeVariables, toHex, contrast } from "./theme";
import { readThemePreferences, themeStorageKey } from "../stores/useThemeStore";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import mapping from "../themes/mapping.json";

describe("portable themes", () => {
  it("bundles the seven supplied families and preserves the Blue Slate default", () => {
    expect(builtInThemes).toHaveLength(8);
    expect(defaultTheme.id).toBe("blue-slate");
    expect(toHex(defaultTheme.colors.canvas)).toBe("#050913");
    expect(toHex(defaultTheme.colors.primary)).toBe("#00d8ff");
    for (const theme of builtInThemes) {
      expect(parseTheme(JSON.parse(JSON.stringify(theme)))).toEqual(theme);
      expect(Object.keys(theme.colors)).toHaveLength(themeRoles.length);
      expect(contrast(theme.colors.text, theme.colors.panel)).toBeGreaterThan(4.5);
    }
  });
  it("rejects incomplete, future, nonnumeric and CSS injection input", () => {
    for (const patch of [{ schemaVersion: 2 }, { name: " " }, { colors: { canvas: [0,0,0] } }, { id: "../bad" }, { mode: "system" }]) expect(() => parseTheme({ ...defaultTheme, ...patch })).toThrow();
    for (const color of [[NaN,0,0], [1.1,0,0], [.5,-1,0], [.5,0,361], "url(https://example.com)", [0,0,0,1]]) {
      expect(() => parseTheme({ ...defaultTheme, colors: { ...defaultTheme.colors, canvas: color } })).toThrow();
    }
  });
  it("retains source hashes and exact mapped source colors", () => {
    for (const t of builtInThemes.filter(t => t.provenance)) {
      const family = t.provenance!.source.split("/")[0];
      const bytes = readFileSync(`src/themes/sources/${family}.tokens.json`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(t.provenance!.sha256);
      const source = JSON.parse(bytes.toString()).tokens;
      for (const role of themeRoles) {
        const token = source[mapping.resources[role]];
        expect(t.colors[role]).toEqual(token.oklch);
        expect(toHex(t.colors[role]).toUpperCase()).toBe(token.hex.toUpperCase());
      }
    }
  });
  it("maps legacy Tailwind aliases and all semantic roles for both render paths", () => {
    expect(themeVariables(defaultTheme)["--color-atl-cyan"]).toMatch(/^oklch\(/);
    expect(themeVariables(defaultTheme, false)["--color-atl-cyan"]).toBe("#00d8ff");
    expect(themeVariables(defaultTheme)["--cw-error"]).toBeDefined();
    expect(contrast([0,0,0], [1,0,0])).toBeCloseTo(21, 3);
  });
  it("loads preferences, rejects corruption and collision, and falls back for stale selection", () => {
    const read = (value: unknown) => readThemePreferences({ getItem: key => key === themeStorageKey ? JSON.stringify(value) : null });
    expect(read({ version: 1, selectedId: "missing", custom: [] }).selectedId).toBe("blue-slate");
    expect(() => read({ version: 1, selectedId: "blue-slate", custom: [defaultTheme] })).toThrow(/Duplicate/);
    expect(() => read({ version: 9, custom: [] })).toThrow();
  });
});
