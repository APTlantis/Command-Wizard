import { useEffect, useRef, useState } from "react";
import { BookMarked, Clipboard, Copy, Plus, Save, Trash2, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { commandCategories } from "../lib/commandCategory";
import { selectFilteredFavorites, selectFavoriteTags, useCommandWizardStore } from "../stores/useCommandWizardStore";
import { normalizeEntry } from "../lib/library";

function EntryEditor() {
  const state = useCommandWizardStore();
  const [wrap, setWrap] = useState(true);
  const draft = state.libraryDraft;
  if (!draft) return <div className="atl-panel p-6"><h2 className="text-xl font-semibold">Your command library</h2><p className="mt-2 text-atl-frost">Select a saved command, or choose New Command to save one.</p></div>;
  const update = state.updateLibraryDraft;
  const existing = state.favorites.some((entry) => entry.id === draft.id);
  return <section className="atl-panel min-h-0 overflow-auto p-5" aria-label="Command editor">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="atl-label">{existing ? "Saved command" : "New command"}</p><h2 className="text-xl font-semibold">{draft.title || "Untitled command"}</h2><span className="atl-chip mt-2">{draft.builderSnapshot ? "Builder snapshot" : "Text command"}</span></div>
      <div className="flex gap-2"><IconButton icon={Save} label={state.librarySaving ? "Saving…" : "Save Command"} variant="primary" onClick={state.commitLibraryDraft} disabled={state.librarySaving} /><IconButton icon={X} label="Cancel" onClick={state.cancelLibraryDraft} disabled={state.librarySaving} /></div>
    </div>
    <fieldset disabled={state.librarySaving} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2"><span className="atl-label">Title</span><input className="atl-input" value={draft.title} onChange={(event) => update({ title: event.target.value })} /></label>
      <label><span className="atl-label">Category</span><select className="atl-input" aria-label="Saved command category" value={draft.category} onChange={(event) => update({ category: event.target.value as typeof draft.category })}>{commandCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
      <label><span className="atl-label">Tool association</span><input className="atl-input" list="library-tools" value={draft.tool} onChange={(event) => update({ tool: event.target.value })} placeholder="Unassigned" /><datalist id="library-tools">{state.schemas.map((schema) => <option key={schema.name} value={schema.name} />)}</datalist></label>
      <label className="md:col-span-2"><span className="atl-label">Notes</span><textarea className="atl-input" rows={3} value={draft.notes} onChange={(event) => update({ notes: event.target.value })} /></label>
      <label className="md:col-span-2"><span className="atl-label">Tags (comma-separated)</span><input className="atl-input" value={draft.tags.map((tag) => tag.name).join(",")} onChange={(event) => update({ tags: event.target.value.split(",").map((name) => ({ name, color: draft.tags.find((tag) => tag.name === name)?.color ?? "#21C6B8" })) })} /></label>
      <div className="md:col-span-2"><div className="mb-2 flex items-center justify-between"><label className="atl-label mb-0" htmlFor="library-command-text">Command</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />Wrap long lines</label></div><textarea id="library-command-text" className="atl-input font-mono" rows={8} wrap={wrap ? "soft" : "off"} spellCheck={false} value={draft.command} onChange={(event) => update({ command: event.target.value })} /></div>
    </fieldset>
    {draft.builderSnapshot && <p className="mt-3 text-xs text-atl-frost">Editing command text changes this entry to a text command. Metadata edits keep its Builder setup.</p>}
    {state.libraryDirty && <p className="mt-3 text-sm text-atl-brass">Unsaved changes</p>}
    {state.libraryError && <p role="alert" className="mt-3 text-sm text-atl-amber">{state.libraryError}</p>}
    {!state.libraryDirty && existing && <p role="status" className="mt-3 text-xs text-atl-frost">Saved · {new Date(draft.updatedAt).toLocaleString()}</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      <IconButton icon={Clipboard} label="Copy Command" onClick={() => navigator.clipboard.writeText(draft.command)} />
      {draft.builderSnapshot && <IconButton icon={BookMarked} label="Reopen in Builder" onClick={state.reopenLibraryEntry} />}
      {existing && <><IconButton icon={Copy} label="Duplicate" onClick={state.duplicateLibraryEntry} /><IconButton icon={Trash2} label="Delete Command" variant="warning" onClick={() => state.removeFavorite(draft.id)} /></>}
    </div>
  </section>;
}

export function LibraryWorkspace() {
  const state = useCommandWizardStore();
  const entries = selectFilteredFavorites(state);
  return <div className="grid min-h-0 flex-1 auto-rows-[28rem] gap-3 overflow-auto lg:auto-rows-auto lg:grid-rows-1 lg:overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
    <aside className="atl-panel flex min-h-0 flex-col p-4" aria-label="Saved command list">
      <div className="flex items-center justify-between"><h1 className="text-lg font-semibold">Command Library</h1><IconButton icon={Plus} label="New Command" onClick={() => state.openLibraryEntry()} /></div>
      <input aria-label="Search saved commands" className="atl-input mt-4" placeholder="Search saved commands…" value={state.favoriteSearch} onChange={(event) => state.setFavoriteSearch(event.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2"><select aria-label="Filter category" className="atl-input" value={state.libraryCategory} onChange={(event) => state.setLibraryCategory(event.target.value)}><option value="All">All categories</option>{commandCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select><select aria-label="Filter tags" className="atl-input" value={state.favoriteTag} onChange={(event) => state.setFavoriteTag(event.target.value)}>{selectFavoriteTags(state.favorites).map((tag) => <option key={tag}>{tag}</option>)}</select></div>
      <p className="mt-3 text-xs text-atl-frost">Most recently updated · {entries.length} commands</p>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto">{entries.map((raw) => { const entry = normalizeEntry(raw); return <button key={entry.id} className={`atl-card w-full p-3 text-left ${state.libraryDraft?.id === entry.id ? "border-atl-cyan bg-atl-cyan/10" : ""}`} onClick={() => state.openLibraryEntry(entry.id)}><p className="font-semibold">{entry.title}</p><p className="mt-1 text-xs text-atl-frost">{entry.tool || "Unassigned"} · {commandCategories.find((category) => category.id === entry.category)?.label}</p><p className="mt-2 line-clamp-2 break-all font-mono text-xs text-atl-silver">{entry.command}</p></button>; })}{entries.length === 0 && <p className="p-3 text-sm text-atl-frost">No saved commands match. Choose New Command to add one.</p>}</div>
      <div className="mt-3 flex gap-2"><IconButton icon={Save} label="Export JSON" onClick={() => state.exportFavorites("json")} /><IconButton icon={Save} label="Export Text" onClick={() => state.exportFavorites("text")} /></div>
    </aside>
    <EntryEditor />
  </div>;
}

export function LibrarySaveDialog() {
  const state = useCommandWizardStore();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (state.libraryModal && !dialog.current?.open) dialog.current?.showModal();
    if (!state.libraryModal && dialog.current?.open) dialog.current.close();
  }, [state.libraryModal]);
  return <dialog ref={dialog} aria-label="Save to Library" className="atl-library-dialog" onCancel={(event) => { event.preventDefault(); state.cancelLibraryDraft(); }}>
    {state.libraryModal && <EntryEditor />}
  </dialog>;
}
