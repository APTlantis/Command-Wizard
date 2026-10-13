import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchemaToml, serializeSchemaToml, validateSchema } from "./schema";
import { buildParts, makeOptionStates, makeParameterStates, tokensFromParts } from "./commandBuilder";

const files = readdirSync("schemas").filter((file) => file.endsWith(".toml"));
describe("reviewed repository catalog", () => {
  it.each(files)("validates and round trips %s", (file) => {
    const schema = parseSchemaToml(readFileSync(`schemas/${file}`, "utf8"));
    expect(validateSchema(schema)).toEqual([]);
    expect(schema.executablePath).toBe("");
    expect(schema.parameters.some((parameter) => /^(flags|options|command)$/i.test(parameter.name))).toBe(false);
    const restored = parseSchemaToml(serializeSchemaToml(schema));
    expect(restored.arguments).toEqual(schema.arguments);
    expect(restored.actions).toEqual(schema.actions);
    expect(restored.commandPrefix).toEqual(schema.commandPrefix);
    const tokens = tokensFromParts(buildParts(schema, null, makeOptionStates(schema), makeParameterStates(schema)));
    expect(tokens).toBe([schema.installedName || schema.name, ...(schema.commandPrefix ?? [])].join(" "));
  });
});
