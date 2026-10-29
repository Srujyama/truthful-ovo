# Delivery record · October 29, 2026

- [Live application](https://srujyama.github.io/truthful-ovo/)
- [Public GitHub repository](https://github.com/Srujyama/truthful-ovo)
- [Narrated recording: public MP4 download](https://github.com/Srujyama/truthful-ovo/releases/download/v2.0.0/truthful-demo.mp4)
- [Release and recording](https://github.com/Srujyama/truthful-ovo/releases/tag/v2.0.0)
- [Google Drive recording](https://drive.google.com/file/d/1ckSzoZlqrDPDLqCR5rA66YrvQA5WqZ5J/view) — uploaded, public-link access **not verified**.

The 2:08 recording captures the actual browser product at1440×1000, with generated local system-voice narration (Samantha). It shows the Nimbus SLA case, human approval, the renewal counteroffer, issuance versus application, then changed-input reconciliation from$900 to$1,000 applied and$1,500 to$1,400 outstanding. Video frames were inspected and its H.264 video/AAC audio streams verified. The public GitHub MP4 is a backup: the form specifically names Drive, Loom, or unlisted YouTube.

## Verification evidence

- `npm run check`:57 automated tests;22 authored synthetic evaluation cases; submission/demo consistency; production build.
- GitHub Verify Truthful and Deploy demo workflows succeeded for the published build.
-20 browser assertions passed against the deployed app, including the complete claim lifecycle, edited-input recalculation, wrong-reference exclusion, exact citations, edited-draft approval/export, reload persistence, keyboard tabs, unsupported/future claim blocking, delayed-analysis cancellation, and mobile layout/navigation.
- Exported evidence packet verified through the standalone CLI.
- Independent implementation review findings repaired. Design reviewer scored all five material fixes resolved. DESIGN.md and its sidecar reflect the shipped extension.
- Staged source checked for common API-token/private-key patterns and excluded private transcripts, environment files, caches and generated local data. This is a bounded check, not a claim of exhaustive security certification.

## External decisions before submission

1. **Video access:** enable Anyone with the link / Viewer on the Drive recording and verify playback signed out. Connected Drive tools can upload and inspect this file but cannot set an anyone permission. Native browser access was interrupted by another active session; the browser host was unavailable and a separate app attempt timed out. No other session was stopped or reconfigured.
2. **AI direction:** the runtime currently uses supported rules, not a live model. No usable OpenAI key was found in the environment/project. The requested reuse-versus-create decision is pending; no key was created, copied, or used. The form asks for newest AI tools, so the architecture answer accurately distinguishes AI-assisted development from runtime AI.
3. **Team facts:** confirm the track selected in Round1, November19 attendance, and actual teammate agreement before checking the form declarations.

No application was submitted, no organizer email was sent, and no consent or attendance answer was invented. The copy-ready text is in [SUBMISSION.md](SUBMISSION.md). The remaining external state is tracked in [delivery.json](delivery.json); `node scripts/verify-submission-ready.mjs` deliberately fails until those facts are resolved.
