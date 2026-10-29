# V3 delivery record · October 29, 2026

- [Live assurance application](https://srujyama.github.io/truthful-ovo/)
- [Public source](https://github.com/Srujyama/truthful-ovo)
- [V3 release](https://github.com/Srujyama/truthful-ovo/releases/tag/v3.0.0)
- [Three-minute narrated MP4](https://github.com/Srujyama/truthful-ovo/releases/download/v3.0.0/truthful-assurance-demo.mp4)
- [Earlier v2 Drive copy](https://drive.google.com/file/d/1ckSzoZlqrDPDLqCR5rA66YrvQA5WqZ5J/view) — earlier workbench recording, owner-only permission observed; unsuitable as the v3 submission recording.

The v3 recording is 181 seconds of actual browser interaction with the local SQLite service, with local system-voice narration. It demonstrates negative renewal economics, retained branch dismissal, precise approval and one-use local execution, effective/knowledge-date replay, actual stale-approval and duplicate-allocation rejections, a valid atomic invoice/source/allocation batch, and final $2,400 applied with zero Pipeline outstanding. Sources and counterparties are synthetic. No external transaction occurs.

The H.264 1440×912 video and AAC audio were checked. Representative frames, including the negative $900 economics and final zero balance, were inspected. The recorder’s unused gray bottom strip was cropped; UI content and behavior were not fabricated. All nine narration segments fit their chapter windows; audio mean −17 dB and peak −1.4 dB. Recording and narration scripts are in `scripts/`; the inspected artifact is `output/demo-v3/truthful-assurance-demo.mp4`.

## Integrated evidence

- `npm run check`: 117 automated tests, 22 authored evidence fixtures, 9 assurance scenarios / 31 assertions, 9 cross-layer acceptance checks, 6 rejected tamper variants, submission-answer consistency, production build.
- The depth verifier checks 843 command-prefix/date projections. Shared seed prefixes recur; these are not 843 independent cases or a real-world accuracy benchmark.
- The same assurance walkthrough passes 25 UI assertions in local-service mode and 25 in static browser mode. Original evidence/Nimbus paths pass 20 more assertions, including edited inputs, exact citations, draft approval/export, reload, keyboard navigation, cancellation, and mobile behavior.
- Actual browser and server assurance exports replay through `verify:assurance-packet`; selected historical projections agree with their recorded source state and server audit.
- Independent engineering review found and repaired future-allocation conservation, invoice reference aliasing, historical History leakage, large-number comparison arithmetic, and inactive historical-reversal fallthrough. Service checks exercise actual HTTP, SQLite restart, concurrent writers, roles, CSRF, batches, and durable idempotency.
- Independent design review scored its two material fixes resolved: graph-path contrast and critical annotation size. Six correct desktop/mobile captures show no horizontal overflow. DESIGN.md and the sidecar record the extension.
- Bounded common credential/private-key pattern scan clean. Runtime SQLite, `.env`, outputs, caches, and private transcripts are excluded from published source.

`node scripts/verify-delivery.mjs` checks public repository visibility, the deployed assurance bundle/examples, and byte equality between the public MP4 and the inspected local recording. Both [Verify Truthful](https://github.com/Srujyama/truthful-ovo/actions/runs/40853438789) and [Deploy demo](https://github.com/Srujyama/truthful-ovo/actions/runs/40853438758) succeeded for source commit `d1481836`. All 45 browser assertions passed on the public Pages app. The published MP4 matches the local artifact byte for byte, and the published server evidence packet replays successfully. [delivery.json](delivery.json) records these facts.

## External submission gates

1. **Accepted-host video:** the form requires a viewable Drive/Loom/unlisted YouTube video. The public GitHub MP4 is a backup. A v3 Drive upload was requested, but no retrievable new file ID was found in connector readback; do not infer a verified upload or shareable link. The observed v2 file is owner-only. The connector can upload/read but can grant only named-user/domain sharing, not anyone-link sharing. A fresh browser-control inventory still reports “The browser access host is unavailable”; earlier native app attempts timed out or conflicted with another active session. A final v3 accepted-host link must be opened signed out before submission.
2. **Runtime AI choice:** no live LLM is connected. No usable OpenAI key was found in the environment/project; the reuse/create/direction question remains unanswered. No key was created, copied, or used. The 260-word answer distinguishes AI-assisted development from deterministic runtime behavior. The form’s AI prompt fit still needs an explicit decision or a validated model path after the credential gate.
3. **Team declarations:** original Round 1 track, November 19 attendance, and actual teammate agreement remain unknown. No organizer email or application was sent and no declaration was invented.

These gates are preserved as open T9. `node scripts/verify-submission-ready.mjs` deliberately fails until the actual facts are recorded. The engineering upgrade is separately verifiable; publication does not establish submission readiness.

Completion audit: `pad finish --timeout 180` was run after T10–T14 passed their acceptance checks. It correctly refused overall plan completion because external T9 is still open; no check was skipped or weakened.
