# Native Figma system review

This pass refines the native file’s editing architecture within the existing Apple/Ramp direction. The starting audit found 697 Auto Layout frames and 13 color variables, but no component sets, instances or shared text styles. Existing Auto Layout and color work was retained.

The build adds real Button and Status sets, linked scene instances, shared text styles, repeated spacing/radius bindings and a native Handoff page. Button wording is editable through Label. Status wording follows State to prevent contradictory financial labels.

Independent source review identified and verified repairs for:

- Pending record metadata overwriting the completed system link.
- Interrupted migrations leaving a duplicate instance on retry.
- Redundant instance overrides blocking inherited variant styling.
- A free Status Label override preserving wording from the previous state.
- A verifier accepting duplicate Button sets instead of requiring Status.
- Document-wide variable counts masking a screen without bindings.
- A Status swap probe that could have tested a no-op.

The full update path is exercised separately from incremental application. It preserves original screen/master IDs, rebuilds scene content, rewires review interactions and reapplies the native system. Clone-only probes check long labels, inherited master treatment, variant changes and the stated resize widths. Original values are restored and temporary proof pages removed.

`native-record.json` is the authoritative reviewed screen/version record. `native-system.json` records the reviewed system IDs and scoped native editing probes. Both are invalidated before owned live mutations. The independent live gates check current types, property references, ancestry, typography, per-screen bindings, clipping, fonts and existing screen/interaction identities. Offline negative fixtures test refusal paths; they do not establish native persistence.

The final visual review and exact exported artifacts are recorded with the native record. Manual prototype-player playback is separate from API-verified reactions and is not claimed by this pass.

The independent eight-export finish pass requested visible Hover differentiation and simpler Handoff headings. Both were applied in one bounded batch and confirmed resolved in the three affected recaptures. See [the scored verdict](SYSTEM_FINISH_REVIEW.md) and [artifact/version record](system-review.json). That earlier component-system milestone passed its live gates and 38 offline checks. The current continuation supersedes its counts below.

The UI continuation additionally repaired recorded-action precedence, role-aware import preflight, exact bound evidence inspection, historical source isolation and native root ownership. Recorded IDs are authoritative; new-note retries require matching owner/source markers, and cross-file fresh-push retries fail before mutation. Thirteen ownership fixtures join the existing target and native gates. The current 17-screen model has 53 mapped interactions, 25 CLOSE returns and 710 editable screen text layers. The app’s import/review/approval/recording journey passed in both browser-local and SQLite modes; retained workflow checks also pass. Current source and visual review have no unresolved P1/P2 findings in their stated scope.

Current verification: 177 application tests, 52 offline design/ownership regressions and both actual native API gates pass. Browser verification covers 167 assertions across static/SQLite finance journeys, retained workflows and an intentional service-failure response. The style detectors retain legacy-token advisories in base styles; the supplied rendered surfaces were reviewed independently.
