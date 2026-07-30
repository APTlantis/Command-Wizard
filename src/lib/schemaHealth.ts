import type { ExecutableHealth, ParameterState, ToolSchema } from "../types";
import { validateSchema } from "./schema";

export type CheckState = "pass" | "warn" | "fail";

export interface SchemaCheck {
  id: "schema" | "executable" | "arguments" | "requiredParameters" | "command";
  label: string;
  state: CheckState;
  message: string;
}

export interface SchemaHealth {
  checks: SchemaCheck[];
  hasBlockingIssue: boolean;
  railLabel: "Valid" | "Needs Review" | "Missing Executable" | "Completion Imported";
}

const argumentIssues = (schema: ToolSchema): string[] => {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const argument of schema.arguments) {
    const key = argument.long || argument.flag;
    if (!key.trim()) issues.push("Every argument needs a flag or long flag.");
    if (keys.has(key.toLowerCase())) issues.push(`Duplicate argument: ${key}`);
    keys.add(key.toLowerCase());
  }
  return issues;
};

const missingRequiredParameters = (parameters: ParameterState[]) =>
  parameters.filter((parameter) => parameter.parameter.required && !parameter.value.trim()).map((parameter) => parameter.parameter.name);

const completionImported = (schema: ToolSchema) => {
  const source = `${schema.metadata.source} ${schema.metadata.importedFrom}`.toLowerCase();
  return source.includes("completion");
};

export const schemaHealth = (
  schema: ToolSchema | null,
  parameters: ParameterState[] = [],
  executableHealth?: ExecutableHealth
): SchemaHealth => {
  if (!schema) {
    const checks: SchemaCheck[] = [
      { id: "schema", label: "Schema", state: "fail", message: "No schema selected." },
      { id: "executable", label: "Executable", state: "warn", message: "No executable checked." },
      { id: "arguments", label: "Arguments", state: "fail", message: "No arguments available." },
      { id: "requiredParameters", label: "Required Parameters", state: "fail", message: "No schema selected." },
      { id: "command", label: "Command", state: "fail", message: "Not ready." }
    ];
    return { checks, hasBlockingIssue: true, railLabel: "Needs Review" };
  }

  const issues = validateSchema(schema);
  const argIssues = argumentIssues(schema);
  const missingParams = missingRequiredParameters(parameters);
  const executableMissing = executableHealth?.status === "missing";
  const schemaState = issues.filter((issue) => !argIssues.includes(issue)).length ? "fail" : "pass";
  const argumentsState = argIssues.length ? "fail" : "pass";
  const requiredState = missingParams.length ? "fail" : "pass";
  const executableState: CheckState = executableMissing ? "fail" : executableHealth?.status === "unknown" || !executableHealth ? "warn" : "pass";
  const blocking = schemaState === "fail" || argumentsState === "fail" || requiredState === "fail" || executableMissing;

  const checks: SchemaCheck[] = [
    {
      id: "schema",
      label: "Schema",
      state: schemaState,
      message: schemaState === "pass" ? "Schema identity is valid." : issues.filter((issue) => !argIssues.includes(issue))[0] ?? "Schema needs review."
    },
    {
      id: "executable",
      label: "Executable",
      state: executableState,
      message: executableHealth?.message ?? "Executable has not been checked in this runtime."
    },
    {
      id: "arguments",
      label: "Arguments",
      state: argumentsState,
      message: argIssues.length ? argIssues[0] : `${schema.arguments.length} argument${schema.arguments.length === 1 ? "" : "s"} ready.`
    },
    {
      id: "requiredParameters",
      label: "Required Parameters",
      state: requiredState,
      message: missingParams.length ? `Missing: ${missingParams.join(", ")}` : "All required parameters are filled."
    },
    {
      id: "command",
      label: "Command",
      state: blocking ? "fail" : "pass",
      message: blocking ? "Not ready." : "Ready."
    }
  ];

  const railLabel = executableMissing
    ? "Missing Executable"
    : schemaState === "fail" || argumentsState === "fail"
      ? "Needs Review"
      : completionImported(schema)
        ? "Completion Imported"
        : "Valid";

  return { checks, hasBlockingIssue: blocking, railLabel };
};
