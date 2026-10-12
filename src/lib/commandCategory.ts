import type { ToolSchema } from "../types";

export type CommandCategory = "general" | "powershell" | "linux";
export const commandCategories = [
  { id: "general", label: "General" },
  { id: "powershell", label: "PowerShell" },
  { id: "linux", label: "Linux (WSL)" }
] as const;

const linuxCommands = new Set("awk bash cat chmod chown cp cut df diff du find grep head less ln ls mkdir mv nano pwd rm rmdir rsync sed sh sort tail tar tee touch tr uname uniq wc wget xargs".split(" "));
// Approved verbs from the local PowerShell Get-Verb catalog, plus built-in
// legacy cmdlet verbs. Explicit category choices always take precedence.
const powershellVerb = /^(Add|Clear|Close|Copy|Enter|Exit|Find|Format|Get|Hide|Join|Lock|Move|New|Open|Optimize|Push|Pop|Redo|Remove|Rename|Reset|Resize|Search|Select|Set|Show|Skip|Split|Step|Switch|Undo|Unlock|Watch|Connect|Disconnect|Read|Receive|Send|Write|Backup|Checkpoint|Compare|Compress|Convert|ConvertFrom|ConvertTo|Dismount|Edit|Expand|Export|Group|Import|Initialize|Limit|Merge|Mount|Out|Publish|Restore|Save|Sync|Unpublish|Update|Debug|Measure|Ping|Repair|Resolve|Test|Trace|Approve|Assert|Build|Complete|Confirm|Deny|Deploy|Disable|Enable|Install|Invoke|Register|Request|Restart|Resume|Start|Stop|Submit|Suspend|Uninstall|Unregister|Wait|Use|Block|Grant|Protect|Revoke|Unblock|Unprotect|ForEach|Sort|Where)-[A-Za-z][A-Za-z0-9]*$/i;

export function commandCategory(schema: ToolSchema): CommandCategory {
  const explicit = schema.tags.find((tag) => tag.name.startsWith("workspace:"))?.name.slice(10);
  if (explicit === "general" || explicit === "powershell" || explicit === "linux") return explicit;
  const tags = schema.tags.map((tag) => tag.name.toLowerCase());
  if (tags.includes("linux") || tags.includes("wsl")) return "linux";
  const command = (schema.installedName || schema.name).split(/[\\/]/).pop() ?? "";
  if (powershellVerb.test(command)) return "powershell";
  if (linuxCommands.has(command.toLowerCase())) return "linux";
  return "general";
}

// Persist the explicit choice through the existing TOML tag contract.
export function categoryTags(schema: ToolSchema, category: CommandCategory) {
  return [...schema.tags.filter((tag) => !tag.name.startsWith("workspace:")), { name: `workspace:${category}`, color: "#21C6B8" }];
}
