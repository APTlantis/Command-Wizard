import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { AppSnapshot, FavoriteCommand, RuntimeApi, ToolSchema } from "../types";
import { exportFavoritesText } from "./favorites";

const sampleSchema: ToolSchema = {
  name: "rsync",
  description: "Fast file synchronization tool",
  notes: "Bundled browser-mode sample. Tauri loads schemas from the local data directory.",
  sourcePath: "",
  executablePath: "",
  installedName: "",
  actions: [],
  arguments: [
    { flag: "-a", long: "--archive", description: "archive mode", type: "boolean", valueStyle: "space" },
    { flag: "--delete", long: "", description: "delete removed files", type: "boolean", valueStyle: "space" },
    { flag: "--progress", long: "", description: "show transfer progress", type: "boolean", valueStyle: "space" }
  ],
  parameters: [
    { name: "source", type: "path", required: true },
    { name: "destination", type: "path", required: true }
  ],
  tags: [{ name: "sync", color: "#21C6B8" }]
};

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const browserSnapshot: AppSnapshot = {
  dataRoot: "browser-preview://Aptlantis/CommandWizard",
  schemas: [sampleSchema],
  favorites: [],
  logText: "Browser preview mode. Launch with Tauri for local file access."
};

const downloadText = (fileName: string, content: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const runtime: RuntimeApi = {
  async loadSnapshot() {
    if (!isTauri()) return browserSnapshot;
    return invoke<AppSnapshot>("load_snapshot");
  },
  async saveSchema(schema) {
    if (!isTauri()) return { ...schema, sourcePath: schema.sourcePath || `browser-preview://${schema.name}.toml` };
    return invoke<ToolSchema>("save_schema", { schema });
  },
  async deleteSchema(schema) {
    if (!isTauri()) return;
    await invoke("delete_schema", { schema });
  },
  async saveFavorites(favorites) {
    if (!isTauri()) return;
    await invoke("save_favorites", { favorites });
  },
  async exportFavorites(favorites: FavoriteCommand[], format) {
    const content = format === "json" ? JSON.stringify(favorites, null, 2) : exportFavoritesText(favorites);
    if (!isTauri()) {
      downloadText(format === "json" ? "favorites.json" : "favorites.txt", content);
      return null;
    }
    const path = await save({
      title: "Export Favorites",
      defaultPath: format === "json" ? "favorites.json" : "favorites.txt",
      filters: [{ name: format === "json" ? "JSON" : "Text", extensions: [format === "json" ? "json" : "txt"] }]
    });
    if (!path) return null;
    await invoke("write_export_file", { path, content });
    return path;
  },
  async captureHelp(commandName, helpArgs) {
    if (!isTauri()) throw new Error("Help capture requires the Tauri desktop app.");
    return invoke<string>("capture_help", { commandName, helpArgs });
  },
  async captureCompletion(commandName) {
    if (!isTauri()) return null;
    return invoke<string | null>("capture_completion", { commandName });
  },
  async readLog() {
    if (!isTauri()) return browserSnapshot.logText;
    return invoke<string>("read_log");
  }
};
