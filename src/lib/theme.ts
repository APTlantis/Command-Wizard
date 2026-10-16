import bundled from "../themes/bundled.json";

export const themeRoles = ["canvas", "background", "panel", "elevated", "accentSurface", "border", "muted", "secondaryText", "text", "primary", "focus", "secondary", "warning", "error", "success", "info", "keyword", "string", "number", "function", "operator", "selection", "selectionText"] as const;
export type ThemeRole = typeof themeRoles[number];
export type Oklch = [number, number, number];
export interface Theme {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: "dark" | "light";
  colors: Record<ThemeRole, Oklch>;
  provenance?: { source: string; sha256: string; mapping: string };
}

export function parseTheme(value: unknown): Theme {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Theme must be an object.");
  const t = value as Record<string, unknown>;
  if (t.schemaVersion !== 1) throw new Error("Unsupported theme schemaVersion. Expected 1.");
  if (typeof t.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(t.id)) throw new Error("Theme ID must use lowercase letters, digits and hyphens (1–80 characters).");
  if (typeof t.name !== "string" || !t.name.trim() || t.name.length > 80) throw new Error("Theme name must contain 1–80 characters.");
  if (t.mode !== "dark" && t.mode !== "light") throw new Error("Theme mode must be dark or light.");
  if (!t.colors || typeof t.colors !== "object" || Array.isArray(t.colors)) throw new Error("Missing theme colors.");
  const colors = t.colors as Record<string, unknown>;
  if (Object.keys(colors).some(key => !themeRoles.includes(key as ThemeRole))) throw new Error("Unknown theme color role.");
  for (const role of themeRoles) {
    const c = colors[role];
    if (!Array.isArray(c) || c.length !== 3 || !c.every(n => typeof n === "number" && Number.isFinite(n)) || c[0] < 0 || c[0] > 1 || c[1] < 0 || c[1] > .4 || c[2] < 0 || c[2] > 360) throw new Error(`${role}: use OKLCH [L 0–1, C 0–0.4, H 0–360].`);
  }
  let provenance: Theme["provenance"];
  if (t.provenance !== undefined) {
    const p = t.provenance as Record<string, unknown> | null;
    if (!p || typeof p.source !== "string" || p.source.length > 500 || typeof p.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(p.sha256) || typeof p.mapping !== "string" || p.mapping.length > 500) throw new Error("Invalid theme provenance.");
    provenance = { source: p.source, sha256: p.sha256, mapping: p.mapping };
  }
  return { schemaVersion: 1, id: t.id, name: t.name.trim(), mode: t.mode, colors: Object.fromEntries(themeRoles.map(role => [role, [...colors[role] as number[]]])) as Theme["colors"], ...(provenance ? { provenance } : {}) };
}

export const builtInThemes: Theme[] = bundled.map(parseTheme);
export const defaultTheme = builtInThemes[0];
export const oklchCss = ([l, c, h]: Oklch) => `oklch(${l} ${c} ${h})`;

/** sRGB fallback uses CSS-style channel clipping for out-of-gamut custom colors. */
export function toRgb([L, C, H]: Oklch): number[] {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*s, -1.2684380046*l+2.6097574011*m-.3413193965*s, -.0041960863*l-.7034186147*m+1.707614701*s].map(v => Math.max(0, Math.min(1, v <= .0031308 ? 12.92*v : 1.055 * v ** (1/2.4)-.055)));
}
export const toHex = (c: Oklch) => "#" + toRgb(c).map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const aliases: Record<string, ThemeRole> = { void: "canvas", deep: "background", abyss: "panel", slate: "elevated", navy: "accentSurface", ridge: "border", frost: "muted", silver: "secondaryText", archive: "text", cyan: "primary", "cyan-bright": "focus", teal: "secondary", amber: "error", brass: "warning", violet: "keyword", indigo: "info", green: "success" };
export function themeVariables(theme: Theme, useOklch = true): Record<string, string> {
  const css = (role: ThemeRole) => useOklch ? oklchCss(theme.colors[role]) : toHex(theme.colors[role]);
  return { ...Object.fromEntries(themeRoles.map(role => [`--cw-${role}`, css(role)])), ...Object.fromEntries(Object.entries(aliases).map(([key, role]) => [`--color-atl-${key}`, css(role)])), colorScheme: theme.mode };
}
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const supported = typeof CSS !== "undefined" && CSS.supports("color", "oklch(0.5 0.1 200)");
  for (const [key, value] of Object.entries(themeVariables(theme, supported))) {
    if (key === "colorScheme") root.style.colorScheme = value;
    else root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
}

export function contrast(a: Oklch, b: Oklch) {
  const luminance = (c: Oklch) => toRgb(c).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function contrastWarnings(t: Theme): string[] {
  return ([["text", "panel"], ["muted", "panel"], ["primary", "panel"], ["selectionText", "selection"]] as [ThemeRole, ThemeRole][]).flatMap(([a,b]) => {
    const ratio = contrast(t.colors[a], t.colors[b]);
    return ratio < 4.5 ? [`${a} / ${b}: ${ratio.toFixed(2)}:1 (below 4.5:1)`] : [];
  });
}
