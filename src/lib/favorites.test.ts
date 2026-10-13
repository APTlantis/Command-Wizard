import { describe, expect, it } from "vitest";
import { exportFavoritesText, filterFavorites } from "./favorites";
import type { FavoriteCommand } from "../types";

const favorites: FavoriteCommand[] = [
  {
    command: "rsync -a src dest",
    tool: "rsync",
    action: "",
    task: "backup",
    createdAt: "2026-07-30T10:00:00.000Z",
    tags: [{ name: "sync", color: "#21C6B8" }]
  },
  {
    command: "git clone repo",
    tool: "git",
    action: "clone",
    task: "",
    createdAt: "2026-07-30T11:00:00.000Z",
    tags: [{ name: "source", color: "#9C7CFF" }]
  }
];

describe("favorites", () => {
  it("filters by search and tag", () => {
    expect(filterFavorites(favorites, "backup", "sync")).toHaveLength(1);
    expect(filterFavorites(favorites, "backup", "source")).toHaveLength(0);
  });

  it("exports readable text", () => {
    const text = exportFavoritesText(favorites);

    expect(text).toContain("# tool: rsync");
    expect(text).toContain("rsync -a src dest");
    expect(text).toContain("# action: clone");
  });
  it("exports exact multiline command bytes and searches titles, notes and tags", () => {
    const entry = { ...favorites[0], title: "My title", notes: "Some notes\nsecond note", command: "  first\r\nsecond  \n", tags: [{ name: "special", color: "red" }] };
    expect(exportFavoritesText([entry])).toContain(entry.command);
    expect(exportFavoritesText([entry])).toContain("# second note");
    for (const query of ["My title", "Some notes", "special"]) expect(filterFavorites([entry], query, "All")).toHaveLength(1);
  });
});
