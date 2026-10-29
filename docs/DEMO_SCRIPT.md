# Truthful v3 demo script

The hero recording is three minutes: a financial decision, a genuine conflict, a knowledge-time comparison, actual rejected commands, and legitimate completion. Use 1440 × 900 or larger, legible text, and clear narration. Included counterparties and documents are synthetic.

The existing [v2 release recording](https://github.com/Srujyama/truthful-ovo/releases/tag/v2.0.0) and [v2 Drive recording](https://drive.google.com/file/d/1ckSzoZlqrDPDLqCR5rA66YrvQA5WqZ5J/view) show the earlier Nimbus/evidence workbench. They do **not** demonstrate v3 assurance. The Drive access gate remains unresolved; see [DELIVERY.md](DELIVERY.md) for publication facts owned by the lead.

## Before the take

Run `npm run dev` for the local HTTP/SQLite build, or open the public static app for browser mode. State the mode shown in the runtime banner; do not call GitHub Pages a shared backend. In **Assurance**, choose demo **Admin**, click **Reset demo workspace**, then **Confirm reset**. This restores the fictional seed. It retains server command audit history; browser workspace records are replaced.

Stay on today’s **Effective on** and **Known by** dates before writing. Pipeline begins at $2,400 promised, $900 applied, and $1,500 outstanding. Nimbus has $2,000 issued but not applied. Keep a practiced source revision, an optional follow-up input, and the intended baseline assumptions ready.

## Three-minute hero take

| Time | Actual controls and expected effect | Spoken line |
| --- | --- | --- |
| 0:00–0:15 | Begin in **Portfolio**, Pipeline selected. Show the promise, applied credit, and graph. | “A promised credit is not a saving. Truthful asks what is still owed, which evidence supports it, and whether the next action is still authorized.” |
| 0:15–0:38 | Open **Decision room**. Select Pipeline’s **Accept proposed amendment** row showing negative $900. Point to the economics and competing branches. | “This $1,500 concession requires $2,400 extra annual spend under our explicit baseline. It is $900 worse. It also conflicts with a separate date proposal. Neither silently changes the agreement.” |
| 0:38–1:07 | Enter a reason under **Reason for dismissing an alternative**, such as “Decline the renewal; retain the original commercial agreement.” Click **Dismiss renewal**, then **Review date change**, **Approve exact action**, and **Record approved action**. | “Finance rejects the renewal with a retained reason, then reviews a fresh date-change action. Approval and execution are separate. The accepted schedule still waits for its effective date.” |
| 1:07–1:33 | Return to **Portfolio**. Set **Effective on** to November 2, 2026. Set **Known by** to October 28, then to the date of this take. The same effective date shows the old October 1 due date before acceptance was known, and November 15 afterward. Click **Return to latest**. | “What applied and what we knew are different questions. At the same financial date, the late knowledge changes today’s interpretation without rewriting the earlier view. Historical comparisons are read-only.” |
| 1:33–2:02 | Open **Failure lab**. Select **An approval belongs to one evidence revision**, click **Run case**, and expand **Inspect … executed steps**. Show `STALE_APPROVAL`. | “This case actually approves, changes a source, and tries to execute the old approval. The reducer rejects it. These are executed effects and errors, not canned success messages.” |
| 2:02–2:25 | Select **One credit, one conserved balance**, click **Run case**, and inspect the blocked second allocation. | “The same $900 cannot fund another claim. Credit capacity is shared across the portfolio. The failed command leaves verified value unchanged.” |
| 2:25–2:50 | Expand **Advanced commands against this workspace**. Choose **Apply remaining Pipeline credit**, then **Run command**. Return to **Portfolio** and Pipeline. It is fully applied at $2,400, with no outstanding balance. | “The system also permits valid progress. This atomic batch records a new invoice source, a separate $1,500 credit line, and its allocation. The promise is fulfilled once.” |
| 2:50–3:00 | Click **Export audit packet**. Hold the completed portfolio. | “The sources, revisions, decisions, and local execution record travel together. Consistency you can replay, with the trust boundary stated.” |

This date example assumes the take occurs after October 28 and before the chosen financial comparison date. If recorded later, select a financial date after November 1, keep the early knowledge cutoff before the live acceptance, and set the later cutoff to the acceptance date. Rehearse the actual values. Do not change the service clock or backdate an observation merely to fit the script.

## Engineer appendix

### Shared ledger and reversals

In **Portfolio**, select Nimbus and open **Shared ledger**. The $2,000 memo is issued, so it contributes zero verified value. Expand **Record invoice evidence or a reversal**, keep **Invoice application**, and supply clearly labeled synthetic invoice text identifying the credit/reference. Click **Record application**. The verified portfolio rises from $900 to $2,900 on a clean seed.

For Pipeline, choose **Credit reversal**, enter `300`, add source text, and **Record reversal**. Its verified value falls from $900 to $600 and the outstanding correction becomes $1,800. A full $900 reversal on a clean seed restores the full $2,400 balance. Partial reversals across several claims require explicit allocation attribution through the structured command API; do not imply the UI guesses it.

### Approval freshness in the open workspace

On a clean seed, open Pipeline’s **Preserve original terms** action. Click **Approve exact action**. Return to **Portfolio**, open the original source node in **Evidence graph**, click **Revise this source**, edit the supplied text, and **Save source revision**. Back in **Decision room**, the old action is out of date and offers **Create fresh proposal**, rather than execution.

The Failure lab’s stale-approval scenario additionally sends the prohibited execution command and shows its typed rejection. This distinction matters: a disabled button is useful UX; the reducer is the authority boundary.

### Mandate and roles

Expand **Current mandate**. The demo Admin can change **Claim limit, USD**, **Incremental renewal limit, USD**, and whether to allow new obligations, then **Update mandate**. This invalidates pending approvals. Use **Demo role** to show Analyst, Approver, Executor, and Read only contexts. A prohibited operation must be rejected by the local service/reducer, not merely hidden in the UI. The roles are selectable demo identities, not verified employees.

### Model-independent changed-input proof

Open **Evidence lab**, choose **Partial credit**, click **Load example**, then **Analyze evidence**. It finds $2,400 promised, $900 applied, and $1,500 outstanding. On **Invoice credits**, change only the matching `900.00` to `1000.00` and analyze again: the gap is $1,400. Editing clears the old result until reanalysis.

Use **Wrong reference** to show $0 applied despite a matching amount, or **Changed terms** to retain the existing $900 while flagging the renewal reply. Exact source passages are inspectable. Add to portfolio revalidates original documents and commits all facts atomically; it will reject a changed amount/reference that conflicts with an already tracked vendor invoice. Do not expect that conflicting edited sample to overwrite the seeded Pipeline credit.

A new supported vendor/reference/invoice set can be imported through **Add to portfolio**. Reimporting identical evidence must not duplicate the credit. This adapter has one credit per vendor invoice; the structured API accepts explicit multiple-line identities.

### CLI and service evidence

From the repository root:

```sh
npm run evaluate:assurance
npm run verify:depth
npm run verify:submission
```

The first executes nine synthetic scenarios and thirty-one checks at this checkpoint. It is an authored regression suite, not held-out accuracy or formal verification. The second checks the architecture-answer length and documented evidence-lab amounts against real fixtures; it does not certify the entire assurance UI.

With the optional local service running, authenticated data routes include `/api/workspace`, `/api/events`, `/api/export`, and `/api/verify`. The server export module replays stored commands; browser-only exports have no independent server record. See [server documentation](../server/README.md) and [technical deep dive](TECHNICAL_DEEP_DIVE.md).

The earlier evidence-lab packet CLI remains available:

```sh
node scripts/analyze.mjs --vendor "Pipeline CRM" --promise public/examples/pipeline-promise.txt --invoices public/examples/pipeline-invoices.csv --as-of 2026-10-28 --out /tmp/truthful-evidence-packet.json
node scripts/verify-packet.mjs /tmp/truthful-evidence-packet.json
```

That CLI verifies the evidence-lab packet format. For v3 assurance downloads use `npm run verify:assurance-packet -- /path/to/truthful-assurance-evidence.json`. It replays complete commands and validates the selected projection; server packets additionally verify the persisted audit chain. Neither authenticates supplied sources.

## Recording and access

Use a real product capture, with short pauses on the negative value, the blocked command, and the changed knowledge view. Keep terminals out of the hero recording. Say “local action recorded,” not “email sent” or “renewal executed.” The app performs no external transaction and calls no live LLM.

The form requests a Google Drive, Loom, or unlisted YouTube recording. Verify signed-out playback, readable amounts, audible narration, and the correct v3 recording. A GitHub backup or running website is supplemental. Do not check teammate agreement, attendance, track, or access declarations without the actual facts.
