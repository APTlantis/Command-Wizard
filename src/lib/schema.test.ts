import { describe, expect, it } from "vitest";
import { emptyMetadata, parseSchemaToml, serializeSchemaToml, validateSchema } from "./schema";

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
    expect(schema.metadata).toEqual(emptyMetadata());
  });

  it("round trips optional provenance metadata", () => {
    const toml = serializeSchemaToml({
      name: "yt-dlp",
      description: "Video downloader",
      notes: "",
      sourcePath: "",
      executablePath: "",
      installedName: "yt-dlp",
      metadata: {
        version: "1",
        author: "Herb",
        source: "help import; completion imported",
        importedFrom: "yt-dlp --help",
        homepage: "https://github.com/yt-dlp/yt-dlp",
        executableVersion: "2026.07.01",
        lastValidated: "2026-07-30T12:00:00.000Z"
      },
      actions: [],
      arguments: [],
      parameters: [],
      tags: []
    });

    expect(toml).toContain("[metadata]");
    expect(toml).toContain('imported_from = "yt-dlp --help"');
    expect(parseSchemaToml(toml).metadata).toMatchObject({
      source: "help import; completion imported",
      importedFrom: "yt-dlp --help",
      executableVersion: "2026.07.01"
    });
  });

  it("round trips equals and attached value styles", () => {
    const toml = serializeSchemaToml({
      name: "demo",
      description: "Demo",
      notes: "",
      sourcePath: "",
      executablePath: "",
      installedName: "",
      metadata: emptyMetadata(),
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
      metadata: emptyMetadata(),
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
