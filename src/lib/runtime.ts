import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AppSnapshot, CliInstallResult, ExecutableHealth, FavoriteCommand, RuntimeApi, ToolSchema } from "../types";
import { exportFavoritesText } from "./favorites";

const sampleSchema: ToolSchema = {
  name: "rsync",
  description: "Fast file synchronization tool",
  notes: "Bundled browser-mode sample. Tauri loads schemas from the local data directory.",
  sourcePath: "",
  executablePath: "",
  installedName: "",
  metadata: {
    version: "",
    author: "",
    source: "browser sample",
    importedFrom: "",
    homepage: "",
    executableVersion: "",
    lastValidated: ""
  },
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

export const isTauriRuntime = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
  canCaptureHelp: isTauriRuntime(),
  runtimeLabel: isTauriRuntime() ? "Tauri desktop" : "Browser preview",
  async loadSnapshot() {
    if (!isTauriRuntime()) return browserSnapshot;
    return invoke<AppSnapshot>("load_snapshot");
  },
  async saveSchema(schema) {
    if (!isTauriRuntime()) return { ...schema, sourcePath: schema.sourcePath || `browser-preview://${schema.name}.toml` };
    return invoke<ToolSchema>("save_schema", { schema });
  },
  async deleteSchema(schema) {
    if (!isTauriRuntime()) return;
    await invoke("delete_schema", { schema });
  },
  async saveFavorites(favorites) {
    if (!isTauriRuntime()) return;
    await invoke("save_favorites", { favorites });
  },
  async exportFavorites(favorites: FavoriteCommand[], format) {
    const content = format === "json" ? JSON.stringify(favorites, null, 2) : exportFavoritesText(favorites);
    if (!isTauriRuntime()) {
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
    if (!isTauriRuntime()) throw new Error("Help capture is available in the Tauri desktop app. In browser preview, paste help text and use Parse Paste.");
    return invoke<string>("capture_help", { commandName, helpArgs });
  },
  async captureCompletion(commandName) {
    if (!isTauriRuntime()) return null;
    return invoke<string | null>("capture_completion", { commandName });
  },
  async checkExecutables(schemas) {
    if (!isTauriRuntime()) {
      return schemas.map(
        (schema) =>
          ({
            schemaName: schema.name,
            status: "unknown",
            message: "Executable checks need the Tauri desktop app.",
            checkedAt: ""
          }) satisfies ExecutableHealth
      );
    }
    return invoke<ExecutableHealth[]>("check_executables", { schemas });
  },
  async selectScriptPath() {
    if (!isTauriRuntime()) return null;
    const path = await open({
      title: "Import CLI Script",
      multiple: false,
      filters: [
        { name: "Scripts and Commands", extensions: ["ps1", "bat", "cmd", "py", "js", "mjs", "sh", "exe"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return typeof path === "string" ? path : null;
  },
  async installCliScript(scriptPath, commandName, helpArgs) {
    if (!isTauriRuntime()) {
      const name = commandName.trim() || scriptPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "script";
      return {
        commandName: name,
        sourcePath: scriptPath,
        managedScriptPath: `browser-preview://cli/scripts/${name}`,
        shimPath: `browser-preview://cli/bin/${name}`,
        binDir: "browser-preview://cli/bin",
        helpText: ""
      } satisfies CliInstallResult;
    }
    return invoke<CliInstallResult>("install_cli_script", { scriptPath, commandName, helpArgs });
  },
  async readLog() {
    if (!isTauriRuntime()) return browserSnapshot.logText;
    return invoke<string>("read_log");
  }
};
