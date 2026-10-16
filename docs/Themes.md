# CommandWizard themes

Theme support added 2026-10-16. This is a local maintenance candidate; the historical v2.0.0 installer and release record remain authoritative for that release.

## Choose and create

Use **Theme** in the header to choose Blue Slate, Aptlantis Ada, BlackGold, Clojure, Crystal, Factor, Nim, or Swift. Selection persists on this device. **Customize theme** opens the theme editor in Settings / Evidence.

Choose **Make a copy** to start from any theme, name the copy, then choose a color role and edit lightness, chroma, and hue. Changes appear in the scoped preview. **Save and apply** saves the custom theme and applies it to the app. Built-ins cannot be overwritten. **Edit selected** edits a saved custom theme; **Delete selected** removes it after confirmation, falling back to Blue Slate when necessary. Leaving an unsaved draft requires confirmation; export drafts before discarding them.

**Export theme** downloads the current draft or selected theme as a `.theme.json` file. **Import theme** reviews a local file (maximum 100 KB); it always assigns a new custom ID, protecting existing themes. Save and apply to keep it. These files can be shared manually. No accounts, cloud sync, marketplace, CSS imports, fonts, scripts, or generated-command execution are involved.

## Portable contract

The executable validator is `src/lib/theme.ts`; the equivalent JSON Schema is [public/themes/theme.schema.json](../public/themes/theme.schema.json). Complete examples are in [public/themes](../public/themes), including [Ada](../public/themes/apt-ada.theme.json) and [Blue Slate](../public/themes/blue-slate.theme.json).

Theme files use JSON with `schemaVersion: 1`, an ID of 1–80 lowercase letters/digits/hyphens (starting with a letter or digit), a nonblank name of at most 80 characters, `mode` (`dark` or `light`), and all 23 `colors` roles. Each color is a finite numeric OKLCH tuple `[L, C, H]`: L is 0–1, C is 0–0.4, H is 0–360 degrees. Unsupported versions, missing/extra color roles, and malformed values are rejected. The bundled themes are dark; custom themes can select either mode. Changing mode alone does not generate a palette.

| Roles | Purpose |
| --- | --- |
| `canvas`, `background`, `panel`, `elevated`, `accentSurface` | Canvas and surface hierarchy |
| `border`, `muted`, `secondaryText`, `text` | Boundaries and text hierarchy |
| `primary`, `focus`, `secondary` | Action and focus accents |
| `warning`, `error`, `success`, `info` | Status colors |
| `keyword`, `string`, `number`, `function`, `operator` | Syntax roles |
| `selection`, `selectionText` | Text selection pair |

Optional `provenance` contains `source`, `sha256` (64 hexadecimal characters), and `mapping`. This identifies the source lineage, including for edited copies; it does not claim that custom colors still equal the source. Unknown top-level properties are discarded on import. Themes are parsed into a fresh object and applied as numeric color variables, never as arbitrary CSS. App-owned Tailwind `atl-*` color aliases resolve through the semantic role map; Prism overrides and translucent component colors also follow the theme. User-authored command tag colors remain their own data.

Modern renderers use OKLCH. If `CSS.supports` rejects OKLCH, colors convert to sRGB hex. Out-of-gamut custom colors are channel-clipped for the fallback; native OKLCH appearance can differ. Opaque sRGB contrast estimates flag `text/panel`, `muted/panel`, `primary/panel`, and `selectionText/selection` below 4.5:1. Warnings do not block saves or recolor source palettes. They are not accessibility certification: translucent surfaces, syntax, focus, hover, native controls and all workflow states still need visual review.

## Source identity and refresh

The seven supplied families came from `C:\Users\Administrator\Desktop\MD`. Ada uses `apt-Ada/website/tokens.json`; the other families use their `apt-*/typora/tokens.json` files. Those are supplied target-derived palettes, not new canonical source palettes. Exact source bytes are preserved under `src/themes/sources`; the bundle records their SHA-256 hashes. [Role mapping](../src/themes/mapping.json) documents aliases. Mapped OKLCH tuples are copied exactly; tests also verify hex equivalence.

Blue Slate preserves CommandWizard's existing `src/styles.css` palette by exact sRGB-to-OKLCH conversion. Its existing project profile and layout remain the default; this work does not change City Hall tokens or the Blue Slate standard. Existing `navy` and `ridge` adopter aliases remain app-owned compatibility names.

Run `node scripts/build-themes.mjs [resource-root]` only for an explicit resource refresh. It regenerates source snapshots, bundled themes, mapping, and portable examples. It reads the existing CSS hex defaults for Blue Slate. Normal builds read checked-in assets and need neither the Desktop folder nor network access. The schema remains an independently maintained contract.

## Storage and recovery

Preferences use `localStorage` key `commandwizard.themes.v1`, shaped as `{version: 1, selectedId, custom: [...]}` with up to 100 custom themes. In Tauri this is WebView profile storage, separate from `history.json` and the command data directory; browser preview uses its own origin storage. Theme choice and custom themes persist together in one storage write. Export files for portable backup; clearing app/WebView data can remove themes.

Invalid saved preferences are retained untouched and Blue Slate is used in memory. **Reset theme preferences** is offered after a storage error and requires confirmation; it removes only this theme preference key. Failed writes leave the draft and last saved selection intact. No command schemas, history, launcher shims, or import probes are changed.

## Verification

See [Themes verification](Themes-2026-10-16.md) for results, candidate artifacts, recovery, and proof limits.
