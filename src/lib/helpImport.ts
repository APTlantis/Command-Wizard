import type { HelpImportDraft, SchemaAction, SchemaArgument, SchemaParameter, ToolSchema } from "../types";
import { emptySchema } from "./schema";

const sectionHeader = /^\s*(?<header>[\w\s]+):\s*$/;
const flagLine = /^\s*(?<flags>(?:[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)(?:\s+[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)*)\s+(?<desc>.+)$/;
const flagOnlyLine = /^\s*(?<flags>(?:[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)(?:\s+[-/][^\s]*(?:\s*,\s*[-/][^\s]*)*)*)\s*$/;
const actionLine = /^\s*(?<cmds>[\w-]+(?:\s*,\s*[\w-]+)*)\s+(?<desc>.+)$/;
const userActionLine = /^\s*(?<name>[A-Za-z0-9][A-Za-z0-9_.-]*)(?:\s+[-–—]\s*|\s{2,})(?<desc>.*)$/;
const usageToken = /[\[<](?<name>[A-Za-z0-9_.-]+)[>\]]/g;
const ansiEscape = /\u001b\[[0-?]*[ -/]*[@-~]/g;

const commandSectionHeaders = new Set(["commands", "subcommands"]);
const optionSectionHeaders = new Set([
  "options",
  "global options",
  "flags",
  "global flags",
  "arguments",
  "cache options",
  "python options",
  "general options",
  "connection options",
  "ssl options"
]);

const normalizeHelpLine = (line: string) =>
  Array.from(line.replace(ansiEscape, ""))
    .map((ch) => (ch.charCodeAt(0) <= 127 ? ch : " "))
    .join("");

const isIndented = (line: string) => !!line && /\s/.test(line[0]);
const isCommandHeader = (header: string) =>
  commandSectionHeaders.has(header) || header.endsWith("commands") || header.endsWith("subcommands");
const isOptionHeader = (line: string) => {
  const trimmed = line.trim();
  return (
    trimmed.toLowerCase().includes("options are available") ||
    trimmed.toLowerCase().startsWith("options:") ||
    trimmed.toLowerCase().startsWith("global options:") ||
    trimmed.toLowerCase().startsWith("flags:") ||
    trimmed.toLowerCase().endsWith("options:")
  );
};
const isCommandsIntro = (line: string) => {
  const trimmed = line.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return (
    trimmed.toLowerCase().includes("commands are available") ||
    trimmed.toLowerCase().includes("available commands") ||
    trimmed.toLowerCase().startsWith("commands:") ||
    trimmed.toLowerCase().includes("<command> --help") ||
    (trimmed.toLowerCase().endsWith("commands") && !trimmed.includes("  ") && words.length <= 3)
  );
};

const isLikelyActionName = (token: string) =>
  !!token && !token.startsWith("-") && !token.startsWith("/") && /^[A-Za-z0-9_.-]+$/.test(token);

const isDecorativeCommandLine = (line: string, wasIndented: boolean) => {
  if (!line.trim()) return true;
  if (line.endsWith(":")) return true;
  if (!wasIndented && line.toLowerCase().includes("(see also:")) return true;
  if (!wasIndented && line.includes(", ") && !line.includes("  ")) return true;
  if (line.toLowerCase().includes("help") && line.toLowerCase().includes("command") && line.split(/\s+/).length > 3) return true;
  return line.toLowerCase().includes("commands (");
};

const isLikelyActionNoise = (name: string, description: string) => {
  if (!isLikelyActionName(name)) return true;
  if (description.startsWith("& ")) return true;
  if (/[A-Z]/.test(name) && !name.includes("-") && !name.includes("_") && description.split(/\s+/).length <= 3) return true;
  return false;
};

const inferDescription = (lines: string[]) =>
  lines.find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.toLowerCase().startsWith("usage") && !trimmed.endsWith(":");
  })?.trim() ?? "";

const parseMultiColumnActions = (line: string): string[] => {
  const columns = line
    .trim()
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (columns.length <= 1 || columns.some((column) => !isLikelyActionName(column))) return [];
  return Array.from(new Set(columns));
};

export const parseActions = (lines: string[]): SchemaAction[] => {
  const actions: SchemaAction[] = [];
  let inCommands = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (isCommandsIntro(line) || line.toLowerCase().includes("common git commands")) {
      inCommands = true;
      continue;
    }
    if (inCommands && isOptionHeader(line)) {
      inCommands = false;
      continue;
    }
    const section = line.match(sectionHeader);
    if (section?.groups?.header) {
      const header = section.groups.header.trim().toLowerCase();
      if (isCommandHeader(header)) {
        inCommands = true;
        continue;
      }
      if (inCommands) inCommands = false;
      continue;
    }
    if (!inCommands) continue;

    const wasIndented = isIndented(line);
    const trimmed = line.trim().replace(/^[,|"' ]+|[,|"' ]+$/g, "");
    if (trimmed.startsWith("-") || trimmed.toLowerCase().startsWith("usage:")) continue;
    if (isDecorativeCommandLine(trimmed, wasIndented)) continue;

    const multi = parseMultiColumnActions(trimmed);
    if (multi.length > 1) {
      actions.push(...multi.map((name) => ({ name, description: "", arguments: [], parameters: [] })));
      continue;
    }

    const match = trimmed.match(actionLine);
    if (match?.groups) {
      const aliases = match.groups.cmds.split(",").map((item) => item.trim()).filter(Boolean);
      const name = aliases[0];
      let description = match.groups.desc.trim();
      if (aliases.length > 1) {
        description = description ? `${description} (Aliases: ${aliases.slice(1).join(", ")})` : `Aliases: ${aliases.slice(1).join(", ")}`;
      }
      if (!isLikelyActionNoise(name, description)) actions.push({ name, description, arguments: [], parameters: [] });
      continue;
    }

    const [name = "", ...rest] = trimmed.split(/\s+/);
    const description = rest.join(" ");
    if (!isLikelyActionNoise(name, description)) actions.push({ name: name.replace(/,$/, ""), description, arguments: [], parameters: [] });
  }
  return actions;
};

const isLooseValueToken = (token: string) => {
  const cleaned = token.trim().replace(/^[,;)(]+|[,;)(]+$/g, "");
  return (
    cleaned.startsWith("<") ||
    cleaned.startsWith("[") ||
    [
      "value",
      "file",
      "filename",
      "path",
      "dir",
      "directory",
      "port",
      "level",
      "format",
      "name",
      "string",
      "text",
      "integer",
      "int",
      "number",
      "float",
      "choice",
      "command",
      "url",
      "uri"
    ].includes(
      cleaned.toLowerCase()
    )
  );
};

const inferArgumentType = (tokens: string[]) => (tokens.some((token) => /[<=[\]:]/.test(token) || isLooseValueToken(token)) ? "string" : "boolean");

const splitFlagTokens = (flags: string) =>
  flags
    .split(/\s+/)
    .flatMap((token) => token.split(/[|,]/))
    .map((token) => token.trim())
    .filter(Boolean);

const cleanFlagToken = (token: string) => {
  const index = token.search(/[<[=]/);
  return index > 0 ? token.slice(0, index) : token;
};

const keyForArgument = (argument: SchemaArgument) => argument.long || argument.flag;

export const parseArguments = (lines: string[], warnings: string[]): SchemaArgument[] => {
  const argumentsList: SchemaArgument[] = [];
  const byKey = new Map<string, SchemaArgument>();
  let lastArgument: SchemaArgument | null = null;

  for (const line of lines) {
    if (!line.trim() || sectionHeader.test(line)) {
      lastArgument = null;
      continue;
    }

    const match = line.match(flagLine);
    if (!match?.groups) {
      const only = line.match(flagOnlyLine);
      if (only?.groups) {
        const tokens = splitFlagTokens(only.groups.flags).filter((token) => token.startsWith("-") || token.startsWith("/"));
        if (tokens.length > 0) {
          const shortFlag = tokens.find((token) => token.startsWith("-") && !token.startsWith("--"));
          const longFlag = tokens.find((token) => token.startsWith("--"));
          const primary = longFlag ?? shortFlag ?? tokens[0];
          const argument = { flag: shortFlag ?? primary, long: shortFlag && longFlag ? longFlag : "", description: "", type: inferArgumentType(tokens), valueStyle: "space" as const };
          const key = keyForArgument(argument).toLowerCase();
          if (!byKey.has(key)) {
            byKey.set(key, argument);
            argumentsList.push(argument);
          }
          lastArgument = byKey.get(key) ?? null;
        }
      } else if (lastArgument && isIndented(line)) {
        const continuation = line.trim();
        if (continuation) lastArgument.description = lastArgument.description ? `${lastArgument.description} ${continuation}` : continuation;
      } else if (line.trimStart().startsWith("-") || line.trimStart().startsWith("/")) {
        warnings.push(`Unparsed option line: ${line.trim()}`);
      }
      continue;
    }

    const tokens = splitFlagTokens(match.groups.flags);
    let description = match.groups.desc.trim();
    const firstDescriptionToken = description.split(/\s+/, 1)[0] ?? "";
    if ((firstDescriptionToken.startsWith("-") || firstDescriptionToken.startsWith("/")) && tokens.length > 0) {
      tokens.push(firstDescriptionToken.replace(/,$/, ""));
      description = description.slice(firstDescriptionToken.length).trim();
    }
    const foundValuePlaceholder = isLooseValueToken(firstDescriptionToken);
    if (foundValuePlaceholder) description = description.slice(firstDescriptionToken.length).trim();

    const shortFlag = tokens.find((token) => token.startsWith("-") && !token.startsWith("--"));
    const longFlag = tokens.find((token) => token.startsWith("--"));
    const primary = longFlag ?? shortFlag ?? tokens[0];
    if (!primary) continue;
    const key = (longFlag ?? primary).toLowerCase();
    const type = foundValuePlaceholder || tokens.some((token) => token.includes(":") && isLooseValueToken(token.split(":", 2)[1])) ? "string" : inferArgumentType(tokens);

    const existing = byKey.get(key);
    if (existing) {
      if (!existing.long && longFlag) existing.long = longFlag;
      if (!existing.flag && shortFlag) existing.flag = shortFlag;
      if (description && (!existing.description || description.length > existing.description.length)) existing.description = description;
      lastArgument = existing;
      continue;
    }

    const argument: SchemaArgument = {
      flag: shortFlag ?? cleanFlagToken(primary),
      long: shortFlag && longFlag ? cleanFlagToken(longFlag) : "",
      description,
      type,
      valueStyle: tokens.some((token) => token.includes("=") || token.includes(":")) ? "equals" : "space"
    };
    byKey.set(key, argument);
    argumentsList.push(argument);
    lastArgument = argument;
  }
  return argumentsList;
};

const tokenizeUsage = (usageText: string): Array<{ text: string; optional: boolean }> => {
  const tokens: Array<{ text: string; optional: boolean }> = [];
  let current = "";
  let bracketDepth = 0;
  let angleDepth = 0;
  const flush = (optionalOverride?: boolean) => {
    if (!current.trim()) return;
    for (const part of current.split("|").map((item) => item.trim()).filter(Boolean)) {
      const cleaned = part.replace(/^[\[\]<>() ,;]+|[\[\]<>() ,;]+$/g, "");
      if (cleaned) tokens.push({ text: cleaned, optional: optionalOverride ?? bracketDepth > 0 });
    }
    current = "";
  };
  for (const ch of usageText) {
    if (/\s/.test(ch) && bracketDepth === 0 && angleDepth === 0) {
      flush();
      continue;
    }
    if (ch === "[") {
      bracketDepth += 1;
      continue;
    }
    if (ch === "]") {
      flush(true);
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (ch === "<") angleDepth += 1;
    if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
    current += ch;
  }
  flush();
  return tokens;
};

export const parseParametersFromUsage = (commandName: string, lines: string[], actions: SchemaAction[]): SchemaParameter[] => {
  const parameters: SchemaParameter[] = [];
  const seen = new Set<string>();
  const actionNames = new Set(actions.map((action) => action.name.toLowerCase()));
  let inUsage = false;

  const extract = (usageText: string) => {
    for (const token of tokenizeUsage(usageText)) {
      const name = token.text;
      if (!name || name.startsWith("-")) continue;
      if (["options", "option", "sdk-options", "command-options"].includes(name.toLowerCase())) continue;
      if (commandName && name.toLowerCase() === commandName.toLowerCase()) continue;
      if (actionNames.has(name.toLowerCase())) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      parameters.push({ name, type: "string", required: !token.optional });
    }
  };

  for (const raw of lines) {
    if (!raw.trim()) {
      inUsage = false;
      continue;
    }
    const trimmed = raw.trimStart();
    if (trimmed.toLowerCase().startsWith("usage:")) {
      inUsage = true;
      extract(trimmed.slice("usage:".length).trim());
      continue;
    }
    if (inUsage && isIndented(raw) && !sectionHeader.test(raw)) {
      extract(trimmed);
      continue;
    }
    inUsage = false;
  }
  return parameters;
};

export const parseHelpText = (commandName: string, helpText: string): { schema: ToolSchema; warnings: string[] } => {
  const warnings: string[] = [];
  const lines = helpText.split(/\r?\n/).map((line) => normalizeHelpLine(line.trimEnd()));
  const schema = emptySchema();
  schema.name = commandName.trim() || "tool";
  schema.installedName = commandName.trim();
  schema.description = inferDescription(lines);
  schema.actions = parseActions(lines);
  schema.parameters = parseParametersFromUsage(commandName, lines, schema.actions);
  schema.arguments = parseArguments(lines, warnings);
  return { schema, warnings };
};

export const parseCompletionText = (completionText: string): Pick<ToolSchema, "actions" | "arguments"> => {
  const actions: SchemaAction[] = [];
  const args: SchemaArgument[] = [];
  const quoted = Array.from(completionText.matchAll(/['"](?<token>--?[A-Za-z0-9][A-Za-z0-9_.-]*)['"]/g)).map((match) => match.groups?.token ?? "");
  const loose = Array.from(completionText.matchAll(/(?:commands|cmds)\s*=\s*["'](?<tokens>[A-Za-z0-9_.\-\s]+)["']/gi)).flatMap((match) =>
    (match.groups?.tokens ?? "").split(/\s+/)
  );
  for (const token of quoted) {
    if (!token) continue;
    args.push({ flag: token, long: token.startsWith("--") ? token : "", description: "", type: "boolean", valueStyle: "space" });
  }
  for (const token of loose) {
    if (isLikelyActionName(token)) actions.push({ name: token, description: "", arguments: [], parameters: [] });
  }
  return { actions, arguments: dedupeArguments(args) };
};

const dedupeArguments = (args: SchemaArgument[]) => {
  const seen = new Set<string>();
  return args.filter((argument) => {
    const key = keyForArgument(argument).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const mergeCompletionData = (schema: ToolSchema, completionText: string): ToolSchema => {
  const parsed = parseCompletionText(completionText);
  const next: ToolSchema = { ...schema, actions: [...schema.actions], arguments: [...schema.arguments] };
  const argKeys = new Map(next.arguments.map((arg) => [keyForArgument(arg).toLowerCase(), arg]));
  for (const arg of parsed.arguments) {
    const key = keyForArgument(arg).toLowerCase();
    if (!argKeys.has(key)) {
      next.arguments.push(arg);
      argKeys.set(key, arg);
    }
  }
  const actionNames = new Set(next.actions.map((action) => action.name.toLowerCase()));
  for (const action of parsed.actions) {
    if (!actionNames.has(action.name.toLowerCase())) {
      next.actions.push(action);
      actionNames.add(action.name.toLowerCase());
    }
  }
  return next;
};

export const createImportDraft = (
  commandName: string,
  helpText: string,
  completionText = "",
  executablePath = ""
): HelpImportDraft => {
  const parsed = parseHelpText(commandName, helpText);
  const schema = completionText.trim() ? mergeCompletionData(parsed.schema, completionText) : parsed.schema;
  const warnings = [...parsed.warnings];
  if (schema.actions.length === 0 && schema.arguments.length === 0) {
    warnings.push("No actions or flags were detected. Paste rows into the buckets below before saving.");
  }
  return {
    toolName: schema.name,
    description: schema.description,
    installedName: schema.installedName,
    executablePath,
    rawHelpText: helpText,
    stagedActions: schema.actions,
    stagedArguments: schema.arguments,
    stagedParameters: schema.parameters,
    parseWarnings: warnings
  };
};

export const buildSchemaFromDraft = (draft: HelpImportDraft): ToolSchema => ({
  ...emptySchema(),
  name: draft.toolName.trim() || "tool",
  description: draft.description.trim(),
  installedName: draft.installedName.trim(),
  executablePath: draft.executablePath.trim(),
  actions: draft.stagedActions.filter((action) => action.name.trim()).map((action) => ({ ...action, name: action.name.trim() })),
  arguments: draft.stagedArguments.filter((argument) => argument.flag.trim() || argument.long.trim()),
  parameters: draft.stagedParameters.filter((parameter) => parameter.name.trim())
});

export const addActionLines = (draft: HelpImportDraft, lines: string): HelpImportDraft => {
  const stagedActions = [...draft.stagedActions];
  const warnings = [...draft.parseWarnings];
  for (const line of lines.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(userActionLine);
    if (match?.groups) stagedActions.push({ name: match.groups.name, description: match.groups.desc.trim(), arguments: [], parameters: [] });
    else {
      const [name = "", ...rest] = line.split(/\s+/);
      if (name) stagedActions.push({ name: name.replace(/,$/, ""), description: rest.join(" ").replace(/^[-–—]\s*/, ""), arguments: [], parameters: [] });
      else warnings.push(`Could not parse action line: ${line}`);
    }
  }
  return { ...draft, stagedActions, parseWarnings: warnings };
};

export const addArgumentLines = (draft: HelpImportDraft, lines: string): HelpImportDraft => {
  const warnings = [...draft.parseWarnings];
  const parsed = parseArguments(lines.split(/\r?\n/), warnings);
  return { ...draft, stagedArguments: [...draft.stagedArguments, ...parsed], parseWarnings: warnings };
};

export const addParameterLines = (draft: HelpImportDraft, lines: string): HelpImportDraft => {
  const stagedParameters = [...draft.stagedParameters];
  for (const line of lines.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const matches = Array.from(line.matchAll(usageToken));
    if (matches.length > 0) {
      for (const match of matches) {
        const name = match.groups?.name ?? "";
        if (name && !name.startsWith("-")) stagedParameters.push({ name, type: "string", required: line.includes(`<${name}>`) });
      }
    } else {
      const name = line.split(/\s+/, 1)[0]?.replace(/^[\[\]<>,;]+|[\[\]<>,;]+$/g, "");
      if (name) stagedParameters.push({ name, type: "string", required: !line.startsWith("[") });
    }
  }
  return { ...draft, stagedParameters };
};
