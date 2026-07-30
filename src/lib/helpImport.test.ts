import { describe, expect, it } from "vitest";
import { addActionLines, addArgumentLines, addParameterLines, buildSchemaFromDraft, createImportDraft, mergeCompletionData, parseHelpText } from "./helpImport";

describe("help import", () => {
  it("parses winget-style actions and options", () => {
    const { schema } = parseHelpText(
      "winget",
      `Windows Package Manager

Usage: winget [<command>] [<options>]

Commands:
  install      Installs the given package
  search       Searches for a package
  list         Lists installed packages

Options:
  --verbose    Enables verbose logging
  --no-proxy   Disables proxy use
  -?, --help   Shows help`
    );

    expect(schema.actions.map((action) => action.name)).toEqual(expect.arrayContaining(["install", "search", "list"]));
    expect(schema.arguments.map((argument) => argument.flag)).toEqual(expect.arrayContaining(["--verbose", "--no-proxy", "-?"]));
  });

  it("parses usage parameters", () => {
    const { schema } = parseHelpText("node", "Usage: node [options] [script.js] [arguments]\n\nOptions:\n  --watch  Watch mode");

    expect(schema.parameters.map((param) => param.name)).toEqual(expect.arrayContaining(["script.js", "arguments"]));
    expect(schema.arguments.some((arg) => arg.flag === "--watch")).toBe(true);
  });

  it("normalizes colored help output and typed option placeholders", () => {
    const { schema } = parseHelpText(
      "hf",
      "\u001b[1mUsage:\u001b[0m hf [OPTIONS] COMMAND [ARGS]...\n\nCommands:\n  auth       Manage authentication\n\nOptions:\n  --token TEXT   Authentication token\n  --endpoint URL Hub endpoint"
    );

    expect(schema.actions.map((action) => action.name)).toContain("auth");
    expect(schema.arguments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flag: "--token", type: "string", description: "Authentication token" }),
        expect.objectContaining({ flag: "--endpoint", type: "string", description: "Hub endpoint" })
      ])
    );
  });

  it("merges completion data without removing help rows", () => {
    const { schema } = parseHelpText("demo", "Usage: demo [options]\n\nOptions:\n  --help Show help");
    const merged = mergeCompletionData(schema, "Register-ArgumentCompleter -CommandName demo -ScriptBlock { $globalFlags = @('--verbose') }");

    expect(merged.arguments.map((arg) => arg.flag)).toEqual(expect.arrayContaining(["--help", "--verbose"]));
  });

  it("builds schema from edited draft rows", () => {
    let draft = createImportDraft("ffmpeg", "Usage: ffmpeg [options] <input>\n\nOptions:\n  -i <file> Input file");
    draft = addActionLines(draft, "convert    Convert media");
    draft = addArgumentLines(draft, "--overwrite         Replace existing output");
    draft = addParameterLines(draft, "[destination]");

    const schema = buildSchemaFromDraft(draft);

    expect(schema.name).toBe("ffmpeg");
    expect(schema.actions.some((action) => action.name === "convert")).toBe(true);
    expect(schema.arguments.some((arg) => arg.flag === "--overwrite")).toBe(true);
    expect(schema.parameters.some((param) => param.name === "destination" && !param.required)).toBe(true);
  });
});
