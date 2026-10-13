import type { FavoriteCommand } from "../types";

export const exportFavoritesText = (favorites: FavoriteCommand[]): string =>
  favorites
    .map((favorite) => {
      const lines = [];
      if (favorite.title) lines.push(`# title: ${favorite.title.replace(/[\r\n]/g, " ")}`);
      if (favorite.notes) lines.push(...favorite.notes.split(/\r?\n/).map((line) => `# ${line}`));
      if (favorite.tool) lines.push(`# tool: ${favorite.tool}`);
      if (favorite.action) lines.push(`# action: ${favorite.action}`);
      if (favorite.task) lines.push(`# task: ${favorite.task}`);
      if (favorite.createdAt) lines.push(`# saved: ${new Date(favorite.createdAt).toLocaleString()}`);
      lines.push(favorite.command);
      return lines.join("\n");
    })
    .join("\n\n");

export const filterFavorites = (favorites: FavoriteCommand[], search: string, tag: string): FavoriteCommand[] => {
  const needle = search.trim().toLowerCase();
  return favorites.filter((favorite) => {
    const matchesSearch =
      !needle ||
      favorite.command.toLowerCase().includes(needle) ||
      (favorite.title ?? "").toLowerCase().includes(needle) ||
      (favorite.notes ?? "").toLowerCase().includes(needle) ||
      favorite.tags.some((tag) => tag.name.toLowerCase().includes(needle)) ||
      favorite.tool.toLowerCase().includes(needle) ||
      favorite.action.toLowerCase().includes(needle) ||
      favorite.task.toLowerCase().includes(needle);
    const matchesTag = tag === "All" || favorite.tags.some((item) => item.name.toLowerCase() === tag.toLowerCase());
    return matchesSearch && matchesTag;
  });
};
