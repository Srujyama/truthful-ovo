# Finance workspace and design expansion

The November 7 Pacific / November 8 UTC continuation expands the working application and prepares a much larger editable Figma source kit. It preserves the Apple/Ramp-inspired neutral working-ledger system and the existing financial, evidence, exploration and authority capabilities.

## Delivered application journeys

| Destination | Working behavior | Evidence |
| --- | --- | --- |
| Operations | One prioritized item per commitment; deadlines, incompatible terms, stale authority, unused capacity and unmatched physical credits; exact selected case/action links | Real browser opens Nimbus’s deadline review and Pipeline’s conflicting action; filters recover from empty results; unmatched credit opens the correct vendor ledger; consumed assignment caps do not produce another attribution task |
| Vendors | Searchable directory, conserved vendor aggregates, commitment/credit/source detail and case links | Physical $900 Pipeline line remains distinct from attribution; vendor → source navigation retains the exact source revision |
| Evidence library | Vendor/kind/search/revision filters, independent knowledge cutoff, exact text, recorded usages and source-text export | Bound Pipeline revision 6 remains inspectable; an earlier knowledge date removes later passages; newer revisions do not substitute for old bindings |
| Workspace activity | Actor/type/vendor/date filters, exact observed/effective times, payload and command identity, case history links | Real event inspection and projection tests trace ledger/source/reversal records to their actual case/vendor |
| Financial reports | Independent financial and knowledge cutoffs, vendor reconciliation, distinct contingent/issued/applied/attributed measures, exact-cent CSV and real audit-packet download | Actual downloaded CSV is recomputed from its exported workspace; historical report excludes application evidence not yet known |
| Credit resolution | Analyst records clarification; approver chooses exact revision and explicit candidate limits; analyst attributes within those limits | Role handoff, over-cap refusal, permanent stale-preview invalidation, no invented attribution, legitimate fulfillment and reload verified in both runtimes |
| Completed case | Inspection/history is the primary next action; previous action records remain accessible | Browser verifies a fully applied promise does not prompt another original claim proposal |

These are connected views of the actual shared reducer state. No inbox, issuer, model, payment system, or vendor connector is fabricated. Browser-local mode remains localStorage-backed; server mode uses the existing loopback SQLite boundary and selectable demo roles.

The audit export includes the full recorded workspace plus the selected projection. The UI explicitly warns that exported history can contain evidence outside that projection’s knowledge cutoff. Reports do not establish source completeness, issuer truth, settlement finality, or realized customer savings.

## Design expansion

The source kit now has **69 screens: 55 desktop and 14 mobile**, retaining the original 17 and adding 52 distinct states. It contains **14 product boards**, the existing 12 component masters/two sets/13 named colors, and **483 declared review interactions**.

New flows cover operations priority/blocked states, vendor records, physical credit, exact source revisions, activity, current/historical/export reports, empty/issued/applied/attributed/reversed credits, duplicate/role/history restrictions, ambiguity clarification and review, amended terms, renewal-only policy refusal, exact approval/execution and mobile equivalents. Case-specific source and approval screens prevent Northstar/Nimbus links from silently opening Pipeline. Operations is reachable from the retained desktop screens and mobile menu; navigation returns across the combined kit.

Seven new boards explain the work architecture, conserved fulfillment, amendment authority, resolution handoff, exception coverage, responsive behavior, and implementation/trust boundaries. They are structured journey/state guidance, not empty title pages.

The entire generated gallery was rendered and compared against expected model text: all 69 screens and 14 boards are present, with no clipped text, missing content/actions/fonts, or frame overflow. Independent visual review inspected representative desktop/mobile scenes. Mobile resolution-heading and retained mobile approval-boundary clipping were repaired. Final navigation was actually clicked in the gallery. Thirteen small text-range overhangs remain nonclipped measurement advisories; they are not hidden text or native geometry certification.

## Native persistence: exact remaining blocker

The expansion **has not been applied to the native Figma file**. Figma Desktop reports plugins “Unavailable in view-only,” and the CLI returns “Not connected to Figma.” The recorded prior native baseline contains 17 screens and 53 interactions at cloud version `2416032624820026877`. That baseline is preserved; no new native version, instance propagation result, or current native export is claimed.

The migration is concrete and ready in [expansion-manifest.json](../design/figma/expansion-manifest.json). It declares 60 exact new roots: 52 screens, seven boards and one mobile navigation overlay. It binds the file key, prior root inventory, complete models and individual new-root hashes. Regression checks reject wrong files, deleted original roots, changed IDs, undeclared/model-changed roots, foreign collisions, and stale/reordered proof. New boards go to Read me; screens/overlays go to Product flow. Variable-height placement preserves original geometry. A failed new clone is cleaned up without deleting its staged source. Native reads and large manifests are chunked rather than trusting clipped CLI output.

Required external action: open the existing [Truthful · OVO · Product design file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) with editing access in Figma Desktop and run **Plugins → Development → FigCli**. If its development plugin must be restored, the existing toolkit manifest is `~/Downloads/Coding/claude-tools/figma-cli/plugin/manifest.json`.

Once connected, run:

```sh
node scripts/update-figma-kit.mjs --expansion-manifest design/figma/expansion-manifest.json
```

Then inspect actual native exports, save a named native version and restore verification only after independent review; run `npm run design:verify-native` and `npm run design:verify-system`. Those gates currently fail as intended against the prior mapped-link inventory/disconnected bridge. A passing local source check has not been substituted for native persistence.

## Verification and repairs

- Application: `npm run check` runs the complete automated suite, authored evidence/scenario evaluations, financial replay/frontier verifiers and production build. The current suite has 223 tests.
- Source design: `npm run design:check` validates the complete kit and 67 safety/native-verifier regression fixtures.
- Rendered journeys: 38 new assertions per SQLite/static runtime, 27 retained assurance assertions per runtime, and two assignment-cap navigation assertions per runtime: **134 browser assertions**.
- `npm run verify:workspace-expansion` independently replays four real UI-exported packets, compares actual downloaded CSVs against exact projections, verifies role-separated source/assignment events and conserved credit, and checks rendered gallery/native-migration evidence.
- Independent reviews repaired stale external case selection after import, unmatched-credit tab routing, backdated assignment-cap contradictions, resurrected previews, cross-case prototype links, wrong breadcrumbs, source quote wording, new-root retry cleanup, board row geometry and fulfilled-case instructions.
- Desktop/mobile/intermediate application screenshots were inspected. Active navigation/tab DOM states were asserted and captures settled before review. The design detector reports advisories only; the new UI files have no devibe findings. Existing legacy token/ramp advisories are not represented as resolved.

All local browser logs, packets, CSVs and captures are under ignored `output/`. `scripts/browser-workspace-expansion-check.js` exercises the full connected journey; `scripts/browser-workspace-cap-check.js` verifies the post-resolution queue. Run the retained assurance check separately in both runtimes, preserving the workspace packets/CSVs before it resets the synthetic demo. `scripts/browser-figma-expansion-check.js` is a separate static-gallery audit; it never establishes native persistence.

No video, external form submission, public deployment, new account declarations, or external financial action is part of this milestone. Source is delivered on the existing development branch; the prior public release retains its recorded scope.
