# Frontend guidance installed for Claude and Codex

The saved guidance now favors inspected references and FORM's design methods over an Impeccable-only aesthetic checklist. It carries the user's rejected Formroom directions forward as rejected work, preserves useful task density, and connects source, selection and visible consequence. It does not prescribe one palette, font, medium or page structure.

For a repeated-use product, the main task should be legible with plain labels and concise copy. For an expressive experience, the scene and interactions should form a coherent domain. Both require real behavior, selected-object continuity, recovery, and inspection of normal-motion intermediate and interrupted states. A screenshot, build, test suite or model grade cannot overrule the user's rejection.

## Installed paths

| Path | Change |
| --- | --- |
| `~/.codex/skills/authored-frontends/SKILL.md` | Revised canonical entrypoint: FORM routing, source-to-consequence work, identity/interruption, useful density, concise labels and evidence limits. |
| `~/.codex/skills/authored-frontends/references/aiden-field-guide.md` | New self-contained curated field guide. Fixes the previously missing linked file, with primary pinned source links and prior-operation/source-only boundaries. |
| `~/.codex/skills/authored-frontends/references/references.md` | Routes to the installed field guide and explains the optional corpus boundary. |
| `~/.codex/skills/authored-frontends/references/review.md` | Adds concrete selected-artifact/source/consequence and focus/recovery checks. |
| `~/.codex/skills/authored-frontends/assets/examples/` | Refreshes current original studies and licensed local assets from the curated whitelist; Current upstream flat hash inventory; observed as 56 files after an independent refresh. |
| `~/.codex/skills/authored-frontends/references/mechanisms.md` | Maps the actual refreshed mechanism entrypoints and their limits. |
| `~/.codex/skills/authored-frontends/references/example-manifest.json` | Actual current upstream path-to-SHA-256 inventory; its flat schema is preserved. |
| `~/.claude/skills/authored-frontends` | New symlink to the canonical Codex skill. |
| `~/.claude/skills/form-design` | New symlink to the existing canonical FORM Design skill. |
| `~/.claude/skills/form-explore` | New symlink to the existing canonical FORM Explore skill. |
| `~/.claude/skills/form-unslop` | New symlink to the existing canonical FORM Unslop skill. |
| `~/.claude/skills/impeccable/SKILL.md` | Targeted preference override near the top. Its original frontmatter and all 23 command-table entries are preserved. |

Existing FORM content, licenses, canonical scripts and legacy example assets were preserved. The original study bundle was subsequently refreshed from the current local `ui` source through the existing curated study/asset whitelist. No unrelated existing directories were replaced. No permissions, hooks, provider settings or application configuration changed. The local `ui` project was read, not edited.

The installed bundle now contains the current Relay `ProofGarden.tsx` and `useContinuity.ts`, PhotoStack, voyage state/portraits, lamp geometry, playable score/voice/room modules and Matter engine. These are independently inspectable and seedable original mechanisms, still unapproved visual candidates. The newer upstream curation removes unused legacy ChangeLoom, SignalScope and InstrumentHousing modules and six study thumbnails. Current documented mechanism paths remain available. The bundle excludes gallery bootstraps, `.references`, server data and private working state; the installed instructions and curated field guide were not overwritten by the broad project packager.

## Evidence and provenance

The focused inputs were `ui/UI_TASTE.md` and the local reports `research/aiden-field-guide.md`, `aiden-design-systems.md`, `aiden-claude-workflow.md` and `builder-interaction-study.md`, alongside selected actual Builder and FORM source. The installed guide summarizes the relevant evidence without copying the full research corpus.

The historical study records operated Builder/Student/Founder/Designer states separately from source-inferred behavior in other projects. Its pinned source links identify snapshots, not a claim that every deployment is unchanged or every game branch was played. Public coauthor metadata does not reveal private Claude prompts or establish which model caused a design. Personal media and third-party reference assets retain their own rights.

Original modified files were copied before editing to:

`output/frontend-guidance-backup/20261109T094804Z/`

The later bundle-refresh backup is `output/frontend-guidance-backup/20261109T101455Z/`. It retains the prior bundle, manifest, seed helper, affected references and repository documentation/verifier. A compatibility-repair backup at `output/frontend-guidance-backup/20261109T104343Z/` retains the repository verifier/documentation before adapting to the newer upstream inventory. Together the three backup manifests cover 61 records. Each `manifest.json` records original absolute paths, backup locations and SHA-256 hashes. The verifier checks the backup hashes and that the existing Impeccable command rows and frontmatter remain intact.

## Verify the saved installation

Run from this repository:

```sh
python3 scripts/verify-frontend-guidance.py
python3 scripts/verify-frontend-guidance.py --json
python3 scripts/verify-frontend-guidance.py --build-studies \
  --dependency-root /path/to/compatible/node_modules
# Optional live-source comparison, which can fail after independent ui changes:
python3 scripts/verify-frontend-guidance.py --source-project /path/to/ui
```

The script parses actual YAML with PyYAML. It checks the four discovery symlinks and matching entrypoint names, all local links from those entrypoints plus authored references and the Claude Impeccable entrypoint, the backup hashes, and preserved Impeccable commands. It then forces the reference-search helper down its absent-corpus fallback, copies a real Loom study into a temporary directory, and checks that a second seed refuses to overwrite it. It also verifies every actual file against the complete current upstream inventory, all documented mechanism module paths, hash syntax and safe paths. It accepts both the upstream flat inventory and the earlier schema-2 wrapper without rewriting either. For wrapped inventories it additionally checks declared source metadata; for flat inventories it records observation time, manifest modification time, exact file hashes and computed source-inventory hash in the validation report. A final check detects bundle or manifest mutation during verification. With `--source-project`, all copied study files/assets are compared to that actual source project; the standalone base CSS is the declared exception. It does not install packages, start services or use the network.

Validation on 2026-11-09 passed the discovery/frontmatter, 69 current local-reference, 61 backup-record hashes/23 preserved command, complete actual bundle/source inventory hash, fallback and overwrite-guard groups. The `skill-creator` validator accepted authored-frontends.

The earlier 65-file snapshot passed all six starter typechecks/builds. The independent upstream refresh subsequently installed a 56-file bundle, so that old snapshot is historical evidence rather than the current installation. The current six seeded targets—harbor, atlas, atelier, loom, synth and material—also passed all TypeScript checks and Vite production builds in temporary directories using the existing compatible dependency versions. The actual ProofGarden staged/revert consequence check passed, and the bundle remained stable throughout verification. The current report records all 13 passing validation groups and the exact 56-file observation at 2026-11-09T10:44:23.199169+00:00. The optional full check also executes current ProofGarden rendering with staged/reverted props: layout, search and empty-state consequences change, and the before view restores the original fixture. This server-rendered check does not establish browser gestures, motion or visual quality. Logs from the initial six-target check are under `output/frontend-study-validation/`. The earlier report is retained as `output/frontend-guidance-validation-65-file-snapshot.json`; the current integrated results and precise observed provenance are in `output/frontend-guidance-validation.json`.

The full verifier makes a local temporary `node_modules` directory with package links and uses Vite's native config loader. Source dependencies are read; build/config output stays in the temporary projects. It neither installs nor edits the source project's package files. The seed helper itself needed no changes: all six starters and recursive import copying already supported the refreshed modules.

A missing/broken install produces a nonzero exit; use `--home /path/to/home` to inspect a different installation without modifying it. The script checks saved artifacts and helper outcomes. It cannot prove that a host has loaded the skill or that a future UI meets the user's taste.


## Independent upstream refresh

An independent session repackaged the global original-study bundle after the 65-file snapshot. At diagnosis, the upstream manifest was a **flat inventory of 56 files**, modified at **2026-11-09T10:30:48.309991+00:00**, and every actual file hash matched it. Its source inventory (all files except standalone `src/base.css`) was SHA-256 `63694bdede54dc8ac55c34cf50861b8ae6c09b1dd43bd4eaa284b07c59228c4a`. This differs from the earlier 65-file inventory `6f7c4c386b41420dff0a44b6e5a4780711a4e1ffbaa2e6c748d5b344df39ded3`.

The compatibility repair preserves that legitimate newer bundle, seed helper, canonical instructions and Claude preference override. It does not restore the old 65 files or force the older wrapper schema. The verifier checks that FORM/source-consequence/identity/no-onboarding guidance and the Claude override remain present, then records exact instruction hashes for future identity comparison. This is preservation evidence, not an automated aesthetic judgment. Inventory provenance lives with the repository validation output rather than requiring every external packager to preserve a custom global schema.

## Saved guidance versus active context

These are reusable instructions and references, not trained model weights. A future Claude session can discover the Claude skill links, and Codex can discover the canonical skills. An already-running session does not automatically gain every changed instruction; it must load the relevant updated entrypoint/reference through its own supported workflow. Do not claim that installation retroactively changed a session's context, guarantees future design quality, or replaced actual source/rendered inspection.

When the brief and authority are already provided, the guidance says to proceed. It does not introduce mandatory onboarding, design approval or a questionnaire. FORM is the preferred direction/repair method; Impeccable remains available for explicit commands and useful technical audits.
