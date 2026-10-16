import { create } from "zustand";
import { applyTheme, builtInThemes, defaultTheme, parseTheme, type Theme } from "../lib/theme";

export const themeStorageKey = "commandwizard.themes.v1";
export interface ThemePreferences { selectedId: string; custom: Theme[] }
export function readThemePreferences(storage: Pick<Storage, "getItem">): ThemePreferences {
  const raw = storage.getItem(themeStorageKey);
  if (!raw) return { selectedId: defaultTheme.id, custom: [] };
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || !Array.isArray(value.custom) || value.custom.length > 100 || typeof value.selectedId !== "string") throw new Error("Invalid saved theme preferences.");
  const custom = value.custom.map(parseTheme) as Theme[];
  const ids = [...builtInThemes, ...custom].map(t => t.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate saved theme IDs.");
  return { selectedId: ids.includes(value.selectedId) ? value.selectedId : defaultTheme.id, custom };
}
let initial: ThemePreferences = { selectedId: defaultTheme.id, custom: [] };
let initialError = "";
try { initial = readThemePreferences(localStorage); } catch { initialError = "Saved themes could not be read. Blue Slate is available; export any drafts before resetting theme storage."; }

interface ThemeState extends ThemePreferences {
  editorDirty: boolean;
  setEditorDirty: (dirty: boolean) => void;
  error: string;
  select: (id: string) => void;
  save: (theme: Theme) => boolean;
  remove: (id: string) => void;
  reset: () => void;
}
export const useThemeStore = create<ThemeState>((set, get) => {
  const persist = (next: ThemePreferences) => {
    try {
      // Never silently replace malformed user storage.
      readThemePreferences(localStorage);
      localStorage.setItem(themeStorageKey, JSON.stringify({ version: 1, ...next }));
      set({ ...next, error: "" });
      applyTheme([...builtInThemes, ...next.custom].find(t => t.id === next.selectedId) || defaultTheme);
      return true;
    } catch (error) {
      set({ error: `Theme preferences were not saved: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  };
  return {
    editorDirty: false, setEditorDirty: editorDirty => set({ editorDirty }),
    ...initial, error: initialError,
    select(id) {
      const t = [...builtInThemes, ...get().custom].find(t => t.id === id);
      if (t) persist({ selectedId: id, custom: get().custom });
    },
    save(value) {
      try {
        const t = parseTheme(value);
        if (builtInThemes.some(b => b.id === t.id)) throw new Error("Built-in themes are read-only. Make a copy first.");
        const custom = [...get().custom.filter(c => c.id !== t.id), t];
        if (custom.length > 100) throw new Error("Up to 100 custom themes can be saved.");
        return persist({ selectedId: t.id, custom });
      } catch (error) { set({ error: String(error) }); return false; }
    },
    remove(id) { persist({ selectedId: get().selectedId === id ? defaultTheme.id : get().selectedId, custom: get().custom.filter(t => t.id !== id) }); },
    reset() {
      try { localStorage.removeItem(themeStorageKey); set({ selectedId: defaultTheme.id, custom: [], error: "" }); applyTheme(defaultTheme); }
      catch { set({ error: "Theme storage could not be reset." }); }
    }
  };
});
export const selectedTheme = (state: ThemePreferences) => [...builtInThemes, ...state.custom].find(t => t.id === state.selectedId) || defaultTheme;
