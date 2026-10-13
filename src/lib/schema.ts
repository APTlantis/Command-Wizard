import type {
  ArgumentValueStyle,
  SchemaAction,
  SchemaArgument,
  SchemaMetadata,
  SchemaParameter,
  SchemaTag,
  ToolSchema
} from "../types";

export const emptyMetadata = (): SchemaMetadata => ({
  version: "",
  author: "",
  source: "",
  sha256: "",
  homepage: "",
  executableVersion: "",
  lastValidated: ""
});

export const emptySchema = (): ToolSchema => ({
  name: "tool",
  description: "",
  notes: "",
  sourcePath: "",
  executablePath: "",
  installedName: "",
  metadata: emptyMetadata(),
  actions: [],
  arguments: [],
  parameters: [],
  tags: []
});

const quote = (value: string) => JSON.stringify(value);

const parseValue = (value: string): string | boolean | string[] => {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    const tokens = JSON.parse(trimmed);
    if (!Array.isArray(tokens) || !tokens.every((token) => typeof token === "string")) throw new Error("Command prefix must be an array of strings.");
    return tokens;
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed) as string;
  }
  return trimmed;
};

const toValueStyle = (value: string | boolean | string[] | undefined): ArgumentValueStyle => {
  if (typeof value !== "string") return "space";
  const normalized = value.toLowerCase();
  if (normalized === "equals" || normalized === "equals_separated") return "equals";
  if (normalized === "attached") return "attached";
  return "space";
};

const stringifyValueStyle = (style: ArgumentValueStyle): string | null => {
  if (style === "equals") return "equals";
  if (style === "attached") return "attached";
  return null;
};

type TomlTable = Record<string, string | boolean | string[]>;
type Section =
  | { kind: "tool"; table: TomlTable }
  | { kind: "metadata"; table: TomlTable }
  | { kind: "action"; table: TomlTable; action: SchemaAction }
  | { kind: "argument"; table: TomlTable; target: SchemaArgument[] }
  | { kind: "parameter"; table: TomlTable; target: SchemaParameter[] }
  | { kind: "tag"; table: TomlTable; target: SchemaTag[] };

const applyTable = (section: Section | null) => {
  if (!section) return;
  const table = section.table;
  if (section.kind === "tool") return;
  if (section.kind === "metadata") return;
  if (section.kind === "action") {
    section.action.name = String(table.name ?? "");
    section.action.description = String(table.description ?? "");
    return;
  }
  if (section.kind === "argument") {
    section.target.push({
      flag: String(table.flag ?? ""),
      long: String(table.long ?? ""),
      description: String(table.description ?? ""),
      type: String(table.type ?? "boolean"),
      valueStyle: toValueStyle(table.value_style),
      position: table.position === "before-prefix" ? "before-prefix" : "after-prefix"
    });
    return;
  }
  if (section.kind === "parameter") {
    section.target.push({
      name: String(table.name ?? ""),
      type: String(table.type ?? "string"),
      required: typeof table.required === "boolean" ? table.required : true
    });
    return;
  }
  section.target.push({
    name: String(table.name ?? ""),
    color: String(table.color ?? "#7A7A7A")
  });
};

export const parseSchemaToml = (tomlText: string, sourcePath = ""): ToolSchema => {
  const schema = emptySchema();
  schema.sourcePath = sourcePath;
  const toolTable: TomlTable = {};
  const metadataTable: TomlTable = {};
  let current: Section | null = null;
  let currentAction: SchemaAction | null = null;

  for (const rawLine of tomlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      applyTable(current);
      const header = line.slice(1, -1).trim();
      if (header === "tool") {
        current = { kind: "tool", table: toolTable };
      } else if (header === "metadata") {
        current = { kind: "metadata", table: metadataTable };
      } else if (header === "[actions]") {
        currentAction = { name: "", description: "", arguments: [], parameters: [] };
        schema.actions.push(currentAction);
        current = { kind: "action", table: {}, action: currentAction };
      } else if (header === "[arguments]") {
        current = { kind: "argument", table: {}, target: schema.arguments };
      } else if (header === "[parameters]") {
        current = { kind: "parameter", table: {}, target: schema.parameters };
      } else if (header === "[tags]") {
        current = { kind: "tag", table: {}, target: schema.tags };
      } else if (header === "[actions.arguments]" && currentAction) {
        current = { kind: "argument", table: {}, target: currentAction.arguments };
      } else if (header === "[actions.parameters]" && currentAction) {
        current = { kind: "parameter", table: {}, target: currentAction.parameters };
      } else {
        current = null;
      }
      continue;
    }

    const eq = line.indexOf("=");
    if (eq < 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = parseValue(line.slice(eq + 1));
    current.table[key] = value;
  }
  applyTable(current);

  schema.name = String(toolTable.name ?? "").trim();
  schema.description = String(toolTable.description ?? "");
  schema.notes = String(toolTable.notes ?? "");
  schema.executablePath = String(toolTable.executable_path ?? "");
  schema.installedName = String(toolTable.installed_name ?? "");
  schema.family = String(toolTable.family ?? "");
  schema.commandPrefix = Array.isArray(toolTable.command_prefix) ? toolTable.command_prefix : [];
  schema.metadata = {
    version: String(metadataTable.version ?? ""),
    author: String(metadataTable.author ?? ""),
    source: String(metadataTable.source ?? ""),
    sha256: String(metadataTable.sha_256 ?? ""),
    homepage: String(metadataTable.homepage ?? ""),
    executableVersion: String(metadataTable.executable_version ?? ""),
    lastValidated: String(metadataTable.last_validated ?? "")
  };
  if (!schema.name) {
    throw new Error("Schema is missing tool.name.");
  }
  return schema;
};

const serializeArgument = (argument: SchemaArgument): string[] => {
  const lines = [
    `flag = ${quote(argument.flag)}`,
    argument.long ? `long = ${quote(argument.long)}` : "",
    `description = ${quote(argument.description)}`,
    `type = ${quote(argument.type || "boolean")}`
  ].filter(Boolean);
  const style = stringifyValueStyle(argument.valueStyle);
  if (style) lines.push(`value_style = ${quote(style)}`);
  if (argument.position === "before-prefix") lines.push('position = "before-prefix"');
  return lines;
};

const serializeParameter = (parameter: SchemaParameter): string[] => [
  `name = ${quote(parameter.name)}`,
  `type = ${quote(parameter.type || "string")}`,
  `required = ${parameter.required ? "true" : "false"}`
];

const metadataLines = (metadata: SchemaMetadata): string[] => {
  const lines = [
    metadata.version.trim() ? `version = ${quote(metadata.version)}` : "",
    metadata.author.trim() ? `author = ${quote(metadata.author)}` : "",
    metadata.source.trim() ? `source = ${quote(metadata.source)}` : "",
    metadata.sha256.trim() ? `sha_256 = ${quote(metadata.sha256)}` : "",
    metadata.homepage.trim() ? `homepage = ${quote(metadata.homepage)}` : "",
    metadata.executableVersion.trim() ? `executable_version = ${quote(metadata.executableVersion)}` : "",
    metadata.lastValidated.trim() ? `last_validated = ${quote(metadata.lastValidated)}` : ""
  ].filter(Boolean);
  return lines.length ? ["", "[metadata]", ...lines] : [];
};

export const serializeSchemaToml = (schema: ToolSchema): string => {
  const lines: string[] = [
    "[tool]",
    `name = ${quote(schema.name)}`,
    `description = ${quote(schema.description)}`
  ];

  if (schema.notes.trim()) lines.push(`notes = ${quote(schema.notes)}`);
  if (schema.executablePath.trim()) lines.push(`executable_path = ${quote(schema.executablePath)}`);
  if (schema.installedName.trim()) lines.push(`installed_name = ${quote(schema.installedName)}`);
  if (schema.family?.trim()) lines.push(`family = ${quote(schema.family)}`);
  if (schema.commandPrefix?.length) lines.push(`command_prefix = ${JSON.stringify(schema.commandPrefix)}`);

  lines.push(...metadataLines(schema.metadata));

  for (const action of schema.actions) {
    lines.push("", "[[actions]]", `name = ${quote(action.name)}`, `description = ${quote(action.description)}`);
    for (const argument of action.arguments) {
      lines.push("", "[[actions.arguments]]", ...serializeArgument(argument));
    }
    for (const parameter of action.parameters) {
      lines.push("", "[[actions.parameters]]", ...serializeParameter(parameter));
    }
  }

  for (const argument of schema.arguments) {
    lines.push("", "[[arguments]]", ...serializeArgument(argument));
  }
  for (const parameter of schema.parameters) {
    lines.push("", "[[parameters]]", ...serializeParameter(parameter));
  }
  for (const tag of schema.tags) {
    lines.push("", "[[tags]]", `name = ${quote(tag.name)}`, `color = ${quote(tag.color || "#7A7A7A")}`);
  }

  return `${lines.join("\n")}\n`;
};

export const validateSchema = (schema: ToolSchema): string[] => {
  const issues: string[] = [];
  if (!schema.name.trim()) issues.push("Tool name is required.");
  const keys = new Set<string>();
  for (const argument of schema.arguments) {
    const key = argument.long || argument.flag;
    if (!key.trim()) issues.push("Every argument needs a flag or long flag.");
    if (keys.has(key)) issues.push(`Duplicate argument: ${key}`);
    keys.add(key);
  }
  for (const parameter of schema.parameters) {
    if (!parameter.name.trim()) issues.push("Every parameter needs a name.");
  }
  for (const action of schema.actions) {
    issues.push(...validateSchema({ ...schema, actions: [], arguments: action.arguments, parameters: action.parameters }).map((issue) => `${action.name}: ${issue}`));
  }
  if (schema.commandPrefix?.some((token) => !token.trim() || /\s/.test(token))) issues.push("Each command prefix token must be one nonempty word.");
  if (schema.commandPrefix?.length && !schema.installedName.trim()) issues.push("Split commands require an installed executable name.");
  return issues;
};
