# Truthful · Team OVO

**Did the credit they promised actually reach your invoice?**

Truthful keeps the promise, original documents, credit note and invoice together. Open a company conversation to see what happened and the next decision. Changed terms stay separate from accepted agreements; an issued note stays separate from an invoice deduction. Built for the BBS × Ramp technical round.

[Development status](docs/DEVELOPMENT.md) · [Backend](docs/BACKEND.md) · [Technical deep dive](docs/TECHNICAL_DEEP_DIVE.md)

The current v4 candidate opens **Team**: five named software teammates pass an actual case between their workstations. Choose a figure, inspect the exact document behind its finding, or open the real review, credit or case. Playback is explicitly a saved-case walkthrough; approval and recording remain real, separate financial actions. **Cases**, **Documents**, **Companies** and **Reports** remain primary destinations in the same open visual system. **More** retains History, Developer tools, the earlier Office map and examples. [The team design record](docs/TEAM_DESIGN.md) tracks the current implementation and review after the user rejected the previous styling; prior passing checks did not establish visual approval.

## Run

Node 24 or later:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The supervisor starts Vite and a loopback HTTP/SQLite demo service; its data stays in ignored `server/data/`. No API key or external account is required. The account menu identifies the active runtime.

`npm run dev:web` runs the browser-only demo with localStorage and selectable fictional roles. For real local accounts and isolated empty workspaces, follow [managed account bootstrap](docs/BACKEND.md#run), then run `npm run backend`. Managed mode supports sign-in, invitation enrollment and workspace switching; demo role selection remains demo-only.

## Try the work

- **Team:** watch Mina, Oren, Ada, Jules and Nell work through the saved case. Pause, reverse or scrub a handoff; inspect a teammate or its exact source. On phones, selected teammates open an accessible action sheet. Choose a different company or check the current case without inventing financial changes.

- **Pipeline CRM:** a $2,400 promise, $900 on the invoice and $1,500 still missing. Compare the proposed renewal: $2,400 extra spending for $1,500 credit means $900 more cost against the stated baseline. Decline the renewal with a recorded reason or keep the existing terms. A separate approver and executor can finish the decision; that decision does not invent invoice credit. Proposals do not change the original agreement until exact approval and execution.
- **Nimbus Cloud:** a $2,000 credit note exists, but a matching invoice must confirm the deduction. Open the note, add supplied invoice evidence, preview the change and record it. Partial assignment and reversal preserve the original note and exact backing.
- **Add documents:** analyze supported promise text, invoice-credit CSV and an optional reply. Inspect exact source passages, review an import, edit a draft and approve its exact version for an unsent EML export with the exact original documents attached. New intake keeps unfinished work separate from saved reviews; returning restores the exact unsaved source or message. Unsupported or conditional evidence requires review.
- **Developer tools:** run bounded competing-action comparisons, inspect unsafe reference traces and the guarded reducer’s rejection, then export/replay the result. Permissions demonstrates exact-action Ed25519 grants, narrower delegation, atomic one-use execution and retry.

The [development guide](docs/DEVELOPMENT.md) retains detailed journey entrypoints, comparison cases, verification commands and proof limits. [Backend acceptance coverage](docs/BACKEND_ACCEPTANCE.md) maps managed evidence, durable drafts, execution reports, concurrency and recovery to earlier HTTP/browser evidence. The lead’s current integrated verification belongs to the correspondence record; historical counts are not the result of this redesign.

## Verify

```sh
npm run check
npm run test:workspace:all
npm run verify:workspace-redesign
npm run verify:team
```

Verification requires Python 3 for the independent standard-library MIME parser. The browser runner uses isolated temporary services and the Playwright CLI. The companion verifier replays actual downloads. [Development instructions](docs/DEVELOPMENT.md#verification-and-replay) include standalone packet and authority verifiers. Tests establish specified deterministic behavior, not held-out extraction accuracy or global formal verification.

React 19, Vite 7, plain CSS, integer-cent financial/evidence engines and Node 24 HTTP/SQLite/crypto. Server sessions enforce local roles; optimistic revisions, idempotency and atomic batches preserve shared records. Hash-linked replay establishes internal consistency. Offline signed packets require a separately pinned public trust root; neither hashes nor a bundled public key authenticate vendor evidence or prove external settlement.

**No live LLM, inbox, Ramp account, vendor, payment or accounting system is connected.** No emails, renewals or payments are performed. All included vendors and documents are synthetic; USD and supported contract shapes have explicit bounds. The custom authority profile makes no AP2/UCP/MCP/A2A or IETF-draft conformance claim. [Research](docs/FRONTIER_RESEARCH.md) and [source-backed comparison](docs/COMPETITIVE_RESEARCH.md) state the argument and limits without a first-of-its-kind claim.

The public GitHub Pages deployment remains the earlier v3 release. Current Office and paper-summary artwork are original application illustrations; a paper summary is not an original invoice. Archivo/Martian font files retain their [OFL notices](public/fonts/). [DESIGN.md](DESIGN.md) records the current candidate and reference boundaries.

## Design and submission artifacts

The earlier [Figma source kit](design/figma/README.md) contains 69 screen models, 14 boards and 483 mapped interactions. The [native file](https://www.figma.com/design/8j4pwtsGDI4seljHPNeUkI) retains its previously verified 17-screen baseline. Saving the expansion remains blocked by editable file access and a connected FigCli bridge; neither artifact establishes parity with this rebuild. See [the expansion record](docs/WORKSPACE_EXPANSION.md).

Videos and submission packaging remain deferred. [The architecture answer](docs/SUBMISSION.md), [demo script](docs/DEMO_SCRIPT.md), [form requirements](docs/FORM_REQUIREMENTS.md) and [delivery facts](docs/DELIVERY.md) preserve prepared materials. Public source, an accepted-host recording, team consent, original track and attendance remain external submission facts; the application has not been submitted.

MIT license. Included source examples are synthetic.

The connected review-to-message regression is `npm run test:product:browser`, followed by `npm run verify:product`. It operates a real decline, separate approval/recording, case return, two independent analyses, retained edits and an exact approved unsent email. Export verification independently replays financial commands and parses MIME attachment bytes.
