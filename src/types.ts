export type ArgumentValueStyle = "space" | "equals" | "attached";

export interface SchemaTag {
  name: string;
  color: string;
}

export interface SchemaMetadata {
  version: string;
  author: string;
  source: string;
  sha256: string;
  homepage: string;
  executableVersion: string;
  lastValidated: string;
}

export interface SchemaParameter {
  name: string;
  type: string;
  required: boolean;
}

export interface SchemaArgument {
  flag: string;
  long: string;
  description: string;
  type: string;
  valueStyle: ArgumentValueStyle;
  position?: "before-prefix" | "after-prefix";
}

export interface SchemaAction {
  name: string;
  description: string;
  arguments: SchemaArgument[];
  parameters: SchemaParameter[];
}

export interface ToolSchema {
  name: string;
  description: string;
  notes: string;
  sourcePath: string;
  executablePath: string;
  installedName: string;
  family?: string;
  commandPrefix?: string[];
  metadata: SchemaMetadata;
  actions: SchemaAction[];
  arguments: SchemaArgument[];
  parameters: SchemaParameter[];
  tags: SchemaTag[];
}

export type CommandPartRole = "tool" | "action" | "argument" | "argumentValue" | "parameter";

export interface CommandPart {
  id: string;
  role: CommandPartRole;
  token: string;
  isFixed: boolean;
  sourceArgument?: SchemaArgument;
  sourceParameter?: SchemaParameter;
  linkedValueId?: string;
}

export interface OptionState {
  key: string;
  argument: SchemaArgument;
  selected: boolean;
  value: string;
}

export interface ParameterState {
  key: string;
  parameter: SchemaParameter;
  value: string;
}

export interface FavoriteCommand {
  id?: string;
  title?: string;
  notes?: string;
  category?: "general" | "powershell" | "linux";
  updatedAt?: string;
  builderSnapshot?: BuilderSnapshot | null;
  command: string;
  tool: string;
  action: string;
  task: string;
  createdAt: string;
  tags: SchemaTag[];
}

export interface BuilderSnapshot {
  schema: ToolSchema;
  selectedActionName: string;
  options: OptionState[];
  parameters: ParameterState[];
}

export interface HelpImportDraft {
  family?: string;
  commandPrefix?: string[];
  toolName: string;
  description: string;
  installedName: string;
  executablePath: string;
  importSource: "help import" | "cli import";
  importedFrom: string;
  completionImported: boolean;
  rawHelpText: string;
  stagedActions: SchemaAction[];
  stagedArguments: SchemaArgument[];
  stagedParameters: SchemaParameter[];
  parseWarnings: string[];
}

export interface AppSnapshot {
  dataRoot: string;
  schemas: ToolSchema[];
  favorites: FavoriteCommand[];
  logText: string;
}

export interface CliInstallResult {
  commandName: string;
  sourcePath: string;
  managedScriptPath: string;
  shimPath: string;
  binDir: string;
  helpText: string;
}

export type ExecutableHealthStatus = "available" | "missing" | "unknown";

export interface ExecutableHealth {
  schemaName: string;
  status: ExecutableHealthStatus;
  message: string;
  checkedAt: string;
}

export interface RuntimeApi {
  canCaptureHelp: boolean;
  runtimeLabel: string;
  loadSnapshot(): Promise<AppSnapshot>;
  saveSchema(schema: ToolSchema): Promise<ToolSchema>;
  deleteSchema(schema: ToolSchema): Promise<void>;
  saveFavorites(favorites: FavoriteCommand[]): Promise<void>;
  exportFavorites(favorites: FavoriteCommand[], format: "json" | "text"): Promise<string | null>;
  captureHelp(commandName: string, helpArgs: string): Promise<string>;
  captureCompletion(commandName: string): Promise<string | null>;
  checkExecutables(schemas: ToolSchema[]): Promise<ExecutableHealth[]>;
  selectScriptPath(): Promise<string | null>;
  installCliScript(scriptPath: string, commandName: string, helpArgs: string): Promise<CliInstallResult>;
  readLog(): Promise<string>;
}
