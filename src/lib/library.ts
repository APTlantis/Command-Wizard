import type { BuilderSnapshot, FavoriteCommand } from "../types";
import { validateSchema } from "./schema";

export type LibraryEntry = FavoriteCommand & { id: string; title: string; notes: string; category: "general" | "powershell" | "linux"; updatedAt: string };
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function validSnapshot(snapshot: BuilderSnapshot | null | undefined): snapshot is BuilderSnapshot {
  if (!snapshot) return false;
  try {
    const schema = snapshot.schema;
    return [schema.name, schema.installedName, schema.executablePath, schema.description, schema.notes].every((value) => typeof value === "string") &&
      Array.isArray(schema.tags) && !!schema.metadata && validateSchema(schema).length === 0 && typeof snapshot.selectedActionName === "string" &&
      (!snapshot.selectedActionName || schema.actions.some((action) => action.name === snapshot.selectedActionName)) &&
      Array.isArray(snapshot.options) && snapshot.options.every((row) => typeof row.key === "string" && typeof row.value === "string" && typeof row.selected === "boolean" && typeof row.argument.flag === "string") &&
      Array.isArray(snapshot.parameters) && snapshot.parameters.every((row) => typeof row.key === "string" && typeof row.value === "string" && typeof row.parameter.name === "string");
  } catch { return false; }
}
export function normalizeEntry(entry: FavoriteCommand, index = 0): LibraryEntry {
  return {
    ...entry,
    id: entry.id || `legacy:${entry.createdAt}:${index}`,
    title: entry.title || entry.task || entry.tool || entry.command.split(/\r?\n/)[0].slice(0, 80) || "Saved command",
    notes: entry.notes ?? "",
    category: entry.category === "powershell" || entry.category === "linux" ? entry.category : "general",
    updatedAt: entry.updatedAt || entry.createdAt,
    builderSnapshot: validSnapshot(entry.builderSnapshot) ? entry.builderSnapshot : null
  };
}
export function newEntry(): LibraryEntry {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: "New command", notes: "", category: "general", command: "", tool: "", action: "", task: "", tags: [], createdAt: now, updatedAt: now, builderSnapshot: null };
}
