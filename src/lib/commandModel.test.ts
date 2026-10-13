import { describe, expect, it } from "vitest";
import { emptySchema, parseSchemaToml, serializeSchemaToml, validateSchema } from "./schema";
import { buildParts, makeOptionStates, makeParameterStates, tokensFromParts } from "./commandBuilder";
import { useCommandWizardStore as store } from "../stores/useCommandWizardStore";
import { buildSchemaFromDraft, createImportDraft, parseHelpText } from "./helpImport";

describe("command identity and scopes", () => {
  it("imports nested identity and value-taking OpenSSL flags without usage placeholders", () => {
    const draft = createImportDraft("openssl genpkey", "Usage: openssl genpkey [FLAGS]\n  -algorithm val  Algorithm\n  -out outfile    Output\n  -C value       Upper\n  -c value       Lower");
    const schema = buildSchemaFromDraft(draft);
    expect(schema.installedName).toBe("openssl");
    expect(schema.commandPrefix).toEqual(["genpkey"]);
    expect(schema.parameters).toEqual([]);
    expect(schema.arguments.map((arg) => arg.type)).toEqual(["string", "string", "string", "string"]);
    expect(parseHelpText("git", "Options:\n  -C value  Upper\n  -c value  Lower").schema.arguments).toHaveLength(2);
  });
  it("round trips prefixes, global placement and newlines", () => {
    const schema = { ...emptySchema(), name: "git remote add", installedName: "git", family: "git", commandPrefix: ["remote", "add"], notes: "first\nsecond", arguments: [{ flag: "-C", long: "", description: "directory", type: "string", valueStyle: "space" as const, position: "before-prefix" as const }] };
    const restored = parseSchemaToml(serializeSchemaToml(schema));
    expect(restored.commandPrefix).toEqual(["remote", "add"]);
    expect(restored.notes).toBe("first\nsecond");
    const options = makeOptionStates(restored); options[0].value = "repo";
    expect(tokensFromParts(buildParts(restored, null, options, []))).toBe("git -C repo remote add");
  });
  it("uses action-specific fields and preserves flag case", () => {
    const schema = { ...emptySchema(), name: "git", arguments: ["-C", "-c"].map((flag) => ({ flag, long: "", description: "", type: "string", valueStyle: "space" as const })), actions: [{ name: "clone", description: "", arguments: [{ flag: "--depth", long: "", description: "", type: "string", valueStyle: "space" as const }], parameters: [{ name: "repository", required: true, type: "url" }] }, { name: "status", description: "", arguments: [], parameters: [] }] };
    expect(validateSchema(schema)).toEqual([]);
    expect(makeOptionStates(schema, schema.actions[0])).toHaveLength(3);
    expect(makeParameterStates(schema, schema.actions[0])).toHaveLength(1);
    store.setState(store.getInitialState(), true); store.setState({ schemas: [schema] }); store.getState().selectSchema("git");
    expect(store.getState().parameters[0].parameter.name).toBe("repository");
    store.getState().selectAction("status");
    expect(store.getState().parameters).toHaveLength(0);
    expect(store.getState().options).toHaveLength(2);
    schema.arguments.push(schema.arguments[0]);
    expect(validateSchema(schema)).toContain("Duplicate argument: -C");
  });
});
