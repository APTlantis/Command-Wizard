import { describe, expect, it } from "vitest";
import { buildParts, makeOptionStates, makeParameterStates, tokensFromParts } from "./commandBuilder";
import type { ToolSchema } from "../types";

const schema: ToolSchema = {
  name: "git",
  installedName: "git-local",
  description: "",
  notes: "",
  sourcePath: "",
  executablePath: "",
  metadata: {
    version: "",
    author: "",
    source: "",
    importedFrom: "",
    homepage: "",
    executableVersion: "",
    lastValidated: ""
  },
  actions: [{ name: "clone", description: "", arguments: [], parameters: [] }],
  arguments: [
    { flag: "--depth", long: "", description: "", type: "string", valueStyle: "space" },
    { flag: "--quiet", long: "", description: "", type: "boolean", valueStyle: "space" },
    { flag: "--config", long: "", description: "", type: "string", valueStyle: "equals" },
    { flag: "-I", long: "", description: "", type: "string", valueStyle: "attached" }
  ],
  parameters: [{ name: "repo", type: "string", required: true }],
  tags: []
};

describe("command builder", () => {
  it("uses canonical order", () => {
    const options = makeOptionStates(schema);
    options[0].value = "1";
    options[1].selected = true;
    const params = makeParameterStates(schema);
    params[0].value = "https://example.com/repo.git";

    const command = tokensFromParts(buildParts(schema, schema.actions[0], options, params));

    expect(command).toBe("git-local clone --depth 1 --quiet https://example.com/repo.git");
  });

  it("joins value styles", () => {
    const options = makeOptionStates(schema);
    options[2].value = "color.ui=true";
    options[3].value = "/usr/include";

    const command = tokensFromParts(buildParts(schema, null, options, []));

    expect(command).toBe("git-local --config=color.ui=true -I/usr/include");
  });
});
