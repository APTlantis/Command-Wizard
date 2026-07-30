import {
  BookMarked,
  Braces,
  Clipboard,
  Cog,
  Database,
  FileInput,
  FolderOpen,
  Import,
  Library,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IconButton } from "./components/IconButton";
import {
  commandPreviewForState,
  selectFavoriteTags,
  selectFilteredFavorites,
  selectFilteredSchemas,
  selectSchemaIssues,
  selectSelectedSchema,
  selectTomlPreview,
  useCommandWizardStore
} from "./stores/useCommandWizardStore";
import type { ArgumentValueStyle, HelpImportDraft, SchemaArgument, SchemaParameter } from "./types";

const nav = [
  { id: "builder", label: "Builder", icon: Wand2 },
  { id: "import", label: "Import", icon: Import },
  { id: "schema", label: "Schema", icon: Braces },
  { id: "library", label: "Library", icon: Library },
  { id: "settings", label: "Evidence", icon: Database }
] as const;

function ToolRail() {
  const state = useCommandWizardStore();
  const schemas = selectFilteredSchemas(state);
  return (
    <aside className="atl-panel flex min-h-0 flex-col p-3">
      <div className="flex items-center gap-2">
        <Search size={15} className="text-atl-frost" />
        <input className="atl-input" placeholder="Search tools..." value={state.toolSearch} onChange={(event) => state.setToolSearch(event.target.value)} />
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {schemas.map((schema) => (
          <button
            key={schema.name}
            className={`w-full rounded-lg border p-3 text-left transition ${
              schema.name === state.selectedSchemaName
                ? "border-atl-cyan bg-atl-cyan/10"
                : "border-atl-ridge/70 bg-atl-void/30 hover:border-atl-cyan-bright"
            }`}
            onClick={() => state.selectSchema(schema.name)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{schema.name}</span>
              <span className="atl-chip">{schema.arguments.length + schema.parameters.length}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-atl-frost">{schema.description || "No description"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {schema.tags.slice(0, 3).map((tag) => (
                <span key={tag.name} className="atl-chip" style={{ borderColor: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <IconButton icon={Plus} label="New Schema" variant="secondary" className="mt-3 w-full" onClick={state.newSchema} />
    </aside>
  );
}

function CommandPanel() {
  const state = useCommandWizardStore();
  const preview = commandPreviewForState(state);
  const schema = selectSelectedSchema(state);
  const issues = selectSchemaIssues(state);
  return (
    <aside className="atl-panel flex min-h-0 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-frost">Command Preview</p>
          <h2 className="text-lg font-semibold">{schema?.name ?? "No schema"}</h2>
        </div>
        <span className={issues.length ? "atl-chip-warning" : "atl-chip atl-chip-active"}>{issues.length ? "Needs Review" : "Valid"}</span>
      </div>
      <pre className="atl-code mt-4 min-h-32 p-4">{preview || "Select a tool and fill fields to assemble a command."}</pre>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <IconButton icon={Clipboard} label="Copy" variant="primary" onClick={state.copyCommand} />
        <IconButton icon={BookMarked} label="Save" variant="secondary" onClick={state.saveFavorite} />
      </div>
      <div className="mt-5 border-t border-atl-ridge/70 pt-4">
        <label className="atl-label">Task Label</label>
        <input className="atl-input" value={state.taskLabel} onChange={(event) => state.setTaskLabel(event.target.value)} placeholder="optional label" />
      </div>
      <div className="mt-5 min-h-0 flex-1 overflow-auto">
        <p className="atl-label">Validation</p>
        <div className="space-y-2">
          {(issues.length ? issues : ["Schema is ready for command building."]).map((issue) => (
            <div key={issue} className="atl-card-soft p-2 text-sm text-atl-silver">
              {issue}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function BuilderView() {
  const state = useCommandWizardStore();
  const schema = selectSelectedSchema(state);
  if (!schema) return <EmptyState title="No schemas loaded" body="Create or import a schema to begin." />;
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Builder</p>
          <h1 className="text-2xl font-semibold">{schema.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-atl-frost">{schema.description}</p>
        </div>
        <select className="atl-input max-w-64" value={state.selectedActionName} onChange={(event) => state.selectAction(event.target.value)}>
          <option value="">No action</option>
          {schema.actions.map((action) => (
            <option key={action.name} value={action.name}>
              {action.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="atl-card p-4">
          <h2 className="font-semibold">Options</h2>
          <div className="mt-3 space-y-3">
            {state.options.map((option) => (
              <div key={option.key} className="atl-card-soft p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-atl-silver">{option.argument.long || option.argument.flag}</p>
                    <p className="text-xs text-atl-frost">{option.argument.description}</p>
                  </div>
                  {option.argument.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={option.selected}
                      onChange={(event) => state.updateOption(option.key, { selected: event.target.checked })}
                    />
                  ) : (
                    <input
                      className="atl-input max-w-56"
                      value={option.value}
                      onChange={(event) => state.updateOption(option.key, { value: event.target.value })}
                      placeholder={option.argument.type}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="atl-card p-4">
          <h2 className="font-semibold">Parameters</h2>
          <div className="mt-3 space-y-3">
            {state.parameters.map((parameter) => (
              <label key={parameter.key} className="block">
                <span className="atl-label">
                  {parameter.parameter.name}
                  {!parameter.parameter.required ? " optional" : ""}
                </span>
                <input
                  className="atl-input"
                  value={parameter.value}
                  onChange={(event) => state.updateParameter(parameter.key, event.target.value)}
                  placeholder={parameter.parameter.type}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ImportView() {
  const state = useCommandWizardStore();
  const [rowText, setRowText] = useState("");
  const draft = state.importDraft;
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Import Workbench</p>
          <h1 className="text-2xl font-semibold">Review before saving</h1>
        </div>
        <div className="flex gap-2">
          <IconButton icon={FileInput} label="Parse Paste" variant="secondary" onClick={state.createDraftFromPaste} />
          <IconButton icon={RefreshCw} label="Capture Help" variant="primary" onClick={state.createDraftFromCommand} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[22rem_1fr]">
        <div className="atl-card p-4">
          <label className="atl-label">Command</label>
          <input className="atl-input" value={state.importCommandName} onChange={(event) => state.setImportField("importCommandName", event.target.value)} placeholder="winget" />
          <label className="atl-label mt-3">Help Arguments</label>
          <input className="atl-input" value={state.importHelpArgs} onChange={(event) => state.setImportField("importHelpArgs", event.target.value)} placeholder="--help" />
          <label className="mt-3 flex items-center gap-2 text-sm text-atl-silver">
            <input type="checkbox" checked={state.importUseCompletion} onChange={(event) => state.setImportUseCompletion(event.target.checked)} />
            Merge completion data
          </label>
          <label className="atl-label mt-4">Pasted Help Text</label>
          <textarea className="atl-input min-h-80" value={state.importHelpText} onChange={(event) => state.setImportField("importHelpText", event.target.value)} />
        </div>
        <div className="space-y-4">
          {draft ? <DraftEditor draft={draft} /> : <EmptyState title="No import draft yet" body="Capture help or paste help text to stage detected rows." />}
          {draft && (
            <div className="atl-card p-4">
              <label className="atl-label">Add Rows</label>
              <textarea className="atl-input" value={rowText} onChange={(event) => setRowText(event.target.value)} placeholder="Paste action, argument, or parameter rows here." />
              <div className="mt-2 flex flex-wrap gap-2">
                <IconButton icon={Plus} label="Actions" onClick={() => state.addDraftRows("actions", rowText)} />
                <IconButton icon={Plus} label="Arguments" onClick={() => state.addDraftRows("arguments", rowText)} />
                <IconButton icon={Plus} label="Parameters" onClick={() => state.addDraftRows("parameters", rowText)} />
                <IconButton icon={Save} label="Save Schema" variant="primary" onClick={state.saveDraftAsSchema} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DraftEditor({ draft }: { draft: HelpImportDraft }) {
  const updateDraft = useCommandWizardStore((state) => state.updateDraft);
  const setArray = <T,>(key: "stagedActions" | "stagedArguments" | "stagedParameters", rows: T[]) => updateDraft({ [key]: rows } as Partial<HelpImportDraft>);
  return (
    <div className="space-y-4">
      <div className="atl-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className="atl-label">Tool Name</span>
            <input className="atl-input" value={draft.toolName} onChange={(event) => updateDraft({ toolName: event.target.value })} />
          </label>
          <label>
            <span className="atl-label">Installed Name</span>
            <input className="atl-input" value={draft.installedName} onChange={(event) => updateDraft({ installedName: event.target.value })} />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="atl-label">Description</span>
          <input className="atl-input" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} />
        </label>
      </div>
      {draft.parseWarnings.length > 0 && (
        <div className="atl-card border-atl-brass/60 p-4">
          <p className="atl-label text-atl-brass">Warnings</p>
          {draft.parseWarnings.map((warning) => (
            <p key={warning} className="text-sm text-atl-silver">
              {warning}
            </p>
          ))}
        </div>
      )}
      <Bucket title="Actions" count={draft.stagedActions.length}>
        {draft.stagedActions.map((action, index) => (
          <div className="grid gap-2 md:grid-cols-[12rem_1fr]" key={`${action.name}-${index}`}>
            <input className="atl-input" value={action.name} onChange={(event) => setArray("stagedActions", draft.stagedActions.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} />
            <input className="atl-input" value={action.description} onChange={(event) => setArray("stagedActions", draft.stagedActions.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)))} />
          </div>
        ))}
      </Bucket>
      <Bucket title="Arguments" count={draft.stagedArguments.length}>
        {draft.stagedArguments.map((argument, index) => (
          <ArgumentRow key={`${argument.flag}-${index}`} argument={argument} onChange={(patch) => setArray("stagedArguments", draft.stagedArguments.map((row, i) => (i === index ? { ...row, ...patch } : row)))} />
        ))}
      </Bucket>
      <Bucket title="Parameters" count={draft.stagedParameters.length}>
        {draft.stagedParameters.map((parameter, index) => (
          <ParameterRow key={`${parameter.name}-${index}`} parameter={parameter} onChange={(patch) => setArray("stagedParameters", draft.stagedParameters.map((row, i) => (i === index ? { ...row, ...patch } : row)))} />
        ))}
      </Bucket>
    </div>
  );
}

function Bucket({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="atl-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="atl-chip">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ArgumentRow({ argument, onChange }: { argument: SchemaArgument; onChange: (patch: Partial<SchemaArgument>) => void }) {
  return (
    <div className="grid gap-2 xl:grid-cols-[7rem_9rem_7rem_8rem_1fr]">
      <input className="atl-input" value={argument.flag} onChange={(event) => onChange({ flag: event.target.value })} />
      <input className="atl-input" value={argument.long} onChange={(event) => onChange({ long: event.target.value })} />
      <input className="atl-input" value={argument.type} onChange={(event) => onChange({ type: event.target.value })} />
      <select className="atl-input" value={argument.valueStyle} onChange={(event) => onChange({ valueStyle: event.target.value as ArgumentValueStyle })}>
        <option value="space">space</option>
        <option value="equals">equals</option>
        <option value="attached">attached</option>
      </select>
      <input className="atl-input" value={argument.description} onChange={(event) => onChange({ description: event.target.value })} />
    </div>
  );
}

function ParameterRow({ parameter, onChange }: { parameter: SchemaParameter; onChange: (patch: Partial<SchemaParameter>) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_10rem_6rem]">
      <input className="atl-input" value={parameter.name} onChange={(event) => onChange({ name: event.target.value })} />
      <input className="atl-input" value={parameter.type} onChange={(event) => onChange({ type: event.target.value })} />
      <label className="flex items-center gap-2 text-sm text-atl-silver">
        <input type="checkbox" checked={parameter.required} onChange={(event) => onChange({ required: event.target.checked })} />
        required
      </label>
    </div>
  );
}

function SchemaView() {
  const state = useCommandWizardStore();
  const schema = selectSelectedSchema(state);
  const toml = selectTomlPreview(state);
  if (!schema) return <EmptyState title="No schema selected" body="Create or import a schema first." />;
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Schema Studio</p>
          <h1 className="text-2xl font-semibold">{schema.name}</h1>
        </div>
        <div className="flex gap-2">
          <IconButton icon={Save} label="Save Schema" variant="primary" onClick={state.saveSelectedSchema} />
          <IconButton icon={Trash2} label="Delete" variant="warning" onClick={state.deleteSelectedSchema} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_28rem]">
        <div className="space-y-4">
          <div className="atl-card grid gap-3 p-4 md:grid-cols-2">
            <label>
              <span className="atl-label">Tool Name</span>
              <input className="atl-input" value={schema.name} onChange={(event) => state.updateSelectedSchema({ name: event.target.value })} />
            </label>
            <label>
              <span className="atl-label">Installed Name</span>
              <input className="atl-input" value={schema.installedName} onChange={(event) => state.updateSelectedSchema({ installedName: event.target.value })} />
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Description</span>
              <input className="atl-input" value={schema.description} onChange={(event) => state.updateSelectedSchema({ description: event.target.value })} />
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Notes</span>
              <textarea className="atl-input" value={schema.notes} onChange={(event) => state.updateSelectedSchema({ notes: event.target.value })} />
            </label>
          </div>
          <Bucket title="Actions" count={schema.actions.length}>
            {schema.actions.map((action, index) => (
              <div className="grid gap-2 md:grid-cols-[12rem_1fr_auto]" key={`${action.name}-${index}`}>
                <input className="atl-input" value={action.name} onChange={(event) => state.updateAction(index, { name: event.target.value })} />
                <input className="atl-input" value={action.description} onChange={(event) => state.updateAction(index, { description: event.target.value })} />
                <IconButton icon={Trash2} label="Remove" onClick={() => state.removeRow("action", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Action" onClick={state.addAction} />
          </Bucket>
          <Bucket title="Arguments" count={schema.arguments.length}>
            {schema.arguments.map((argument, index) => (
              <div className="flex gap-2" key={`${argument.flag}-${index}`}>
                <div className="flex-1">
                  <ArgumentRow argument={argument} onChange={(patch) => state.updateArgument(index, patch)} />
                </div>
                <IconButton icon={Trash2} label="Remove" onClick={() => state.removeRow("argument", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Argument" onClick={state.addArgument} />
          </Bucket>
          <Bucket title="Parameters" count={schema.parameters.length}>
            {schema.parameters.map((parameter, index) => (
              <div className="flex gap-2" key={`${parameter.name}-${index}`}>
                <div className="flex-1">
                  <ParameterRow parameter={parameter} onChange={(patch) => state.updateParameterDef(index, patch)} />
                </div>
                <IconButton icon={Trash2} label="Remove" onClick={() => state.removeRow("parameter", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Parameter" onClick={state.addParameter} />
          </Bucket>
          <Bucket title="Tags" count={schema.tags.length}>
            {schema.tags.map((tag, index) => (
              <div className="grid gap-2 md:grid-cols-[1fr_8rem_auto]" key={`${tag.name}-${index}`}>
                <input className="atl-input" value={tag.name} onChange={(event) => state.updateTag(index, { name: event.target.value })} />
                <input className="atl-input" value={tag.color} onChange={(event) => state.updateTag(index, { color: event.target.value })} />
                <IconButton icon={Trash2} label="Remove" onClick={() => state.removeRow("tag", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Tag" onClick={state.addTag} />
          </Bucket>
        </div>
        <pre className="atl-code sticky top-4 max-h-[calc(100vh-9rem)] p-4">{toml}</pre>
      </div>
    </section>
  );
}

function LibraryView() {
  const state = useCommandWizardStore();
  const favorites = selectFilteredFavorites(state);
  const tags = useMemo(() => selectFavoriteTags(state.favorites), [state.favorites]);
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Command Library</p>
          <h1 className="text-2xl font-semibold">Favorites Quick Copy</h1>
        </div>
        <div className="flex gap-2">
          <IconButton icon={FolderOpen} label="JSON" onClick={() => state.exportFavorites("json")} />
          <IconButton icon={FolderOpen} label="Text" onClick={() => state.exportFavorites("text")} />
          <IconButton icon={Trash2} label="Clear" variant="warning" onClick={state.clearFavorites} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_12rem]">
        <input className="atl-input" placeholder="Search favorites..." value={state.favoriteSearch} onChange={(event) => state.setFavoriteSearch(event.target.value)} />
        <select className="atl-input" value={state.favoriteTag} onChange={(event) => state.setFavoriteTag(event.target.value)}>
          {tags.map((tag) => (
            <option key={tag}>{tag}</option>
          ))}
        </select>
      </div>
      <div className="mt-5 space-y-3">
        {favorites.map((favorite) => (
          <div className="atl-card p-4" key={favorite.createdAt}>
            <pre className="font-mono text-sm text-atl-silver">{favorite.command}</pre>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-atl-frost">
              <span>
                {favorite.tool} {favorite.action ? `/ ${favorite.action}` : ""} {favorite.task ? `/ ${favorite.task}` : ""}
              </span>
              <div className="flex gap-2">
                <IconButton icon={Clipboard} label="Copy" onClick={() => navigator.clipboard.writeText(favorite.command)} />
                <IconButton icon={Trash2} label="Remove" onClick={() => state.removeFavorite(favorite.createdAt)} />
              </div>
            </div>
          </div>
        ))}
        {favorites.length === 0 && <EmptyState title="No favorites match" body="Saved commands will appear here with search and tag filtering." />}
      </div>
    </section>
  );
}

function SettingsView() {
  const state = useCommandWizardStore();
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Settings / Evidence</p>
          <h1 className="text-2xl font-semibold">Local-first runtime</h1>
        </div>
        <IconButton icon={RefreshCw} label="Refresh Log" onClick={state.refreshLog} />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Evidence label="Data Root" value={state.dataRoot} />
        <Evidence label="Visual System" value="Blue Slate active dependency" />
        <Evidence label="Safety" value="Copy/export only; generated commands are not executed" />
        <Evidence label="Legacy" value="WPF source and release evidence preserved" />
        <Evidence label="Schemas" value={`${state.schemas.length} loaded`} />
        <Evidence label="Favorites" value={`${state.favorites.length} saved`} />
      </div>
      <pre className="atl-code mt-5 max-h-96 p-4">{state.logText || "No log entries loaded."}</pre>
    </section>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="atl-card p-4">
      <p className="atl-label">{label}</p>
      <p className="break-words text-sm text-atl-silver">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="atl-card flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <Cog size={28} className="text-atl-cyan-bright" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-atl-frost">{body}</p>
    </div>
  );
}

export default function App() {
  const state = useCommandWizardStore();
  useEffect(() => {
    void state.load();
  }, []);
  return (
    <main className="atl-shell flex h-screen min-h-0 flex-col p-3">
      <header className="atl-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg border border-atl-cyan/60 bg-atl-cyan/10">
            <Wand2 size={18} className="text-atl-cyan-bright" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">CommandWizard</h1>
            <p className="text-xs text-atl-frost">Tauri v2 rebuild · Blue Slate · copy/export only</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                state.view === item.id ? "bg-atl-cyan/15 text-atl-cyan-bright" : "text-atl-silver hover:bg-atl-slate/50"
              }`}
              onClick={() => state.setView(item.id)}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <ToolRail />
        {state.view === "builder" && <BuilderView />}
        {state.view === "import" && <ImportView />}
        {state.view === "schema" && <SchemaView />}
        {state.view === "library" && <LibraryView />}
        {state.view === "settings" && <SettingsView />}
        <CommandPanel />
      </div>
      <footer className="mt-3 flex items-center justify-between rounded-lg border border-atl-ridge/70 bg-atl-void/70 px-3 py-2 text-xs text-atl-frost">
        <span>{state.status}</span>
        <span>{state.isLoading ? "loading" : "ready"}</span>
      </footer>
    </main>
  );
}
