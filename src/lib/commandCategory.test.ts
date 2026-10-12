import { describe, expect, it } from "vitest";
import { commandCategory, categoryTags } from "./commandCategory";
import { emptySchema, parseSchemaToml, serializeSchemaToml } from "./schema";
import { selectFilteredSchemas, useCommandWizardStore } from "../stores/useCommandWizardStore";

describe("command categories", () => {
  it("recognizes cmdlets and Linux utilities without treating shells or hyphenated apps as cmdlets", () => {
    for (const name of ["Move-Item", "Invoke-WebRequest", "Get-ChildItem", "Expand-Archive", "Protect-CmsMessage"]) expect(commandCategory({ ...emptySchema(), name })).toBe("powershell");
    for (const name of ["chmod", "cat", "rsync"]) expect(commandCategory({ ...emptySchema(), name })).toBe("linux");
    for (const name of ["powershell", "pwsh", "pandoc", "yt-dlp"]) expect(commandCategory({ ...emptySchema(), name })).toBe("general");
  });

  it("persists category overrides for any installed app and preserves ordinary tags", () => {
    const schema = { ...emptySchema(), name: "pandoc", tags: [{ name: "documents", color: "#21C6B8" }] };
    schema.tags = categoryTags(schema, "linux");
    const saved = parseSchemaToml(serializeSchemaToml(schema));
    expect(commandCategory(saved)).toBe("linux");
    expect(saved.tags[0].name).toBe("documents");
    saved.tags = categoryTags(saved, "general");
    expect(commandCategory(saved)).toBe("general");
  });

  it("switches selection with categories and applies search within the category", () => {
    const store = useCommandWizardStore;
    store.setState({ view: "builder", commandCategory: "general", toolSearch: "", schemas: ["pandoc", "cat", "Move-Item"].map((name) => ({ ...emptySchema(), name })) });
    store.getState().setCommandCategory("powershell");
    expect(store.getState().selectedSchemaName).toBe("Move-Item");
    expect(selectFilteredSchemas(store.getState()).map((schema) => schema.name)).toEqual(["Move-Item"]);
    store.getState().setToolSearch("cat");
    expect(selectFilteredSchemas(store.getState())).toEqual([]);
    store.getState().setCommandCategory("linux");
    expect(store.getState().selectedSchemaName).toBe("cat");
    expect(selectFilteredSchemas(store.getState()).map((schema) => schema.name)).toEqual(["cat"]);
  });
});
