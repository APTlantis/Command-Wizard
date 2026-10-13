import type { CommandPart, OptionState, ParameterState, SchemaAction, ToolSchema } from "../types";

let nextId = 1;
const id = () => `part-${nextId++}`;

const displayFlag = (argument: { long: string; flag: string }) => argument.long || argument.flag;

export const makeOptionStates = (schema: ToolSchema, action?: SchemaAction | null): OptionState[] =>
  [...schema.arguments.filter((argument) => !action?.arguments.some((local) => displayFlag(local) === displayFlag(argument))), ...(action?.arguments ?? [])].map((argument, index) => ({
    key: `${displayFlag(argument)}-${index}`,
    argument,
    selected: false,
    value: ""
  }));

export const makeParameterStates = (schema: ToolSchema, action?: SchemaAction | null): ParameterState[] =>
  [...schema.parameters, ...(action?.parameters ?? [])].map((parameter, index) => ({
    key: `${parameter.name}-${index}`,
    parameter,
    value: ""
  }));

export const buildParts = (
  schema: ToolSchema | null,
  action: SchemaAction | null,
  options: OptionState[],
  parameters: ParameterState[]
): CommandPart[] => {
  if (!schema) return [];
  const parts: CommandPart[] = [];
  const toolName = schema.installedName.trim() || schema.name.trim();
  if (toolName) parts.push({ id: id(), role: "tool", token: toolName, isFixed: true });
  const appendOptions = (rows: OptionState[]) => { for (const option of rows) {
    const flag = displayFlag(option.argument);
    if (!flag.trim()) continue;
    if (option.argument.type === "boolean") {
      if (option.selected) parts.push({ id: id(), role: "argument", token: flag, isFixed: false, sourceArgument: option.argument });
    } else if (option.value.trim()) {
      const flagPart: CommandPart = { id: id(), role: "argument", token: flag, isFixed: false, sourceArgument: option.argument };
      const valuePart: CommandPart = {
        id: id(),
        role: "argumentValue",
        token: option.value.trim(),
        isFixed: false,
        sourceArgument: option.argument,
        linkedValueId: flagPart.id
      };
      flagPart.linkedValueId = valuePart.id;
      parts.push(flagPart, valuePart);
    }
  }};
  appendOptions(options.filter((option) => option.argument.position === "before-prefix"));
  for (const token of schema.commandPrefix ?? []) parts.push({ id: id(), role: "action", token, isFixed: true });
  if (action?.name.trim()) parts.push({ id: id(), role: "action", token: action.name.trim(), isFixed: false });
  appendOptions(options.filter((option) => option.argument.position !== "before-prefix"));

  for (const parameter of parameters) {
    if (parameter.value.trim()) {
      parts.push({
        id: id(),
        role: "parameter",
        token: parameter.value.trim(),
        isFixed: false,
        sourceParameter: parameter.parameter
      });
    }
  }
  return parts;
};

export const tokensFromParts = (parts: CommandPart[]): string => {
  const tokens: string[] = [];
  let lastFlag: CommandPart | null = null;
  for (const part of parts) {
    if (part.role === "argumentValue") {
      const style = lastFlag?.sourceArgument?.valueStyle ?? "space";
      if (style === "equals" && tokens.length > 0 && part.token.trim()) {
        tokens[tokens.length - 1] += `=${part.token}`;
      } else if (style === "attached" && tokens.length > 0 && part.token.trim()) {
        tokens[tokens.length - 1] += part.token;
      } else if (part.token.trim()) {
        tokens.push(part.token);
      }
      lastFlag = null;
    } else {
      if (part.token.trim()) tokens.push(part.token);
      lastFlag = part.role === "argument" ? part : null;
    }
  }
  return tokens.join(" ");
};
