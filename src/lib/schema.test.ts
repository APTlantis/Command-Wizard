import { describe, expect, it } from "vitest";
import { parseSchemaToml, serializeSchemaToml, validateSchema } from "./schema";

describe("schema toml", () => {
  it("loads the existing CommandWizard schema shape", () => {
    const schema = parseSchemaToml(`
[tool]
name = "rsync"
description = "Fast file synchronization tool"

[[arguments]]
flag = "-a"
long = "--archive"
description = "archive mode"
type = "boolean"

[[parameters]]
name = "source"
type = "path"
`);

    expect(schema.name).toBe("rsync");
    expect(schema.arguments).toHaveLength(1);
    expect(schema.parameters[0]).toMatchObject({ name: "source", required: true });
  });

  it("round trips equals and attached value styles", () => {
    const toml = serializeSchemaToml({
      name: "demo",
      description: "Demo",
      notes: "",
      sourcePath: "",
      executablePath: "",
      installedName: "",
      actions: [],
      arguments: [
        { flag: "--config", long: "", description: "Config", type: "string", valueStyle: "equals" },
        { flag: "-I", long: "", description: "Include", type: "path", valueStyle: "attached" }
      ],
      parameters: [],
      tags: []
    });

    expect(toml).toContain('value_style = "equals"');
    expect(toml).toContain('value_style = "attached"');
    expect(parseSchemaToml(toml).arguments.map((arg) => arg.valueStyle)).toEqual(["equals", "attached"]);
  });

  it("validates duplicate arguments", () => {
    const issues = validateSchema({
      name: "demo",
      description: "",
      notes: "",
      sourcePath: "",
      executablePath: "",
      installedName: "",
      actions: [],
      arguments: [
        { flag: "--help", long: "", description: "", type: "boolean", valueStyle: "space" },
        { flag: "--help", long: "", description: "", type: "boolean", valueStyle: "space" }
      ],
      parameters: [],
      tags: []
    });

    expect(issues).toContain("Duplicate argument: --help");
  });
});
