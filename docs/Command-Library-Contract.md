# Command Library and schema contracts

Implemented 2026-10-12. Commands remain copy/export only. Catalog installation, execution, collections, placeholder templates, and CLI-feature removal are outside this change.

## Command identity

`name` is the display/selection identity. `installedName` is the executable or cmdlet identity; availability checks use it. Optional `family` groups the tool rail. Optional `commandPrefix` contains individual fixed tokens. TOML uses `installed_name` and `command_prefix`.

```toml
[tool]
name = "dotnet build"
installed_name = "dotnet"
family = "dotnet"
command_prefix = ["build"]
```

Assembly order is executable, options marked `position = "before-prefix"`, fixed prefix tokens, selected action, remaining options, then positional parameters. `position` defaults to `after-prefix`, preserving legacy assembly. Global flags such as Git `-C` and `-c` are separate, case-sensitive definitions. A root argument and an action argument with the same primary flag use the action definition. Action changes rebuild scoped fields, preserve shared root option values, and reset action inputs.

Actions can declare `[[actions.arguments]]` and `[[actions.parameters]]`. Split operations have independently reviewed fields. Root-only switches are not donated to unrelated operations. Usage words such as FLAGS, OPTIONS, COMMAND and executable names are excluded from imported positional inputs. Alternative grammars, mandatory option values, repetition, intermediate prefix scopes, and shell quoting still require command review; they are not modeled as a full shell grammar.

Family groups expand in the rail; searching exposes matching entries directly. General, PowerShell and Linux categories remain independent of families. Schema Studio edits family, executable identity, fixed tokens, and option placement. A saved snapshot cannot overwrite an installed schema through Schema Studio.

## Library editor

Library replaces the unrelated schema rail with saved commands, search, category/tag filters, and descending update-time sorting. The detail editor shows title, notes, category, editable tags, optional tool association, and command text. New pasted commands are unassigned. A suggested title is provided; title and nonempty command text are required to save. Titles need not be unique, and identical command strings can be stored under separate IDs.

Builder **Save to Library** opens the same editor in a modal with command text and metadata prefilled. Saving completes only after persistence succeeds. **View in Library** opens the saved entry while preserving Builder inputs. Copy, duplicate, delete, JSON export and text export are available. Wrapped text is the default; disabling wrapping enables horizontal scrolling. Existing CRLF/LF text is retained in storage; browser textarea editing follows normal browser newline behavior.

Draft state is separate from saved entries. Switching entries/workspaces, canceling dirty edits, duplicating while dirty, and reopening while dirty require a discard decision. Rejecting that decision retains the draft. Browser page departure and native window closing also guard dirty drafts; closing is blocked during a save. A failed write retains the draft and reports an error without adding an entry or announcing success. Saving disables conflicting editor actions. Cancel restores the original saved entry or closes a new draft. Duplicating a saved entry uses a fresh ID and requires a subsequent Save.

## Saved-entry compatibility

The persisted JSON array retains `command`, `tool`, `action`, `task`, `createdAt`, and `tags`, with these additions:

| Field | Contract |
| --- | --- |
| `id` | Stable identity; updates/deletes use ID, not command text or timestamp |
| `title` | Required display title |
| `notes` | Optional free text |
| `category` | `general`, `powershell`, or `linux` |
| `updatedAt` | ISO timestamp of successful update |
| `builderSnapshot` | Optional embedded schema, selected action, option states and parameter states |

Legacy entries receive deterministic IDs from their original timestamp and array index. Titles derive from task label, tool, or command excerpt. Conversion occurs in memory; loading does not rewrite history. Old entries remain editable text commands, with exact command bytes and tags retained.

On the first actual save of legacy history, Rust writes a uniquely named `history.backup-<timestamp>.json` containing the original bytes. It writes new JSON to a uniquely named temporary sibling, syncs the file, and atomically replaces history using Windows `ReplaceFileW` (rename on other platforms). Migration backup or persistence failure aborts the save. Invalid existing JSON is reported rather than silently overwritten. Temporary files are removed after a failed replacement.

## Builder snapshots

Builder saves embed the complete selected schema and current fields. **Reopen in Builder** clones those into a temporary context and checks that snapshot's executable independently of installed-schema health. Changes to installed schemas do not change the saved Builder setup; no installed schema is replaced or inserted. Selecting an installed command leaves the temporary context. Reserved schema category tags stay inside the snapshot and are not exposed as new Library tags.

Metadata-only edits retain a snapshot. Editing command text clears it and identifies the entry as a **Text command**. Invalid snapshots are treated as text commands so the saved command remains accessible. Reopening restores the generated Builder setup; it does not execute or deploy it.

## Verification boundary

See [catalog guide](../schemas/README.md) and [delivery record](Catalog-and-Library-2026-10-12.md). Browser mode is an in-memory preview, with downloads for exports. It does not establish desktop disk persistence or native WebView interaction. Rust tests exercise the real Windows atomic file replacement against isolated test files; the packaged native launch is recorded separately. Live history and installed schemas are not used as test fixtures.
