export type ArgumentValueStyle = "space" | "equals" | "attached";

export interface SchemaTag {
  name: string;
  color: string;
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
  command: string;
  tool: string;
  action: string;
  task: string;
  createdAt: string;
  tags: SchemaTag[];
}

export interface HelpImportDraft {
  toolName: string;
  description: string;
  installedName: string;
  executablePath: string;
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

export interface RuntimeApi {
  loadSnapshot(): Promise<AppSnapshot>;
  saveSchema(schema: ToolSchema): Promise<ToolSchema>;
  deleteSchema(schema: ToolSchema): Promise<void>;
  saveFavorites(favorites: FavoriteCommand[]): Promise<void>;
  exportFavorites(favorites: FavoriteCommand[], format: "json" | "text"): Promise<string | null>;
  captureHelp(commandName: string, helpArgs: string): Promise<string>;
  captureCompletion(commandName: string): Promise<string | null>;
  readLog(): Promise<string>;
}
