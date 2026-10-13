import { create } from "zustand";
import type {
  CliInstallResult,
  ExecutableHealth,
  FavoriteCommand,
  HelpImportDraft,
  OptionState,
  ParameterState,
  SchemaAction,
  SchemaArgument,
  SchemaParameter,
  SchemaTag,
  ToolSchema
} from "../types";
import { buildParts, makeOptionStates, makeParameterStates, tokensFromParts } from "../lib/commandBuilder";
import type { CliPreset } from "../lib/cliPresets";
import { filterFavorites } from "../lib/favorites";
import { clone, newEntry, normalizeEntry, validSnapshot, type LibraryEntry } from "../lib/library";
import {
  addActionLines,
  addArgumentLines,
  addParameterLines,
  buildSchemaFromDraft,
  createImportDraft
} from "../lib/helpImport";
import { emptySchema, serializeSchemaToml, validateSchema } from "../lib/schema";
import { schemaHealth } from "../lib/schemaHealth";
import { runtime } from "../lib/runtime";
import { commandCategory, categoryTags, type CommandCategory } from "../lib/commandCategory";

type View = "builder" | "import" | "cli" | "schema" | "library" | "settings";

interface StoreState {
  view: View;
  transientSchema: ToolSchema | null;
  transientExecutableHealth: ExecutableHealth | undefined;
  libraryDraft: LibraryEntry | null;
  libraryDirty: boolean;
  libraryModal: boolean;
  librarySaving: boolean;
  libraryError: string;
  librarySavedId: string;
  libraryCategory: string;
  setLibraryCategory: (category: string) => void;
  openLibraryEntry: (id?: string) => void;
  updateLibraryDraft: (patch: Partial<LibraryEntry>) => void;
  cancelLibraryDraft: () => void;
  commitLibraryDraft: () => Promise<void>;
  duplicateLibraryEntry: () => void;
  reopenLibraryEntry: () => void;
  commandCategory: CommandCategory;
  setCommandCategory: (category: CommandCategory) => void;
  dataRoot: string;
  schemas: ToolSchema[];
  executableHealth: Record<string, ExecutableHealth>;
  favorites: FavoriteCommand[];
  selectedSchemaName: string;
  selectedActionName: string;
  options: OptionState[];
  parameters: ParameterState[];
  taskLabel: string;
  toolSearch: string;
  favoriteSearch: string;
  favoriteTag: string;
  importCommandName: string;
  importHelpArgs: string;
  importHelpText: string;
  importUseCompletion: boolean;
  importDraft: HelpImportDraft | null;
  cliScriptPath: string;
  cliCommandName: string;
  cliHelpArgs: string;
  cliLastInstall: CliInstallResult | null;
  cliDraft: HelpImportDraft | null;
  status: string;
  runtimeLabel: string;
  canCaptureHelp: boolean;
  logText: string;
  isLoading: boolean;
  setView: (view: View) => void;
  setStatus: (status: string) => void;
  load: () => Promise<void>;
  selectSchema: (name: string) => void;
  selectAction: (name: string) => void;
  updateOption: (key: string, value: Partial<OptionState>) => void;
  updateParameter: (key: string, value: string) => void;
  setTaskLabel: (task: string) => void;
  setToolSearch: (search: string) => void;
  setFavoriteSearch: (search: string) => void;
  setFavoriteTag: (tag: string) => void;
  copyCommand: () => Promise<void>;
  saveFavorite: () => Promise<void>;
  removeFavorite: (createdAt: string) => Promise<void>;
  clearFavorites: () => Promise<void>;
  exportFavorites: (format: "json" | "text") => Promise<void>;
  newSchema: () => void;
  updateSelectedSchema: (patch: Partial<ToolSchema>) => void;
  updateAction: (index: number, patch: Partial<SchemaAction>) => void;
  updateArgument: (index: number, patch: Partial<SchemaArgument>) => void;
  updateParameterDef: (index: number, patch: Partial<SchemaParameter>) => void;
  updateTag: (index: number, patch: Partial<SchemaTag>) => void;
  addAction: () => void;
  addArgument: () => void;
  addParameter: () => void;
  addTag: () => void;
  removeRow: (kind: "action" | "argument" | "parameter" | "tag", index: number) => void;
  saveSelectedSchema: () => Promise<void>;
  deleteSelectedSchema: () => Promise<void>;
  setImportField: (field: "importCommandName" | "importHelpArgs" | "importHelpText", value: string) => void;
  clearImportHelpText: () => void;
  setImportUseCompletion: (enabled: boolean) => void;
  createDraftFromPaste: () => Promise<void>;
  createDraftFromCommand: () => Promise<void>;
  updateDraft: (patch: Partial<HelpImportDraft>) => void;
  updateCliDraft: (patch: Partial<HelpImportDraft>) => void;
  addDraftRows: (kind: "actions" | "arguments" | "parameters", lines: string) => void;
  saveDraftAsSchema: () => Promise<void>;
  setCliField: (field: "cliScriptPath" | "cliCommandName" | "cliHelpArgs", value: string) => void;
  chooseCliScript: () => Promise<void>;
  importCliScript: () => Promise<void>;
  saveCliPreset: (preset: CliPreset) => Promise<void>;
  saveCliDraftAsSchema: () => Promise<void>;
  refreshLog: () => Promise<void>;
}

const selectedSchema = (state: StoreState) => state.transientSchema ?? state.schemas.find((schema) => schema.name === state.selectedSchemaName) ?? null;
const selectedAction = (state: StoreState) => {
  const schema = selectedSchema(state);
  return schema?.actions.find((action) => action.name === state.selectedActionName) ?? null;
};
export const commandPreviewForState = (state: Pick<StoreState, "schemas" | "selectedSchemaName" | "selectedActionName" | "options" | "parameters"> & { transientSchema?: ToolSchema | null }) => {
  const schema = state.transientSchema ?? state.schemas.find((item) => item.name === state.selectedSchemaName) ?? null;
  const action = schema?.actions.find((item) => item.name === state.selectedActionName) ?? null;
  return tokensFromParts(buildParts(schema, action, state.options, state.parameters));
};

const syncSelection = (schemas: ToolSchema[], selectedName = "") => {
  const schema = schemas.find((item) => item.name === selectedName) ?? schemas[0] ?? null;
  return {
    transientSchema: null,
    transientExecutableHealth: undefined,
    commandCategory: schema ? commandCategory(schema) : "general" as CommandCategory,
    selectedSchemaName: schema?.name ?? "",
    selectedActionName: schema?.actions[0]?.name ?? "",
    options: schema ? makeOptionStates(schema, schema.actions[0]) : [],
    parameters: schema ? makeParameterStates(schema, schema.actions[0]) : []
  };
};

export const useCommandWizardStore = create<StoreState>((set, get) => ({
  view: "builder",
  transientSchema: null,
  transientExecutableHealth: undefined,
  libraryDraft: null,
  libraryDirty: false,
  libraryModal: false,
  librarySaving: false,
  libraryError: "",
  librarySavedId: "",
  libraryCategory: "All",
  setLibraryCategory: (libraryCategory) => set({ libraryCategory }),
  openLibraryEntry(id) {
    if (get().librarySaving) return;
    if (get().libraryDirty && !window.confirm("Discard unsaved command changes?")) return;
    const entry = get().favorites.find((entry) => entry.id === id);
    set({ libraryDraft: entry ? clone(normalizeEntry(entry)) : newEntry(), libraryDirty: false, libraryModal: false, libraryError: "" });
  },
  updateLibraryDraft(patch) {
    set((state) => ({ libraryDirty: true, libraryError: "", libraryDraft: state.libraryDraft ? { ...state.libraryDraft, ...patch, ...(patch.command !== undefined && patch.command !== state.libraryDraft.command ? { builderSnapshot: null } : {}) } : null }));
  },
  cancelLibraryDraft() {
    if (get().librarySaving) return;
    if (get().libraryDirty && !window.confirm("Discard unsaved command changes?")) return;
    const original = get().favorites.find((entry) => entry.id === get().libraryDraft?.id);
    set({ libraryDraft: original && !get().libraryModal ? clone(normalizeEntry(original)) : null, libraryDirty: false, libraryModal: false, libraryError: "" });
  },
  async commitLibraryDraft() {
    const state = get();
    if (!state.libraryDraft || state.librarySaving) return;
    if (!state.libraryDraft.title.trim() || !state.libraryDraft.command.trim()) return set({ libraryError: "Enter a title and command before saving." });
    const entry = { ...clone(state.libraryDraft), title: state.libraryDraft.title.trim(), tags: state.libraryDraft.tags.map((tag) => ({ ...tag, name: tag.name.trim() })).filter((tag, index, tags) => tag.name && tags.findIndex((other) => other.name === tag.name) === index), updatedAt: new Date().toISOString() };
    const favorites = state.favorites.some((item) => item.id === entry.id) ? state.favorites.map((item) => item.id === entry.id ? entry : item) : [...state.favorites, entry];
    set({ librarySaving: true, libraryError: "" });
    try {
      await runtime.saveFavorites(favorites);
      set({ favorites, libraryDraft: entry, libraryDirty: false, libraryModal: false, librarySaving: false, librarySavedId: entry.id, status: `Saved ${entry.title} to Library.` });
    } catch (error) { set({ librarySaving: false, libraryError: error instanceof Error ? error.message : "Could not save command." }); }
  },
  duplicateLibraryEntry() {
    const state = get();
    if (!state.libraryDraft || state.librarySaving) return;
    if (state.libraryDirty && !window.confirm("Discard unsaved command changes before duplicating?")) return;
    const original = state.favorites.find((entry) => entry.id === state.libraryDraft?.id);
    const entry = state.libraryDirty && original ? normalizeEntry(original) : state.libraryDraft;
    set({ libraryDraft: { ...clone(entry), id: crypto.randomUUID(), title: `${entry.title} copy`, createdAt: new Date().toISOString() }, libraryDirty: true, libraryError: "" });
  },
  reopenLibraryEntry() {
    const state = get();
    const snapshot = state.libraryDraft?.builderSnapshot;
    if (!validSnapshot(snapshot)) return;
    if (state.libraryDirty && !window.confirm("Discard unsaved command changes before reopening?")) return;
    const original = state.favorites.find((entry) => entry.id === state.libraryDraft?.id);
    const entry = state.libraryDirty && original ? normalizeEntry(original) : state.libraryDraft!;
    if (!validSnapshot(entry.builderSnapshot)) return;
    const saved = clone(entry.builderSnapshot);
    set({ view: "builder", transientSchema: saved.schema, transientExecutableHealth: undefined, selectedSchemaName: saved.schema.name, selectedActionName: saved.selectedActionName, options: saved.options, parameters: saved.parameters, taskLabel: entry.title, commandCategory: commandCategory(saved.schema), libraryDraft: clone(entry), libraryDirty: false, status: "Restored saved Builder snapshot." });
    void runtime.checkExecutables([saved.schema]).then((health) => {
      if (get().transientSchema === saved.schema) set({ transientExecutableHealth: health[0] });
    }).catch(() => {
      if (get().transientSchema === saved.schema) set({ transientExecutableHealth: { schemaName: saved.schema.name, status: "unknown", message: "Could not check the saved executable.", checkedAt: "" } });
    });
  },
  commandCategory: "general",
  setCommandCategory: (category) => set((state) => {
    if (category === state.commandCategory) return {};
    const schemas = state.schemas.filter((schema) => commandCategory(schema) === category);
    return { ...syncSelection(schemas), commandCategory: category };
  }),
  dataRoot: "",
  schemas: [],
  executableHealth: {},
  favorites: [],
  selectedSchemaName: "",
  selectedActionName: "",
  options: [],
  parameters: [],
  taskLabel: "",
  toolSearch: "",
  favoriteSearch: "",
  favoriteTag: "All",
  importCommandName: "",
  importHelpArgs: "--help",
  importHelpText: "",
  importUseCompletion: false,
  importDraft: null,
  cliScriptPath: "",
  cliCommandName: "",
  cliHelpArgs: "--help",
  cliLastInstall: null,
  cliDraft: null,
  status: "Ready",
  runtimeLabel: runtime.runtimeLabel,
  canCaptureHelp: runtime.canCaptureHelp,
  logText: "",
  isLoading: false,
  setView: (view) => {
    const state = get();
    if (state.librarySaving) return;
    if (view !== state.view && state.libraryDirty && !window.confirm("Discard unsaved command changes?")) return;
    if (view !== state.view && state.libraryDirty) {
      const original = state.favorites.find((entry) => entry.id === state.libraryDraft?.id);
      set({ libraryDraft: original ? clone(normalizeEntry(original)) : null, libraryDirty: false, libraryError: "" });
    }
    if (view === "schema" && state.transientSchema) return set({ status: "This is a saved Builder snapshot. Select an installed schema to edit it." });
    set({ view, ...(view === "builder" && selectedSchema(state) ? { commandCategory: commandCategory(selectedSchema(state)!) } : {}), status: view === "import" && !runtime.canCaptureHelp ? "Browser preview: paste help text and use Parse Paste. Capture Help needs the Tauri desktop app." : "Ready" });
  },
  setStatus: (status) => set({ status }),
  async load() {
    set({ isLoading: true, status: "Loading local workspace..." });
    try {
      const snapshot = await runtime.loadSnapshot();
      const executableHealth = Object.fromEntries((await runtime.checkExecutables(snapshot.schemas)).map((health) => [health.schemaName, health]));
      set({
        dataRoot: snapshot.dataRoot,
        schemas: snapshot.schemas,
        executableHealth,
        favorites: snapshot.favorites.map(normalizeEntry),
        logText: snapshot.logText,
        status: `${snapshot.schemas.length} schemas loaded`,
        isLoading: false,
        ...syncSelection(snapshot.schemas)
      });
    } catch (error) {
      set({ status: error instanceof Error ? error.message : "Load failed", isLoading: false });
    }
  },
  selectSchema: (name) => set((state) => syncSelection(state.schemas, name)),
  selectAction: (name) => set((state) => {
    const schema = selectedSchema(state);
    const action = schema?.actions.find((action) => action.name === name);
    const options = schema ? makeOptionStates(schema, action) : [];
    const parameters = schema ? makeParameterStates(schema, action) : [];
    return { selectedActionName: name, options: options.map((row) => {
      const flag = row.argument.long || row.argument.flag;
      const shared = schema?.arguments.some((arg) => (arg.long || arg.flag) === flag) && !action?.arguments.some((arg) => (arg.long || arg.flag) === flag);
      const old = shared ? state.options.find((option) => (option.argument.long || option.argument.flag) === flag && option.argument.position === row.argument.position) : undefined;
      return { ...row, selected: old?.selected ?? false, value: old?.value ?? "" };
    }), parameters };
  }),
  updateOption: (key, value) =>
    set((state) => ({ options: state.options.map((option) => (option.key === key ? { ...option, ...value } : option)) })),
  updateParameter: (key, value) =>
    set((state) => ({ parameters: state.parameters.map((parameter) => (parameter.key === key ? { ...parameter, value } : parameter)) })),
  setTaskLabel: (taskLabel) => set({ taskLabel }),
  setToolSearch: (toolSearch) => set({ toolSearch }),
  setFavoriteSearch: (favoriteSearch) => set({ favoriteSearch }),
  setFavoriteTag: (favoriteTag) => set({ favoriteTag }),
  async copyCommand() {
    const command = commandPreviewForState(get());
    if (!command) return set({ status: "No command to copy yet." });
    await navigator.clipboard.writeText(command);
    set({ status: "Command copied to clipboard." });
  },
  async saveFavorite() {
    const state = get();
    const schema = selectedSchema(state);
    const command = commandPreviewForState(state);
    if (!schema || !command) return set({ status: "No command to save yet." });
    if (state.libraryDirty && !window.confirm("Discard unsaved command changes?")) return;
    const favorite: LibraryEntry = {
      ...newEntry(),
      title: state.taskLabel || `${schema.name}${state.selectedActionName ? ` ${state.selectedActionName}` : ""}`,
      category: commandCategory(schema),
      builderSnapshot: clone({ schema, selectedActionName: state.selectedActionName, options: state.options, parameters: state.parameters }),
      command,
      tool: schema.name,
      action: selectedAction(state)?.name ?? "",
      task: state.taskLabel,
      createdAt: new Date().toISOString(),
      tags: schema.tags.filter((tag) => !tag.name.startsWith("workspace:"))
    };
    set({ libraryDraft: favorite, libraryDirty: false, libraryModal: true, libraryError: "" });
  },
  async removeFavorite(id) {
    if (get().librarySaving || !window.confirm("Delete this saved command?")) return;
    const favorites = get().favorites.filter((favorite) => favorite.id !== id);
    try { await runtime.saveFavorites(favorites); set({ favorites, libraryDraft: null, libraryDirty: false, status: "Command deleted." }); }
    catch (error) { set({ libraryError: error instanceof Error ? error.message : "Could not delete command." }); }
  },
  async clearFavorites() {
    if (!window.confirm("Clear all favorites?")) return;
    await runtime.saveFavorites([]);
    set({ favorites: [], status: "Favorites cleared." });
  },
  async exportFavorites(format) {
    try {
      const path = await runtime.exportFavorites(get().favorites, format);
      set({ status: path ? `Commands exported to ${path}.` : "Command export prepared.", libraryError: "" });
    } catch (error) { set({ libraryError: error instanceof Error ? error.message : "Could not export commands.", status: "Command export failed." }); }
  },
  newSchema() {
    const schema = { ...emptySchema(), name: "new-tool" };
    schema.tags = categoryTags(schema, get().commandCategory);
    set((state) => ({ schemas: [...state.schemas, schema], view: "schema", ...syncSelection([...state.schemas, schema], schema.name) }));
  },
  updateSelectedSchema(patch) {
    set((state) => {
      const schemas = state.schemas.map((schema) => (schema.name === state.selectedSchemaName ? { ...schema, ...patch } : schema));
      const selectedSchemaName = patch.name ?? state.selectedSchemaName;
      return { schemas, selectedSchemaName };
    });
  },
  updateAction(index, patch) {
    const schema = selectedSchema(get());
    if (!schema) return;
    const actions = schema.actions.map((action, row) => (row === index ? { ...action, ...patch } : action));
    get().updateSelectedSchema({ actions });
  },
  updateArgument(index, patch) {
    const schema = selectedSchema(get());
    if (!schema) return;
    const args = schema.arguments.map((argument, row) => (row === index ? { ...argument, ...patch } : argument));
    get().updateSelectedSchema({ arguments: args });
  },
  updateParameterDef(index, patch) {
    const schema = selectedSchema(get());
    if (!schema) return;
    const params = schema.parameters.map((parameter, row) => (row === index ? { ...parameter, ...patch } : parameter));
    get().updateSelectedSchema({ parameters: params });
  },
  updateTag(index, patch) {
    const schema = selectedSchema(get());
    if (!schema) return;
    const tags = schema.tags.map((tag, row) => (row === index ? { ...tag, ...patch } : tag));
    get().updateSelectedSchema({ tags });
  },
  addAction: () => {
    const schema = selectedSchema(get());
    if (schema) get().updateSelectedSchema({ actions: [...schema.actions, { name: "action", description: "", arguments: [], parameters: [] }] });
  },
  addArgument: () => {
    const schema = selectedSchema(get());
    if (schema) get().updateSelectedSchema({ arguments: [...schema.arguments, { flag: "--flag", long: "", description: "", type: "boolean", valueStyle: "space" }] });
  },
  addParameter: () => {
    const schema = selectedSchema(get());
    if (schema) get().updateSelectedSchema({ parameters: [...schema.parameters, { name: "param", type: "string", required: true }] });
  },
  addTag: () => {
    const schema = selectedSchema(get());
    if (schema) get().updateSelectedSchema({ tags: [...schema.tags, { name: "tag", color: "#21C6B8" }] });
  },
  removeRow(kind, index) {
    const schema = selectedSchema(get());
    if (!schema) return;
    if (kind === "action") get().updateSelectedSchema({ actions: schema.actions.filter((_, row) => row !== index) });
    if (kind === "argument") get().updateSelectedSchema({ arguments: schema.arguments.filter((_, row) => row !== index) });
    if (kind === "parameter") get().updateSelectedSchema({ parameters: schema.parameters.filter((_, row) => row !== index) });
    if (kind === "tag") get().updateSelectedSchema({ tags: schema.tags.filter((_, row) => row !== index) });
  },
  async saveSelectedSchema() {
    const schema = selectedSchema(get());
    if (!schema) return;
    const issues = validateSchema(schema);
    if (issues.length) return set({ status: issues[0] });
    const saved = await runtime.saveSchema(schema);
    const executableHealth = await runtime.checkExecutables([saved]);
    set((state) => {
      const schemas = state.schemas.map((item) => (item.name === state.selectedSchemaName ? saved : item));
      return {
        schemas,
        executableHealth: { ...state.executableHealth, [saved.name]: executableHealth[0] },
        status: "Schema saved.",
        ...syncSelection(schemas, saved.name)
      };
    });
  },
  async deleteSelectedSchema() {
    const schema = selectedSchema(get());
    if (!schema) return;
    if (!window.confirm(`Permanently delete schema '${schema.name}'? This cannot be undone.`)) return;
    await runtime.deleteSchema(schema);
    const schemas = get().schemas.filter((item) => item.name !== schema.name);
    set({ schemas, status: "Schema deleted.", ...syncSelection(schemas) });
  },
  setImportField: (field, value) => set({ [field]: value }),
  clearImportHelpText: () => set({ importHelpText: "", status: "Pasted help text cleared." }),
  setImportUseCompletion: (importUseCompletion) => set({ importUseCompletion }),
  async createDraftFromPaste() {
    const state = get();
    try {
      let completion = "";
      if (state.importUseCompletion) completion = (await runtime.captureCompletion(state.importCommandName)) ?? "";
      const draft = createImportDraft(state.importCommandName, state.importHelpText, completion);
      set({ importDraft: draft, status: `Draft ready: ${draft.stagedActions.length} actions, ${draft.stagedArguments.length} arguments.` });
    } catch (error) {
      set({ status: error instanceof Error ? error.message : "Import draft failed." });
    }
  },
  async createDraftFromCommand() {
    const state = get();
    if (!runtime.canCaptureHelp) {
      set({ status: "Capture Help needs the Tauri desktop app. In browser preview, paste help text and use Parse Paste." });
      return;
    }
    try {
      set({ status: `Capturing help from ${state.importCommandName || "command"}...` });
      const identity = state.importCommandName.trim().split(/\s+/);
      const executable = identity.shift() ?? "";
      const help = await runtime.captureHelp(executable, [...identity, state.importHelpArgs || "--help"].join(" "));
      let completion = "";
      if (state.importUseCompletion) completion = (await runtime.captureCompletion(executable)) ?? "";
      const draft = createImportDraft(state.importCommandName, help, completion);
      set({ importHelpText: help, importDraft: draft, status: "Help captured and staged." });
    } catch (error) {
      set({ status: error instanceof Error ? error.message : "Help capture failed." });
    }
  },
  updateDraft: (patch) => set((state) => ({ importDraft: state.importDraft ? { ...state.importDraft, ...patch } : null })),
  addDraftRows(kind, lines) {
    const draft = get().importDraft;
    if (!draft) return;
    const next = kind === "actions" ? addActionLines(draft, lines) : kind === "arguments" ? addArgumentLines(draft, lines) : addParameterLines(draft, lines);
    set({ importDraft: next });
  },
  async saveDraftAsSchema() {
    const draft = get().importDraft;
    if (!draft) return;
    const schema = await runtime.saveSchema(buildSchemaFromDraft(draft));
    const executableHealth = await runtime.checkExecutables([schema]);
    const withoutOld = get().schemas.filter((item) => item.name !== schema.name);
    const schemas = [...withoutOld, schema].sort((a, b) => a.name.localeCompare(b.name));
    set((state) => ({
      schemas,
      executableHealth: { ...state.executableHealth, [schema.name]: executableHealth[0] },
      view: "builder",
      importDraft: null,
      status: "Imported schema saved.",
      ...syncSelection(schemas, schema.name)
    }));
  },
  setCliField: (field, value) => set({ [field]: value }),
  async chooseCliScript() {
    const scriptPath = await runtime.selectScriptPath();
    if (!scriptPath) return;
    const fileName = scriptPath.split(/[\\/]/).pop() ?? "";
    const commandName = get().cliCommandName || fileName.replace(/\.[^.]+$/, "");
    set({ cliScriptPath: scriptPath, cliCommandName: commandName, status: "Script selected." });
  },
  async importCliScript() {
    const state = get();
    if (!state.cliScriptPath.trim()) return set({ status: "Select a script before importing it." });
    try {
      set({ status: "Importing script and capturing help..." });
      const install = await runtime.installCliScript(state.cliScriptPath, state.cliCommandName, state.cliHelpArgs || "--help");
      const draft = createImportDraft(install.commandName, install.helpText, "", install.shimPath, "cli import", install.sourcePath);
      set({
        cliLastInstall: install,
        cliDraft: draft,
        view: "cli",
        status: `CLI staged in ${install.binDir}. Review the detected schema before saving.`
      });
    } catch (error) {
      set({ status: error instanceof Error ? error.message : "CLI import failed." });
    }
  },
  async saveCliPreset(preset) {
    const favorite: FavoriteCommand = {
      command: preset.command,
      tool: preset.family,
      action: preset.title,
      task: preset.description,
      createdAt: new Date().toISOString(),
      tags: preset.tags
    };
    const favorites = [...get().favorites, favorite];
    await runtime.saveFavorites(favorites);
    set({ favorites, status: `${preset.title} saved to library.` });
  },
  async saveCliDraftAsSchema() {
    const draft = get().cliDraft;
    if (!draft) return set({ status: "Import a CLI script before saving its schema." });
    const schema = await runtime.saveSchema(buildSchemaFromDraft(draft));
    const executableHealth = await runtime.checkExecutables([schema]);
    const withoutOld = get().schemas.filter((item) => item.name !== schema.name);
    const schemas = [...withoutOld, schema].sort((a, b) => a.name.localeCompare(b.name));
    set((state) => ({
      schemas,
      executableHealth: { ...state.executableHealth, [schema.name]: executableHealth[0] },
      view: "builder",
      cliDraft: null,
      status: "CLI schema saved.",
      ...syncSelection(schemas, schema.name)
    }));
  },
  updateCliDraft: (patch) => set((state) => ({ cliDraft: state.cliDraft ? { ...state.cliDraft, ...patch } : null })),
  async refreshLog() {
    const logText = await runtime.readLog();
    set({ logText });
  }
}));

export const selectFilteredSchemas = (state: StoreState) => {
  const search = state.toolSearch.trim().toLowerCase();
  return state.schemas.filter((schema) =>
    (state.view !== "builder" || commandCategory(schema) === state.commandCategory) &&
    (!search || schemaSearchText(schema).includes(search))
  );
};

export const schemaSearchText = (schema: ToolSchema) =>
  [
    schema.name,
    schema.installedName,
    schema.family ?? "",
    ...(schema.commandPrefix ?? []),
    schema.description,
    schema.notes,
    ...Object.values(schema.metadata),
    ...schema.tags.map((tag) => tag.name),
    ...schema.actions.flatMap((action) => [
      action.name,
      action.description,
      ...action.arguments.flatMap((argument) => [argument.flag, argument.long, argument.description, argument.type]),
      ...action.parameters.flatMap((parameter) => [parameter.name, parameter.type])
    ]),
    ...schema.arguments.flatMap((argument) => [argument.flag, argument.long, argument.description, argument.type]),
    ...schema.parameters.flatMap((parameter) => [parameter.name, parameter.type])
  ]
    .join(" ")
    .toLowerCase();

export const selectFavoriteTags = (favorites: FavoriteCommand[]) =>
  ["All", ...Array.from(new Set(favorites.flatMap((favorite) => favorite.tags.map((tag) => tag.name)))).sort((a, b) => a.localeCompare(b))];

export const selectFilteredFavorites = (state: StoreState) => filterFavorites(state.favorites, state.favoriteSearch, state.favoriteTag)
  .filter((entry) => state.libraryCategory === "All" || (entry.category ?? "general") === state.libraryCategory)
  .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

export const selectSelectedSchema = selectedSchema;
export const selectSelectedAction = selectedAction;
export const selectTomlPreview = (state: StoreState) => {
  const schema = selectedSchema(state);
  return schema ? serializeSchemaToml(schema) : "";
};
export const selectSchemaIssues = (state: StoreState) => {
  const schema = selectedSchema(state);
  return schema ? validateSchema(schema) : [];
};
export const selectSchemaHealth = (state: StoreState) => {
  const schema = selectedSchema(state);
  return schemaHealth(schema, state.parameters, schema ? executableHealthForCategory(state, schema) : undefined);
};
const executableHealthForCategory = (state: StoreState, schema: ToolSchema): ExecutableHealth | undefined => {
  const category = commandCategory(schema);
  if (category === "general") return state.transientSchema === schema ? state.transientExecutableHealth : state.executableHealth[schema.name];
  return {
    schemaName: schema.name,
    status: "unknown",
    message: category === "powershell" ? "Cmdlet availability has not been checked in PowerShell." : "Command availability has not been checked in Linux / WSL.",
    checkedAt: ""
  };
};
export const selectRailSchemaHealth = (state: StoreState, schema: ToolSchema) =>
  schemaHealth(schema, [], executableHealthForCategory(state, schema));
