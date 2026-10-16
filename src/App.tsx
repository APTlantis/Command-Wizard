import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Clipboard,
  Cog,
  FileInput,
  FolderOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Wand2,
  XCircle,
  Zap
} from "lucide-react";
import {
  AutoFixHigh,
  DataObject,
  DeleteOutlined,
  LibraryBooks,
  Storage,
  Terminal,
  UploadFile
} from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./lib/runtime";
import { IconButton } from "./components/IconButton";
import { ThemePicker, ThemeStudio } from "./components/ThemeStudio";
import { useThemeStore, selectedTheme } from "./stores/useThemeStore";
import { LibraryWorkspace, LibrarySaveDialog } from "./components/LibraryWorkspace";
import { asSizedIcon } from "./components/muiIcon";
import { cliPresets } from "./lib/cliPresets";
import { commandCategories, commandCategory, categoryTags, type CommandCategory } from "./lib/commandCategory";
import {
  commandPreviewForState,
  selectFilteredSchemas,
  selectRailSchemaHealth,
  selectSchemaHealth,
  selectSelectedSchema,
  selectTomlPreview,
  useCommandWizardStore
} from "./stores/useCommandWizardStore";
import type { ArgumentValueStyle, HelpImportDraft, SchemaArgument, SchemaParameter } from "./types";

const AutoFixHighIcon = asSizedIcon(AutoFixHigh);
const UploadFileIcon = asSizedIcon(UploadFile);
const TerminalIcon = asSizedIcon(Terminal);
const DataObjectIcon = asSizedIcon(DataObject);
const LibraryBooksIcon = asSizedIcon(LibraryBooks);
const StorageIcon = asSizedIcon(Storage);
const DeleteOutlinedIcon = asSizedIcon(DeleteOutlined);

const nav = [
  { id: "builder", label: "Builder", icon: AutoFixHighIcon },
  { id: "import", label: "Import", icon: UploadFileIcon },
  { id: "schema", label: "Schema", icon: DataObjectIcon },
  { id: "library", label: "Library", icon: LibraryBooksIcon },
  { id: "settings", label: "Evidence", icon: StorageIcon }
] as const;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightToml(code: string) {
  if (typeof window === "undefined") return escapeHtml(code);
  const grammar = window.Prism?.languages?.toml;
  return grammar && window.Prism ? window.Prism.highlight(code, grammar, "toml") : escapeHtml(code);
}

function highlightBash(code: string) {
  if (typeof window === "undefined") return escapeHtml(code);
  const grammar = window.Prism?.languages?.bash;
  return grammar && window.Prism ? window.Prism.highlight(code, grammar, "bash") : escapeHtml(code);
}

function lineNumbersFor(value: string) {
  return Array.from({ length: Math.max(1, value.split("\n").length) }, (_, index) => index + 1);
}

function StructuredTextArea({
  id,
  label,
  value,
  onChange,
  minLines = 10,
  placeholder = "",
  className = ""
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLines?: number;
  placeholder?: string;
  className?: string;
}) {
  const lines = useMemo(() => lineNumbersFor(value), [value]);
  return (
    <div className={`atl-structured-field ${className}`}>
      <div className="atl-structured-gutter" aria-hidden="true">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <textarea
        id={id}
        aria-label={label}
        className="atl-structured-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={Math.max(minLines, lines.length)}
        spellCheck={false}
      />
    </div>
  );
}

function TomlPreview({ code, className = "" }: { code: string; className?: string }) {
  const highlighted = useMemo(() => highlightToml(code), [code]);
  const lines = useMemo(() => lineNumbersFor(code), [code]);
  return (
    <div className={`atl-code atl-code-prism atl-code-lines language-toml ${className}`}>
      <div className="atl-code-gutter" aria-hidden="true">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <pre>
        <code className="language-toml" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function CommandCodeBlock({ code, className = "" }: { code: string; className?: string }) {
  const highlighted = useMemo(() => highlightBash(code), [code]);
  return (
    <div className={`atl-code atl-code-prism language-bash ${className}`}>
      <pre>
        <code className="language-bash" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function PlainCodeBlock({ value, className = "" }: { value: string; className?: string }) {
  const lines = useMemo(() => lineNumbersFor(value), [value]);
  return (
    <div className={`atl-code atl-code-lines ${className}`}>
      <div className="atl-code-gutter" aria-hidden="true">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <pre>{value}</pre>
    </div>
  );
}

function ToolRail() {
  const state = useCommandWizardStore();
  const schemas = selectFilteredSchemas(state);
  const families = [...new Set(schemas.map((schema) => schema.family || schema.name))];
  const renderSchema = (schema: typeof schemas[number]) => {
    const health = selectRailSchemaHealth(state, schema);
    return <button key={schema.name} className={`atl-card w-full p-3 text-left ${schema.name === state.selectedSchemaName ? "border-atl-cyan bg-atl-cyan/10" : "hover:border-atl-cyan-bright"}`} onClick={() => state.selectSchema(schema.name)}>
      <span className="block break-words font-semibold">{schema.name}</span>
      {health.railLabel === "Missing Executable" && <span className="text-xs text-atl-brass">Missing Executable</span>}
      <p className="mt-1 line-clamp-2 text-xs text-atl-frost">{schema.description || "No description"}</p>
      <div className="mt-2 flex flex-wrap gap-1">{schema.tags.filter((tag) => !tag.name.startsWith("workspace:")).slice(0, 3).map((tag) => <span key={tag.name} className="atl-chip" style={{ borderColor: tag.color }}>{tag.name}</span>)}</div>
    </button>;
  };
  return (
    <aside className="atl-panel flex min-h-0 flex-col p-3">
      <div className="flex items-center gap-2">
        <Search size={15} className="text-atl-frost" />
        <input className="atl-input" placeholder="Search tools..." value={state.toolSearch} onChange={(event) => state.setToolSearch(event.target.value)} />
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {state.toolSearch.trim() ? schemas.map(renderSchema) : families.map((family) => {
          const members = schemas.filter((schema) => (schema.family || schema.name) === family);
          return members.length === 1 && !members[0].family ? renderSchema(members[0]) : <details key={family} open={members.some((schema) => schema.name === state.selectedSchemaName)}><summary className="cursor-pointer rounded-md bg-atl-void/30 px-3 py-2 text-sm font-semibold">{family} <span className="text-atl-frost">({members.length})</span></summary><div className="mt-2 space-y-2 pl-2">{members.map(renderSchema)}</div></details>;
        })}
      </div>
      <IconButton icon={Plus} label="New Schema" variant="secondary" className="mt-3 w-full" onClick={state.newSchema} />
    </aside>
  );
}

function CommandPanel() {
  const state = useCommandWizardStore();
  const preview = commandPreviewForState(state);
  const schema = selectSelectedSchema(state);
  const health = selectSchemaHealth(state);
  const commandCheck = health.checks.find((check) => check.id === "command");
  return (
    <aside className="atl-panel flex min-h-0 flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-frost">Command Preview</p>
          <h2 className="text-lg font-semibold">{schema?.name ?? "No schema"}</h2>
        </div>
        {commandCheck?.state === "pass" && <span className="atl-chip atl-chip-active">Ready.</span>}
      </div>
      <PlainCodeBlock value={preview || "Select a tool and fill fields to assemble a command."} className="mt-4 min-h-32 p-4" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <IconButton icon={Clipboard} label="Copy" variant="primary" onClick={state.copyCommand} />
        <IconButton icon={BookMarked} label="Save to Library" variant="secondary" onClick={state.saveFavorite} />
      </div>
      {state.librarySavedId && <IconButton icon={BookMarked} label="View in Library" className="mt-3" onClick={() => { state.setView("library"); state.openLibraryEntry(state.librarySavedId); }} />}
      <div className="mt-5 border-t border-atl-ridge/70 pt-4">
        <label className="atl-label">Task Label</label>
        <input className="atl-input" value={state.taskLabel} onChange={(event) => state.setTaskLabel(event.target.value)} placeholder="optional label" />
      </div>
      <div className="mt-5 min-h-0 flex-1 overflow-auto">
        <p className="atl-label">Validation</p>
        <div className="space-y-2">
          {health.checks.filter((check) => check.id !== "command").map((check) => (
            <div key={check.id} className="atl-card-soft flex items-start gap-2 p-2 text-sm text-atl-silver">
              {check.state === "pass" ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-atl-green" />
              ) : check.state === "warn" ? (
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-atl-brass" />
              ) : (
                <XCircle size={15} className="mt-0.5 shrink-0 text-atl-amber" />
              )}
              <div>
                <p className="font-semibold text-atl-archive">{check.label}</p>
                <p className="text-xs text-atl-frost">{check.message}</p>
              </div>
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
  if (!schema) return <EmptyState title="No commands in this tab" body="Create or import a schema, then choose its command category in Schema Studio." />;
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Builder</p>
          <h1 className="text-2xl font-semibold">{schema.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-atl-frost">{schema.description}</p>
          {state.transientSchema && <p className="mt-2 text-xs text-atl-brass">Saved Builder snapshot · select an installed command to leave this snapshot.</p>}
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

      <div className="mt-6 space-y-4">
        {state.parameters.length > 0 && <div className="atl-card p-4" data-testid="builder-parameters">
          <h2 className="font-semibold">Parameters</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {state.parameters.map((parameter, index) => (
              <label key={parameter.key} className={index === state.parameters.length - 1 && state.parameters.length % 2 === 1 ? "block md:col-span-2" : "block"}>
                <span className="atl-label">
                  {parameter.parameter.name}
                  {!parameter.parameter.required ? " optional" : ""}
                </span>
                <input className="atl-input" value={parameter.value} onChange={(event) => state.updateParameter(parameter.key, event.target.value)} placeholder={parameter.parameter.type} />
              </label>
            ))}
          </div>
        </div>}
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
      </div>
    </section>
  );
}

function ImportView() {
  const state = useCommandWizardStore();
  const [rowText, setRowText] = useState("");
  const draft = state.importDraft;
  const captureHelpTitle = state.canCaptureHelp
    ? "Run the command with the selected help arguments and stage the output."
    : "Capture Help is only available in the Tauri desktop app. Paste help text in browser preview.";
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Import Workbench</p>
          <h1 className="text-2xl font-semibold">Review before saving</h1>
        </div>
        <div className="flex gap-2">
          <IconButton icon={FileInput} label="Parse Paste" variant="secondary" onClick={state.createDraftFromPaste} />
          <IconButton
            icon={RefreshCw}
            label={state.canCaptureHelp ? "Capture Help" : "Desktop Only"}
            variant={state.canCaptureHelp ? "primary" : "ghost"}
            onClick={state.createDraftFromCommand}
            title={captureHelpTitle}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[22rem_1fr]">
        <div className="atl-card p-4">
          {!state.canCaptureHelp && (
            <div className="mb-4 rounded-lg border border-atl-brass/60 bg-atl-brass/10 p-3 text-sm text-atl-silver">
              Browser preview cannot run local commands. Paste help output below, or launch the Tauri desktop app to capture help directly.
            </div>
          )}
          <label className="atl-label">Command</label>
          <input className="atl-input" value={state.importCommandName} onChange={(event) => state.setImportField("importCommandName", event.target.value)} placeholder="winget" />
          <label className="atl-label mt-3">Help Arguments</label>
          <input className="atl-input" value={state.importHelpArgs} onChange={(event) => state.setImportField("importHelpArgs", event.target.value)} placeholder="--help" />
          <label className="mt-3 flex items-center gap-2 text-sm text-atl-silver">
            <input type="checkbox" checked={state.importUseCompletion} onChange={(event) => state.setImportUseCompletion(event.target.checked)} />
            Merge completion data
          </label>
          <div className="mt-4 flex items-center justify-between gap-2">
            <label className="atl-label mb-0" htmlFor="import-help-text">
              Pasted Help Text
            </label>
            <IconButton icon={DeleteOutlinedIcon} label="Clear" variant="ghost" onClick={state.clearImportHelpText} title="Clear pasted help text" />
          </div>
          <StructuredTextArea
            id="import-help-text"
            label="Pasted Help Text"
            className="max-h-[28rem]"
            minLines={16}
            value={state.importHelpText}
            onChange={(value) => state.setImportField("importHelpText", value)}
          />
        </div>
        <div className="space-y-4">
          {draft ? (
            <DraftEditor draft={draft} onChange={state.updateDraft} />
          ) : (
            <EmptyState
              title="No import draft yet"
              body={state.canCaptureHelp ? "Capture help or paste help text to stage detected rows." : "Paste help text and use Parse Paste, or open the Tauri desktop app for live capture."}
            />
          )}
          {draft && (
            <div className="atl-card p-4">
              <label className="atl-label">Add Rows</label>
              <StructuredTextArea
                id="import-extra-rows"
                label="Add Rows"
                minLines={6}
                value={rowText}
                onChange={setRowText}
                placeholder="Paste action, argument, or parameter rows here."
              />
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

function CliView() {
  const state = useCommandWizardStore();
  const draft = state.cliDraft;
  const install = state.cliLastInstall;
  const presetGroups = useMemo(
    () =>
      Array.from(new Set(cliPresets.map((preset) => preset.family))).map((family) => ({
        family,
        presets: cliPresets.filter((preset) => preset.family === family)
      })),
    []
  );
  const copyPreset = async (command: string, title: string) => {
    await navigator.clipboard.writeText(command);
    state.setStatus(`${title} copied to clipboard.`);
  };
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">CLI Import</p>
          <h1 className="text-2xl font-semibold">Standards command desk</h1>
        </div>
        <div className="flex gap-2">
          <IconButton icon={FolderOpen} label="Choose Script" variant="secondary" onClick={state.chooseCliScript} />
          <IconButton icon={FileInput} label="Import CLI" variant="primary" onClick={state.importCliScript} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[24rem_1fr]">
        <div className="space-y-4">
          <div className="atl-card p-4">
            {!state.canCaptureHelp && (
              <div className="mb-4 rounded-lg border border-atl-brass/60 bg-atl-brass/10 p-3 text-sm text-atl-silver">
                CLI import needs the Tauri desktop app. Browser preview can only stage interface changes.
              </div>
            )}
            <label className="atl-label">Script Path</label>
            <input className="atl-input" value={state.cliScriptPath} onChange={(event) => state.setCliField("cliScriptPath", event.target.value)} placeholder="D:\\tools\\my-script.ps1" />
            <label className="atl-label mt-3">Command Name</label>
            <input className="atl-input" value={state.cliCommandName} onChange={(event) => state.setCliField("cliCommandName", event.target.value)} placeholder="my-script" />
            <label className="atl-label mt-3">Help Arguments</label>
            <input className="atl-input" value={state.cliHelpArgs} onChange={(event) => state.setCliField("cliHelpArgs", event.target.value)} placeholder="--help" />
          </div>
          <div className="atl-card p-4">
            <p className="atl-label">Standards Quick Starts</p>
            <div className="mt-3 space-y-3">
              {presetGroups.map((group) => (
                <div key={group.family} className="atl-card-soft p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{group.family}</h2>
                    <span className="atl-chip">{group.presets.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.presets.map((preset) => (
                      <div key={preset.id} className="rounded-md border border-atl-ridge/60 bg-atl-void/35 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-atl-archive">{preset.title}</p>
                            <p className="mt-1 text-xs text-atl-frost">{preset.description}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <IconButton icon={Clipboard} label="Copy" title={`Copy ${preset.title}`} onClick={() => copyPreset(preset.command, preset.title)} />
                            <IconButton icon={Save} label="Save" title={`Save ${preset.title}`} onClick={() => state.saveCliPreset(preset)} />
                          </div>
                        </div>
                        <CommandCodeBlock code={preset.command} className="mt-2 max-h-24 p-2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="atl-card p-4">
            <p className="atl-label">PATH Directory</p>
            <p className="break-words font-mono text-sm text-atl-silver">{install?.binDir || (state.dataRoot ? `${state.dataRoot}\\bin` : "Loads after startup")}</p>
            <p className="mt-3 text-sm text-atl-frost">
              Add this directory to PATH once. CommandWizard will place imported script launchers there.
            </p>
          </div>
          {install && (
            <div className="atl-card p-4">
              <p className="atl-label">Last Import</p>
              <div className="space-y-2 text-sm text-atl-silver">
                <p className="break-words">Command: <span className="font-mono">{install.commandName}</span></p>
                <p className="break-words">Launcher: <span className="font-mono">{install.shimPath}</span></p>
                <p className="break-words">Managed script: <span className="font-mono">{install.managedScriptPath}</span></p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {draft ? (
            <>
              <DraftEditor draft={draft} onChange={state.updateCliDraft} />
              <div className="atl-card p-4">
                <IconButton icon={Save} label="Save CLI Schema" variant="primary" onClick={state.saveCliDraftAsSchema} />
              </div>
            </>
          ) : (
            <EmptyState title="No CLI staged yet" body="Copy or save a standards command, or choose a script to capture its interface." />
          )}
        </div>
      </div>
    </section>
  );
}

function DraftEditor({ draft, onChange }: { draft: HelpImportDraft; onChange: (patch: Partial<HelpImportDraft>) => void }) {
  const updateDraft = onChange;
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
    <div className="grid gap-2 xl:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1fr)_8rem_8rem]">
      <input className="atl-input min-w-0" value={argument.flag} onChange={(event) => onChange({ flag: event.target.value })} placeholder="flag" />
      <input className="atl-input min-w-0" value={argument.long} onChange={(event) => onChange({ long: event.target.value })} placeholder="long flag" />
      <input className="atl-input min-w-0" value={argument.type} onChange={(event) => onChange({ type: event.target.value })} placeholder="type" />
      <select className="atl-input" value={argument.valueStyle} onChange={(event) => onChange({ valueStyle: event.target.value as ArgumentValueStyle })}>
        <option value="space">space</option>
        <option value="equals">equals</option>
        <option value="attached">attached</option>
      </select>
      <select aria-label="Option placement" className="atl-input xl:col-span-4" value={argument.position ?? "after-prefix"} onChange={(event) => onChange({ position: event.target.value as SchemaArgument["position"] })}><option value="after-prefix">After command prefix</option><option value="before-prefix">Before command prefix (global option)</option></select>
      <input className="atl-input min-w-0 xl:col-span-4" value={argument.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="description" />
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
          <IconButton icon={DeleteOutlinedIcon} label="Delete" variant="warning" onClick={state.deleteSelectedSchema} />
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
            <label><span className="atl-label">Tool Family</span><input className="atl-input" value={schema.family ?? ""} onChange={(event) => state.updateSelectedSchema({ family: event.target.value })} /></label>
            <label><span className="atl-label">Fixed Command Prefix</span><input className="atl-input" value={(schema.commandPrefix ?? []).join(" ")} onChange={(event) => state.updateSelectedSchema({ commandPrefix: event.target.value.trim().split(/\s+/).filter(Boolean) })} placeholder="build or tunnel run" /></label>
            <label className="md:col-span-2">
              <span className="atl-label">Command Category</span>
              <select aria-label="Command Category" className="atl-input" value={commandCategory(schema)} onChange={(event) => state.updateSelectedSchema({ tags: categoryTags(schema, event.target.value as CommandCategory) })}>
                {commandCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Description</span>
              <input className="atl-input" value={schema.description} onChange={(event) => state.updateSelectedSchema({ description: event.target.value })} />
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Executable Path</span>
              <input className="atl-input" value={schema.executablePath} onChange={(event) => state.updateSelectedSchema({ executablePath: event.target.value })} />
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Notes</span>
              <textarea className="atl-input" value={schema.notes} onChange={(event) => state.updateSelectedSchema({ notes: event.target.value })} />
            </label>
          </div>
          <div className="atl-card grid gap-3 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="atl-label mb-1">Provenance Metadata</p>
              <h2 className="font-semibold">Schema source and validation record</h2>
            </div>
            <label>
              <span className="atl-label">Version</span>
              <input
                className="atl-input"
                value={schema.metadata.version}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, version: event.target.value } })}
              />
            </label>
            <label>
              <span className="atl-label">Author</span>
              <input
                className="atl-input"
                value={schema.metadata.author}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, author: event.target.value } })}
              />
            </label>
            <label>
              <span className="atl-label">Source</span>
              <input
                className="atl-input"
                value={schema.metadata.source}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, source: event.target.value } })}
              />
            </label>
            <label>
              <span className="atl-label">SHA-256</span>
              <input
                className="atl-input"
                value={schema.metadata.sha256}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, sha256: event.target.value } })}
              />
            </label>
            <label>
              <span className="atl-label">Homepage</span>
              <input
                className="atl-input"
                value={schema.metadata.homepage}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, homepage: event.target.value } })}
              />
            </label>
            <label>
              <span className="atl-label">Executable Version</span>
              <input
                className="atl-input"
                value={schema.metadata.executableVersion}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, executableVersion: event.target.value } })}
              />
            </label>
            <label className="md:col-span-2">
              <span className="atl-label">Last Validated</span>
              <input
                className="atl-input"
                value={schema.metadata.lastValidated}
                onChange={(event) => state.updateSelectedSchema({ metadata: { ...schema.metadata, lastValidated: event.target.value } })}
              />
            </label>
          </div>
          <Bucket title="Actions" count={schema.actions.length}>
            {schema.actions.map((action, index) => (
              <div className="grid gap-2 md:grid-cols-[minmax(10rem,16rem)_minmax(16rem,1fr)_auto]" key={`${action.name}-${index}`}>
                <input className="atl-input min-w-0" value={action.name} onChange={(event) => state.updateAction(index, { name: event.target.value })} placeholder="action" />
                <input className="atl-input min-w-0" value={action.description} onChange={(event) => state.updateAction(index, { description: event.target.value })} placeholder="description" />
                <IconButton icon={DeleteOutlinedIcon} label="Remove" onClick={() => state.removeRow("action", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Action" onClick={state.addAction} />
          </Bucket>
          <Bucket title="Arguments" count={schema.arguments.length}>
            {schema.arguments.map((argument, index) => (
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]" key={`${argument.flag}-${index}`}>
                <div className="min-w-0">
                  <ArgumentRow argument={argument} onChange={(patch) => state.updateArgument(index, patch)} />
                </div>
                <IconButton icon={DeleteOutlinedIcon} label="Remove" onClick={() => state.removeRow("argument", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Argument" onClick={state.addArgument} />
          </Bucket>
          <Bucket title="Parameters" count={schema.parameters.length}>
            {schema.parameters.map((parameter, index) => (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" key={`${parameter.name}-${index}`}>
                <div className="min-w-0">
                  <ParameterRow parameter={parameter} onChange={(patch) => state.updateParameterDef(index, patch)} />
                </div>
                <IconButton icon={DeleteOutlinedIcon} label="Remove" onClick={() => state.removeRow("parameter", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Parameter" onClick={state.addParameter} />
          </Bucket>
          <Bucket title="Tags" count={schema.tags.length}>
            {schema.tags.map((tag, index) => (
              <div className="grid gap-2 md:grid-cols-[1fr_8rem_auto]" key={`${tag.name}-${index}`}>
                <input className="atl-input" value={tag.name} onChange={(event) => state.updateTag(index, { name: event.target.value })} />
                <input className="atl-input" value={tag.color} onChange={(event) => state.updateTag(index, { color: event.target.value })} />
                <IconButton icon={DeleteOutlinedIcon} label="Remove" onClick={() => state.removeRow("tag", index)} />
              </div>
            ))}
            <IconButton icon={Plus} label="Add Tag" onClick={state.addTag} />
          </Bucket>
        </div>
        <TomlPreview code={toml} className="sticky top-4 max-h-[calc(100vh-9rem)] p-4" />
      </div>
    </section>
  );
}

function SettingsView() {
  const state = useCommandWizardStore();
  const theme = selectedTheme(useThemeStore());
  return (
    <section className="atl-panel min-h-0 overflow-auto p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-atl-cyan-bright">Settings / Evidence</p>
          <h1 className="text-2xl font-semibold">Local-first runtime</h1>
        </div>
        <IconButton icon={RefreshCw} label="Refresh Log" onClick={state.refreshLog} />
      </div>
      <ThemeStudio />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Evidence label="Data Root" value={state.dataRoot} />
        <Evidence label="Visual System" value={`${theme.name} · Blue Slate default`} />
        <Evidence label="Project" value="Tauri rebuild is the canonical implementation" />
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
  useEffect(() => {
    if (isTauriRuntime()) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      void getCurrentWindow().onCloseRequested((event) => {
        const current = useCommandWizardStore.getState();
        if (current.librarySaving) { event.preventDefault(); current.setStatus("Wait for the command save to finish before closing."); }
        else if ((current.libraryDirty || useThemeStore.getState().editorDirty) && !window.confirm("Discard unsaved changes and close CommandWizard?")) event.preventDefault();
      }).then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch(() => useCommandWizardStore.getState().setStatus("Could not enable the unsaved-command close prompt."));
      return () => { disposed = true; unlisten?.(); };
    }
    const protectDraft = (event: BeforeUnloadEvent) => {
      const current = useCommandWizardStore.getState();
      if (current.libraryDirty || current.librarySaving || useThemeStore.getState().editorDirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
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
            <p className="text-xs text-atl-frost">Local command workspace · copy/export only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemePicker />
          <button className="atl-button-ghost" onClick={() => state.setView("settings")}>Customize theme</button>
        </div>
        <nav className="flex flex-wrap gap-1">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                state.view === item.id ? "bg-atl-cyan/15 text-atl-cyan-bright" : "text-atl-silver hover:bg-atl-slate/50"
              }`}
              onClick={() => { if (state.view !== item.id && useThemeStore.getState().editorDirty && !window.confirm("Discard unsaved theme changes?")) return; state.setView(item.id); }}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {state.view === "builder" && <div role="tablist" aria-label="Command categories" className="cw-tabs mb-3">
        {commandCategories.map((category) => <button key={category.id} role="tab" aria-selected={state.commandCategory === category.id} className={`cw-tab rounded-md ${state.commandCategory === category.id ? "cw-tab-active bg-atl-cyan/15 text-atl-cyan-bright" : "text-atl-silver"}`} onClick={() => state.setCommandCategory(category.id)}>{category.label}</button>)}
      </div>}
      {state.view === "library" ? <LibraryWorkspace /> : <div className={`grid min-h-0 flex-1 auto-rows-[24rem] gap-3 overflow-auto lg:auto-rows-auto lg:grid-rows-1 lg:overflow-hidden ${state.view === "builder" && selectSelectedSchema(state) ? "lg:grid-cols-[18rem_minmax(0,1fr)_22rem]" : "lg:grid-cols-[18rem_minmax(0,1fr)]"}`}>
        <ToolRail />
        {state.view === "builder" && <BuilderView />}
        {state.view === "import" && <ImportView />}
        {state.view === "cli" && <CliView />}
        {state.view === "schema" && <SchemaView />}
        {state.view === "settings" && <SettingsView />}
        {state.view === "builder" && selectSelectedSchema(state) && <CommandPanel />}
      </div>}
      <LibrarySaveDialog />
      <footer className="mt-3 flex items-center justify-between rounded-lg border border-atl-ridge/70 bg-atl-void/70 px-3 py-2 text-xs text-atl-frost">
        <span>{state.status}</span>
        <span>{state.isLoading ? "loading" : state.runtimeLabel}</span>
      </footer>
    </main>
  );
}
