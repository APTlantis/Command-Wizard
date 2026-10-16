import { useEffect, useRef, useState, type CSSProperties } from "react";
import { builtInThemes, contrastWarnings, oklchCss, parseTheme, themeRoles, themeVariables, toHex, type Theme, type ThemeRole } from "../lib/theme";
import { selectedTheme, useThemeStore } from "../stores/useThemeStore";

export function ThemePicker() {
  const state = useThemeStore();
  return <label className="flex items-center gap-2 text-xs text-atl-silver">Theme
    <select aria-label="App theme" className="atl-input max-w-48" value={state.selectedId} onChange={e => state.select(e.target.value)}>
      {[...builtInThemes, ...state.custom].map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  </label>;
}

export function ThemeStudio() {
  const state = useThemeStore();
  const active = selectedTheme(state);
  const [draft, setDraft] = useState<Theme | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { state.setEditorDirty(dirty); return () => state.setEditorDirty(false); }, [dirty, state.setEditorDirty]);
  const [role, setRole] = useState<ThemeRole>("primary");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const preview = draft || active;
  const warnings = contrastWarnings(preview);
  const canReplaceDraft = () => !dirty || window.confirm("Discard unsaved theme changes?");
  const start = (t: Theme) => { setDraft(structuredClone(t)); setDirty(false); setMessage(""); };
  const copy = () => {
    if (!canReplaceDraft()) return;
    start({ ...structuredClone(preview), id: `custom-${crypto.randomUUID()}`, name: `${preview.name.slice(0, 70)} copy` });
    setDirty(true);
  };
  const exportTheme = () => {
    try {
      const valid = parseTheme(preview);
      const url = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2) + "\n"], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `${valid.id}.theme.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(String(error)); }
  };
  return <section aria-label="Themes" className="mt-5 border-b border-atl-ridge pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div>
      <h2 className="text-lg font-semibold">Themes</h2>
      <p className="text-sm text-atl-frost">Choose a theme above, or make your own. Changes stay on this device; export a file to share.</p>
    </div><div className="flex flex-wrap gap-2">
      <button className="atl-button" onClick={copy}>Make a copy</button>
      <button className="atl-button-ghost" onClick={() => input.current?.click()}>Import theme</button>
      <button className="atl-button-ghost" onClick={exportTheme}>Export theme</button>
      {state.custom.some(t => t.id === active.id) && <><button className="atl-button-secondary" onClick={() => { if (canReplaceDraft()) start(active); }}>Edit selected</button><button className="atl-button-warning" onClick={() => { if (window.confirm(`Delete ${active.name}?`) && canReplaceDraft()) { state.remove(active.id); setDraft(null); setDirty(false); } }}>Delete selected</button></>}
    </div></div>
    <input ref={input} type="file" accept=".json,application/json" aria-label="Theme file" className="sr-only" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file || !canReplaceDraft()) return;
      try {
        if (file.size > 100_000) throw new Error("Theme files must be smaller than 100 KB.");
        const t = parseTheme(JSON.parse(await file.text()));
        // Imports always receive a fresh identity; existing work is never overwritten.
        start({ ...t, id: `custom-${crypto.randomUUID()}` }); setDirty(true); setMessage("Imported for review. Save and apply when ready.");
      } catch (error) { setMessage(String(error)); }
    }} />
    {draft && <div className="atl-card mt-4 p-4">
      <div className="grid gap-3 md:grid-cols-2"><label className="atl-label">Theme name<input className="atl-input mt-1" value={draft.name} maxLength={80} onChange={e => { setDraft({ ...draft, name: e.target.value }); setDirty(true); }} /></label>
        <label className="atl-label">Mode<select className="atl-input mt-1" value={draft.mode} onChange={e => { setDraft({ ...draft, mode: e.target.value as Theme["mode"] }); setDirty(true); }}><option value="dark">Dark</option><option value="light">Light</option></select></label></div>
      <div className="mt-3 flex flex-wrap gap-1">{themeRoles.map(r => <button key={r} aria-label={`Edit ${r} color`} aria-pressed={r === role} title={r} className="size-7 rounded border border-atl-ridge focus:outline-2" style={{ background: oklchCss(draft.colors[r]) }} onClick={() => setRole(r)} />)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-4"><label className="atl-label">Color role<select className="atl-input mt-1" value={role} onChange={e => setRole(e.target.value as ThemeRole)}>{themeRoles.map(r => <option key={r}>{r}</option>)}</select></label>
        {(["Lightness", "Chroma", "Hue"] as const).map((label, i) => <label key={label} className="atl-label">{label}<input className="atl-input mt-1" type="number" step={i === 2 ? 1 : .001} min={0} max={[1,.4,360][i]} value={draft.colors[role][i]} onChange={e => {
          const value = e.target.valueAsNumber;
          if (!Number.isFinite(value) || value < 0 || value > [1,.4,360][i]) return;
          const colors = structuredClone(draft.colors); colors[role][i] = value; setDraft({ ...draft, colors }); setDirty(true);
        }} /></label>)}</div>
      <p className="mt-2 font-mono text-xs text-atl-frost">{oklchCss(draft.colors[role])} · sRGB fallback {toHex(draft.colors[role])}</p>
      <div className="mt-4 rounded border p-4" data-testid="theme-preview" style={{ ...themeVariables(draft), background: "var(--cw-panel)", color: "var(--cw-text)", borderColor: "var(--cw-border)" } as CSSProperties}>
        <p className="font-semibold">{draft.name || "Untitled theme"}</p><p style={{ color: "var(--cw-muted)" }}>Preview · command workspace</p>
        <code style={{ color: "var(--cw-primary)" }}>rsync --archive source destination</code>
        <div className="mt-2 flex gap-3">{(["success", "warning", "error"] as const).map(r => <span key={r} style={{ color: `var(--cw-${r})` }}>{r}</span>)}</div>
        <p className="mt-2 inline-block px-2" style={{ background: "var(--cw-selection)", color: "var(--cw-selectionText)" }}>Selected text</p>
      </div>
      <div className="mt-3 flex gap-2"><button className="atl-button" onClick={() => { if (state.save(draft)) { setDraft(null); setDirty(false); setMessage("Theme saved and applied."); } }}>Save and apply</button><button className="atl-button-ghost" onClick={() => { if (canReplaceDraft()) { setDraft(null); setDirty(false); } }}>Cancel editing</button></div>
    </div>}
    {warnings.length > 0 && <details className="mt-3 text-sm text-atl-brass"><summary>{warnings.length} contrast warnings</summary><ul>{warnings.map(w => <li key={w}>{w}</li>)}</ul><p>Opaque sRGB estimates. Review focus, syntax, hover and translucent surfaces too.</p></details>}
    {preview.provenance && <p className="mt-3 break-all text-xs text-atl-frost">Based on: {preview.provenance.source} · {preview.provenance.mapping}</p>}
    {(message || state.error) && <p role="status" className="mt-3 text-sm text-atl-brass">{state.error || message}</p>}
    {state.error && <button className="atl-button-warning mt-2" onClick={() => { if (window.confirm("Reset all theme preferences and delete custom themes on this device?")) state.reset(); }}>Reset theme preferences</button>}
    <p className="mt-3 text-xs text-atl-frost">Use Export theme to back up drafts before leaving this screen.</p>
  </section>;
}
