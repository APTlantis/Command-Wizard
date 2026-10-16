# Schema metadata tags — October 14, 2026

The operator restored 401 application-data schema working copies under `schemas/` and supplied `Metadata-tags-for-apps.toml`. The folder's earlier absence was a temporary maintenance move, not proof of a missing release catalog.

The supplied vocabulary contains 418 name/color pairs with repeated flat keys. It was preserved unchanged and read as a vocabulary list, not parsed as a valid whole TOML document. 2,005 tags were appended across 401 schemas using `cli-tool`, `command-line`, and reviewed family/purpose mappings. Existing tags/colors and reserved category tags were retained. Candidate labels absent from the vocabulary (`download`, `synchronization`, `text-processing`) were omitted rather than invented. No new linux/wsl routing tags were added.

Every resulting schema parses as TOML. Decoded before/after comparison permits only appended tags. Original bytes are retained under `E:/Doc-Sites/Command-Wizard/.recovery/metadata-tags-2026-10-14/`. The detailed report is `E:/Doc-Sites/Command-Wizard/docs/metadata-tags-report.json`; the reproducible review/apply script is `scripts/metadata-tags.py` in that documentation project.

This pass edits project-folder working copies only. It does not install into live app data, run generated commands, change source behavior, promote a candidate, or rewrite historical catalog coverage/hash evidence. New tagged files need their own current hash evidence; prior dated hashes describe the prior bytes.

## Focused app compatibility checks

`npm run test -- src/lib/schema.test.ts src/lib/commandCategory.test.ts src/lib/catalog.test.ts` completed with 407 passed / 1 failed (408 total). Schema/category files passed. The one catalog failure requires a blank executable path for `mongoimport.toml`, but the original restored working copy already contains `C:\Program Files\MongoDB\Tools\100\bin`; that value is unchanged by tagging. No attempt was made to strip personal paths or rewrite the portable-catalog expectation.
