import { create } from "zustand";
import type {
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
import { filterFavorites } from "../lib/favorites";
import {
  addActionLines,
  addArgumentLines,
  addParameterLines,
  buildSchemaFromDraft,
  createImportDraft
} from "../lib/helpImport";
import { emptySchema, serializeSchemaToml, validateSchema } from "../lib/schema";
import { runtime } from "../lib/runtime";

type View = "builder" | "import" | "schema" | "library" | "settings";

interface StoreState {
  view: View;
  dataRoot: string;
  schemas: ToolSchema[];
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
  status: string;
  logText: string;
  isLoading: boolean;
  setView: (view: View) => void;
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
  setImportUseCompletion: (enabled: boolean) => void;
  createDraftFromPaste: () => Promise<void>;
  createDraftFromCommand: () => Promise<void>;
  updateDraft: (patch: Partial<HelpImportDraft>) => void;
  addDraftRows: (kind: "actions" | "arguments" | "parameters", lines: string) => void;
  saveDraftAsSchema: () => Promise<void>;
  refreshLog: () => Promise<void>;
}

const selectedSchema = (state: StoreState) => state.schemas.find((schema) => schema.name === state.selectedSchemaName) ?? null;
const selectedAction = (state: StoreState) => {
  const schema = selectedSchema(state);
  return schema?.actions.find((action) => action.name === state.selectedActionName) ?? null;
};
export const commandPreviewForState = (state: Pick<StoreState, "schemas" | "selectedSchemaName" | "selectedActionName" | "options" | "parameters">) => {
  const schema = state.schemas.find((item) => item.name === state.selectedSchemaName) ?? null;
  const action = schema?.actions.find((item) => item.name === state.selectedActionName) ?? null;
  return tokensFromParts(buildParts(schema, action, state.options, state.parameters));
};

const syncSelection = (schemas: ToolSchema[], selectedName = "") => {
  const schema = schemas.find((item) => item.name === selectedName) ?? schemas[0] ?? null;
  return {
    selectedSchemaName: schema?.name ?? "",
    selectedActionName: schema?.actions[0]?.name ?? "",
    options: schema ? makeOptionStates(schema) : [],
    parameters: schema ? makeParameterStates(schema) : []
  };
};

export const useCommandWizardStore = create<StoreState>((set, get) => ({
  view: "builder",
  dataRoot: "",
  schemas: [],
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
  status: "Ready",
  logText: "",
  isLoading: false,
  setView: (view) => set({ view }),
  async load() {
    set({ isLoading: true, status: "Loading local workspace..." });
    try {
      const snapshot = await runtime.loadSnapshot();
      set({
        dataRoot: snapshot.dataRoot,
        schemas: snapshot.schemas,
        favorites: snapshot.favorites,
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
  selectAction: (name) => set({ selectedActionName: name }),
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
    const favorite: FavoriteCommand = {
      command,
      tool: schema.name,
      action: selectedAction(state)?.name ?? "",
      task: state.taskLabel,
      createdAt: new Date().toISOString(),
      tags: schema.tags
    };
    const favorites = [...state.favorites, favorite];
    await runtime.saveFavorites(favorites);
    set({ favorites, status: "Command saved to favorites." });
  },
  async removeFavorite(createdAt) {
    const favorites = get().favorites.filter((favorite) => favorite.createdAt !== createdAt);
    await runtime.saveFavorites(favorites);
    set({ favorites, status: "Favorite removed." });
  },
  async clearFavorites() {
    if (!window.confirm("Clear all favorites?")) return;
    await runtime.saveFavorites([]);
    set({ favorites: [], status: "Favorites cleared." });
  },
  async exportFavorites(format) {
    const path = await runtime.exportFavorites(get().favorites, format);
    set({ status: path ? `Favorites exported to ${path}.` : "Favorites export prepared." });
  },
  newSchema() {
    const schema = { ...emptySchema(), name: "new-tool" };
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
    set((state) => {
      const schemas = state.schemas.map((item) => (item.name === state.selectedSchemaName ? saved : item));
      return { schemas, status: "Schema saved.", ...syncSelection(schemas, saved.name) };
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
  setImportUseCompletion: (importUseCompletion) => set({ importUseCompletion }),
  async createDraftFromPaste() {
    const state = get();
    let completion = "";
    if (state.importUseCompletion) completion = (await runtime.captureCompletion(state.importCommandName)) ?? "";
    const draft = createImportDraft(state.importCommandName, state.importHelpText, completion);
    set({ importDraft: draft, status: `Draft ready: ${draft.stagedActions.length} actions, ${draft.stagedArguments.length} arguments.` });
  },
  async createDraftFromCommand() {
    const state = get();
    const help = await runtime.captureHelp(state.importCommandName, state.importHelpArgs || "--help");
    let completion = "";
    if (state.importUseCompletion) completion = (await runtime.captureCompletion(state.importCommandName)) ?? "";
    const draft = createImportDraft(state.importCommandName, help, completion);
    set({ importHelpText: help, importDraft: draft, status: "Help captured and staged." });
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
    const withoutOld = get().schemas.filter((item) => item.name !== schema.name);
    const schemas = [...withoutOld, schema].sort((a, b) => a.name.localeCompare(b.name));
    set({ schemas, view: "builder", importDraft: null, status: "Imported schema saved.", ...syncSelection(schemas, schema.name) });
  },
  async refreshLog() {
    const logText = await runtime.readLog();
    set({ logText });
  }
}));

export const selectFilteredSchemas = (state: StoreState) => {
  const search = state.toolSearch.trim().toLowerCase();
  if (!search) return state.schemas;
  return state.schemas.filter(
    (schema) =>
      schema.name.toLowerCase().includes(search) ||
      schema.description.toLowerCase().includes(search) ||
      schema.tags.some((tag) => tag.name.toLowerCase().includes(search))
  );
};

export const selectFavoriteTags = (favorites: FavoriteCommand[]) =>
  ["All", ...Array.from(new Set(favorites.flatMap((favorite) => favorite.tags.map((tag) => tag.name)))).sort((a, b) => a.localeCompare(b))];

export const selectFilteredFavorites = (state: StoreState) => filterFavorites(state.favorites, state.favoriteSearch, state.favoriteTag);

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
