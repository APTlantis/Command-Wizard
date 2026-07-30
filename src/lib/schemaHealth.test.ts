import { describe, expect, it } from "vitest";
import type { ExecutableHealth, ParameterState, ToolSchema } from "../types";
import { emptySchema } from "./schema";
import { schemaHealth } from "./schemaHealth";
import { schemaSearchText } from "../stores/useCommandWizardStore";

const baseSchema = (): ToolSchema => ({
  ...emptySchema(),
  name: "yt-dlp",
  installedName: "yt-dlp.exe",
  description: "Download video metadata",
  notes: "Supports playlists",
  metadata: {
    version: "1",
    author: "Herb",
    source: "help import; completion imported",
    importedFrom: "yt-dlp --help",
    homepage: "https://example.com/yt-dlp",
    executableVersion: "2026.07.01",
    lastValidated: "2026-07-30T12:00:00.000Z"
  },
  actions: [{ name: "download", description: "Fetch media", arguments: [], parameters: [] }],
  arguments: [{ flag: "-f", long: "--format", description: "Video format selector", type: "string", valueStyle: "space" }],
  parameters: [{ name: "URL", type: "url", required: true }],
  tags: [{ name: "media", color: "#21C6B8" }]
});

const availableExecutable: ExecutableHealth = {
  schemaName: "yt-dlp",
  status: "available",
  message: "yt-dlp resolves to C:\\tools\\yt-dlp.exe",
  checkedAt: "1785436800"
};

describe("schema health", () => {
  it("reports ready when schema, executable, arguments, and parameters pass", () => {
    const schema = baseSchema();
    const parameters: ParameterState[] = [{ key: "URL-0", parameter: schema.parameters[0], value: "https://example.com/video" }];

    const health = schemaHealth(schema, parameters, availableExecutable);

    expect(health.checks.find((check) => check.id === "command")?.message).toBe("Ready.");
    expect(health.hasBlockingIssue).toBe(false);
    expect(health.railLabel).toBe("Completion Imported");
  });

  it("reports duplicate arguments as review work", () => {
    const schema = baseSchema();
    schema.arguments.push({ flag: "--format", long: "", description: "", type: "string", valueStyle: "space" });

    const health = schemaHealth(schema, [{ key: "URL-0", parameter: schema.parameters[0], value: "x" }], availableExecutable);

    expect(health.checks.find((check) => check.id === "arguments")?.message).toBe("Duplicate argument: --format");
    expect(health.railLabel).toBe("Needs Review");
  });

  it("reports missing executable and missing required parameters", () => {
    const schema = baseSchema();
    const health = schemaHealth(
      schema,
      [{ key: "URL-0", parameter: schema.parameters[0], value: "" }],
      { ...availableExecutable, status: "missing", message: "yt-dlp was not found on PATH." }
    );

    expect(health.railLabel).toBe("Missing Executable");
    expect(health.checks.find((check) => check.id === "requiredParameters")?.message).toBe("Missing: URL");
    expect(health.checks.find((check) => check.id === "command")?.message).toBe("Not ready.");
  });
});

describe("schema search text", () => {
  it("indexes flags, tags, metadata, aliases, and action descriptions", () => {
    const haystack = schemaSearchText(baseSchema());

    expect(haystack).toContain("--format");
    expect(haystack).toContain("media");
    expect(haystack).toContain("2026.07.01");
    expect(haystack).toContain("yt-dlp.exe");
    expect(haystack).toContain("fetch media");
  });
});
