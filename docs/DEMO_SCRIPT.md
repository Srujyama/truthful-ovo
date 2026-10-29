# Truthful demo script

The technical submission should show both the recovery story and a result that changes with new input. Use a 1440 × 900 browser window and clear audio. All included examples are fictional.

Before recording: start on **Evidence lab**. Open **Guided demo**, use **Reset** if necessary, and confirm Nimbus begins at Watching with $900 verified savings. Return to **Evidence lab**. Close drawers and saved cases. In a practice take, rehearse changing the one matching CSV amount from `900.00` to `1000.00` without touching other rows.

## Two-minute primary take

| Time | Screen action | Spoken line |
| --- | --- | --- |
| 0:00–0:08 | Begin on Evidence lab. Click **Guided demo**. | “A promised credit is not a saving. Truthful connects what a vendor said to what actually reached the invoice.” |
| 0:08–0:24 | On Nimbus, click **Trigger outage**. Point to the calculation and source buttons. | “This prepared example has nine covered hours of downtime. The contract’s 25% tier makes it a $2,000 claim. Every input has evidence.” |
| 0:24–0:39 | Click **Review claim**, then **Approve claim**. | “A person reviews the claim. Approval stays local in this prototype; no email is sent.” |
| 0:39–0:53 | Click **Receive reply**. Pause on the condition. Click **Keep original terms**. | “The vendor adds a year-long renewal. That new obligation stays separate. We preserve the original claim without accepting it.” |
| 0:53–1:10 | Click **Issue credit**; point to verified savings staying $900. Click **Apply credit**. | “A credit memo still is not an applied saving. Only when the credit reaches the next invoice does the verified total move from $900 to $2,900.” |
| 1:10–1:30 | Click **Evidence lab** in the sidebar. Choose **Partial credit**, click **Load example**, then **Analyze evidence**. | “Now the processing path: supplied promise text and invoice-credit rows. It finds $2,400 promised, $900 applied, and $1,500 missing, using an exact commitment reference.” |
| 1:30–1:48 | Click **Invoice credits**. Change only the matching `900.00` to `1000.00`. Click **Analyze evidence**. | “This is not a fixed replay. Change the input to $1,000 and rerun: the gap becomes $1,400. Editing the source clears the old result until we analyze again.” |
| 1:48–2:00 | Open an evidence citation; click **Export evidence**. | “The exact source passage and local audit record travel with the result. Supported-format rules, real calculations, and proof you can inspect.” |

This narration deliberately identifies the Nimbus story as prepared and the workbench as supported-format processing. Do not describe either as live AI, live ingestion, or an autonomous vendor negotiation.

## Extended technical proof — 60 to 90 seconds

Start in Evidence lab. Each example must be loaded and then analyzed; selecting the dropdown alone does not change the current documents.

1. Load **Wrong reference** and click **Analyze evidence**. The promised amount is still $2,400, but applied is $0. “The amount fits; the reference does not. Equal amounts are not proof.”
2. Load **Changed terms** and analyze. The reply adds a renewal condition. The original $900 invoice credit remains applied; no additional savings appear. Open **Vendor reply** to inspect the input.
3. Load **Partial credit** and analyze again. Open **Claim draft**, edit the wording, and click **Approve claim**. The exact approved text is recorded, and editing is locked for that record.
4. Click **Download draft**. It produces an unsent `.eml` file. The app does not send it. Open **Audit trail** to show the linked local events.
5. Click **Export evidence** for full JSON, or **CSV** for a monetary summary. Use **Saved cases** to reopen a prior record after reload. Up to thirty analyzed cases are retained in that browser.

The local audit hashes detect inconsistencies relative to the recorded chain. They do not authenticate the vendor, reviewer, or invoice. A user controlling the browser can construct a new record.

## Engineer appendix: reproduce without the interface

From the repository root, with Node 24 or later:

```sh
node scripts/analyze.mjs --vendor "Pipeline CRM" --promise public/examples/pipeline-promise.txt --invoices public/examples/pipeline-invoices.csv --as-of 2026-10-28 --out /tmp/truthful-evidence-packet.json
node scripts/verify-packet.mjs /tmp/truthful-evidence-packet.json
npm run verify:submission
```

The first command runs the same evidence engine and creates an analysis packet. The second checks its source/report/audit hash consistency. The submission check asserts the documented sample amounts, changed-input result, conditional-reply behavior, citation integrity, and architecture word limit. It does not establish vendor authenticity or real-world extraction accuracy.

## Recording and access

Use actual product controls, with short pauses for the condition and the changed number. Keep browser developer tools, notifications, and terminals out of the main take. Record the optional CLI proof separately if needed.

The form requests a Google Drive, Loom, or unlisted YouTube recording. After uploading, open the final link signed out: the correct video must play without a permission request or login, with audible narration and readable figures. A private Site URL does not replace that recording.

## Live-final recovery

Keep the built app and local sample files available. The guided scenario’s **Reset** does not clear the lab’s saved cases. **Clear saved cases** removes those browser records; export an open case first if you need it. Network failure does not prevent locally served processing once the app and examples are available. No inbox, payments, or external messages are connected.
