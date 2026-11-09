# Historical Nomen adaptation milestone

This records the earlier local Nomen-inspired spatial milestone and the checks reported at that time. The user subsequently rejected it as sufficient application design, especially the operational financial screens. Its passing tests, prior reviewer verdicts and captures do not establish current visual acceptance. [UI_OVERHAUL.md](UI_OVERHAUL.md) tracks the replacement operating workspace; [DESIGN.md](../DESIGN.md) records the current system.

The current application opens Follow-ups, with first-class Credits and task-specific record views. The original scene survives as secondary **Office map**. The direction contract and checklist below describe the earlier milestone, including its then-default world; they are preserved as history, not instructions to restore that default. Native Figma expansion and public release remain separate.

## Reference evidence and direction

Inspected the actual Troy source and operated it through an isolated Vite wrapper around `TroyExperience`: paper background, isometric procedural architecture, DOM controls anchored to the world, station inspectors, recorded dispatches, camera fit/zoom and paused replay. The wrapper blocks reference API writes and does not run its worker/providers. Captures: `output/playwright/nomen-reference-world.png`, `nomen-reference-inspector.png`. The repository README's media provides additional state references; source observations and operated behavior are kept distinct.

The useful mechanism is a world that opens onto real work. Truthful turns that into a **financial clearing house**: original archive, civic review hall, credit exchange, verified vault, execution observatory and dispatch office. Buildings have distinct silhouettes and finance props; they do not stand in for unimplemented controls. A conventional ledger remains immediately available, and returning to the world preserves the mounted task surface.

The financial world is original Canvas geometry and code: six models with 719 detailed primitive parts, an isometric projection, baked scene cache, shoreline/path/planting, DOM station controls, illustrative clerks and recorded-event couriers. Nomen's logo, models, media, provider flows and renderer source are not shipped. At the studied snapshot, its README stated no project license had been chosen; credit identifies the interaction reference. Pixelify Sans comes from the Google Fonts repository under its separate OFL license, retained in `public/fonts/pixelify/OFL.txt`. Public Sans remains the reading/form face.

## Reference-led decision and quality bar

The user explicitly selected Nomen and requested its UI mechanisms adapted to this product. That direct instruction supplies the visual direction; no random concept selection, FORM seed, generated comp approval or invented approval record was used. The working reference was inspected in source and operated locally. The chosen quality bar is detailed, distinct architecture with the reference's spatial legibility and anchored controls, plus clearer exact financial destinations, accessible ordinary controls, real managed workflows and preserved dense ledger tasks. Richness must remain coherent across mobile and desktop; bland placeholder buildings, decorative fake progress and a static scene with dead links do not meet this bar.

## Direction contract

**Thesis:** inspect a financial promise as it moves through a small, understandable place; the world gives an overview and the record gives proof.

**First viewport:** paper-colored full workspace, compact identity/account navigation, original town as the dominant content, selected station records beside it, then distinct recoverable/issued/verified balances. Labels are real buttons at the buildings. On narrow screens the camera frames the selected building and a six-station dock sits in normal flow before the readable inspector; it never covers the task.

**Signature interaction:** choosing a building selects its actual records. Choosing a record opens the exact case/action/source revision in the existing working surface. Camera gestures and scenery are reversible/pausable and never write financial events. Only recorded model transitions produce a courier, whose route respects the event's financial meaning; issued attribution never travels to verified storage.

**System:** warm paper `#f6f4ef`, brown-green ink `#303a30`, forest action `#356550`, limestone, timber, terracotta, brass and teal architectural materials. Pixelify Sans carries place names and display amounts; Public Sans carries readable task content. Conventional finance screens inherit the material/type character while preserving their dense controls and exact meanings.

**Behavior:** real managed session-first sign-in, invitation enrollment, workspace switching and current-role controls. Durable intake/source versions, reviewed imports and saved claim drafts/approval/unsent exports use their backend contracts. Managed execution uses selected real actions and durable bounded exploration; browser authority remains explicitly isolated. Errors retain input, empty worlds invent no work, and unavailable exact links never substitute another vendor/source.

## Requirement-to-evidence checklist

| Requirement | Implementation / required evidence |
| --- | --- |
| Adapt actual Nomen spatial mechanism | Original six-building renderer; operated reference and comparative desktop/mobile inspection |
| World reflects truthful finances | `state.mjs` derives from actual projections; tests cover issuance, application, fulfillment, cutoffs, cents and event routes |
| Every station is useful | Archive exact source → library; Review exact action → decision; Credits → actual credit ledger; Verified → fulfilled history/report; Execution → selected approved action; Dispatch → prioritized work |
| Existing detailed workflows retained | Same shared `useAssurance` service and existing forms; world toggle keeps task mounted; complete financial browser journey rerun |
| Accounts are real in managed mode | Session-first hook, account dialog, invitations/workspace switching/password/logout; no managed error/sign-out fallback to fictional records |
| Durable evidence and recovery UI | Exact saved analysis versions, typed import preview/commit, draft/version/role approval, version-bound unsent exports and interrupted-read recovery |
| Actual selected execution | Dynamic action/commitment/source selection, real amount/obligation limits, durable managed exploration/replay, isolated browser mode |
| Routing is exact | World/ledger and case/action/source URL state; back/forward; absent requested records show unavailable state |
| Mobile/accessibility | DOM station dock, keyboard/focus, real modal dialogs, no overflow, readable inspector, reduced motion and normal-motion reverse/pause gestures |
| Finished quality | Independent functional review repairs, fresh visual finish review, rendered desktop/mobile evidence, integrated checks and documented shipped design |

## Material integration review repairs

- Exact source props now update library state, include bound earlier revisions and explicitly report unavailable references.
- Approved-action station links carry the real action and commitment through URL state into signed authority.
- Credit exchange opens the vendor credit-ledger tab; approved work is described as an open action rather than an undecided approval.
- World balances use the same current-day cutoffs as the detailed ledger and retain cents; managed evidence is no longer labeled browser-local.
- Protected deep links show managed sign-in/workspace selection gates instead of mounting unauthorized data reads or spinning forever.
- Claim exports bind the exact viewed draft version. A later edit cannot silently change downloaded text under an old approval.
- A successful intake adopts its saved identity before a follow-up read; interrupted refresh cannot turn the same sources into a second archive case.
- Future evidence shows the same approval restriction as the backend.

Additional finish repairs: active-time courier/scenery clocks preserve pause and background continuity; the map instruction uses an opaque paper backing and darker ink; footer copy has stronger contrast. A newly saved evidence version immediately marks an open earlier claim stale even if its detail refresh fails.

## Historical verification record

- `npm run check`: integrated automated regressions, fixture evaluation, submission/depth/frontier checks and production build. The scene-clock regression brings the automated suite to 353 tests.
- `npm run test:clearing-house:browser`: 39 real Chrome outcomes against a fresh production build and managed SQLite workspace. Actual UI sign-in, invitation enrollment for separate analyst/approver accounts, interrupted-read recovery without duplicate evidence, reviewed import, exact source navigation, saved claim approval/download/edit invalidation, workspace isolation, selected signed action, retained signing key, one-effect retry and durable explorer replay all pass.
- `npm run verify:clearing-house`: independently replays the exported financial audit, exact source-backed USD350 promise with zero verified applied value, separate claim approval and citations, exact unsent EML, later draft approval invalidation, and exactly one delegated financial effect despite retry. It also requires the named gesture/courier/reduced-motion outcomes and desktop/mobile PNGs.
- Existing complete finance journey: 29 Chrome outcomes still pass, through issued memo → invoice application → amended promise → conserved attribution → USD400 fully verified fulfillment. `node scripts/verify-backend-evidence.mjs` independently reproduces that record and distinct approver/executor handoff.
- Seven additional operated checks verify browser back/forward, credit-ledger destination, mobile world/ledger overflow, account Escape behavior and unavailable exact case/source paths.
- Fresh independent finish review identified courier timing, footer/instruction contrast and stale design documentation. Repairs were recaptured and confirmed. Source integration reviews also repaired exact destinations, cutoff/cents consistency, managed access gating and version-bound exports. `DESIGN.md` and sidecars now describe the actual clearing house.

Rendered evidence is retained in `output/playwright/`: `clearing-review-desktop.png`, `clearing-review-mobile.png`, `clearing-ledger-desktop.png`, `clearing-ledger-mobile.png`, `clearing-account-mobile.png`, `clearing-managed-claim-desktop.png`, `clearing-managed-execution-desktop.png` and final managed-world captures. The README keeps a portable scene capture at `docs/clearing-house.png`.

Normal motion was operated: zoom reversal, reversed drag, pointer cancellation, actual-building hit, scenery pause and actual recorded-courier pause/resume. Reduced-motion mode is still and retains six DOM station controls. The automated Chrome environment kept `document.hidden=false` when another tab was brought forward, so **actual browser background visibility was not established**. The same active-time clock used by the scene has a regression proving suspension excludes elapsed background/paused time; this is source-level timing evidence, not a browser-background claim.

At that checkpoint, the local website and repository milestone was reported complete; the user later rejected it as sufficient UI design. This is not a completion claim for the current overhaul. Public hosting and native Figma persistence remained separate prior delivery targets; no external vendor, mail, payment or live model was connected. The retained Figma source/native status is documented in `WORKSPACE_EXPANSION.md`.
