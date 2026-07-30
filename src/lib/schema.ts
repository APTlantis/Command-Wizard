import type {
  ArgumentValueStyle,
  SchemaAction,
  SchemaArgument,
  SchemaParameter,
  SchemaTag,
  ToolSchema
} from "../types";

export const emptySchema = (): ToolSchema => ({
  name: "tool",
  description: "",
  notes: "",
  sourcePath: "",
  executablePath: "",
  installedName: "",
  actions: [],
  arguments: [],
  parameters: [],
  tags: []
});

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const parseValue = (value: string): string | boolean => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
};

const toValueStyle = (value: string | boolean | undefined): ArgumentValueStyle => {
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

type TomlTable = Record<string, string | boolean>;
type Section =
  | { kind: "tool"; table: TomlTable }
  | { kind: "action"; table: TomlTable; action: SchemaAction }
  | { kind: "argument"; table: TomlTable; target: SchemaArgument[] }
  | { kind: "parameter"; table: TomlTable; target: SchemaParameter[] }
  | { kind: "tag"; table: TomlTable; target: SchemaTag[] };

const applyTable = (section: Section | null) => {
  if (!section) return;
  const table = section.table;
  if (section.kind === "tool") return;
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
      valueStyle: toValueStyle(table.value_style)
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
  return lines;
};

const serializeParameter = (parameter: SchemaParameter): string[] => [
  `name = ${quote(parameter.name)}`,
  `type = ${quote(parameter.type || "string")}`,
  `required = ${parameter.required ? "true" : "false"}`
];

export const serializeSchemaToml = (schema: ToolSchema): string => {
  const lines: string[] = [
    "[tool]",
    `name = ${quote(schema.name)}`,
    `description = ${quote(schema.description)}`
  ];

  if (schema.notes.trim()) lines.push(`notes = ${quote(schema.notes)}`);
  if (schema.executablePath.trim()) lines.push(`executable_path = ${quote(schema.executablePath)}`);
  if (schema.installedName.trim()) lines.push(`installed_name = ${quote(schema.installedName)}`);

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
    if (keys.has(key.toLowerCase())) issues.push(`Duplicate argument: ${key}`);
    keys.add(key.toLowerCase());
  }
  for (const parameter of schema.parameters) {
    if (!parameter.name.trim()) issues.push("Every parameter needs a name.");
  }
  return issues;
};
