# Round 2 form: verified requirements

Inspected **October 28, 2026**, read-only. Source: [BBS × Ramp Round 2 submission form](https://docs.google.com/forms/d/e/1FAIpQLSc1EeEuNDXVaiyJqjBFQK__b_oLcfZ4g6t5hpGkZI0s_AC_8A/viewform), reached from the organizers’ [short link](https://forms.gle/FxUVTm6Z75f121ov5).

The web reader could not open the short link. A plain HTTP GET followed its redirect, and the public Google Forms `FB_PUBLIC_LOAD_DATA_` payload exposed the form’s sections, field metadata, routing choices, and required flags. No answer was entered, no confirmation was checked, and no form was submitted.

The deadline is **November 10 at 11:59 PM PT**. The supplied organizer email establishes the year as 2026. The live final is the evening of **November 19 at Ramp’s San Francisco office**.

The prompt asks teams to automate an outdated financial workflow with the newest AI tools. A working financial parser alone must not be described as a live AI runtime.

## Page and field map

| Page | Field | Required | Evidence / constraint |
| --- | --- | --- | --- |
| 1 | Respondent email | Yes | Initial form screen collects email with the response. |
| 2 | Team name | Yes | OVO is the team named in the invitation. |
| 2 | Member 1 name and email | Yes | Enter the actual submitting team member. |
| 2 | Member 2 name and email | No | Include the teammate’s correct details if participating. |
| 2 | Member 3 name and email | No | Optional third member. |
| 2 | Previously selected submission track | Yes | Branches to technical build or product design. Verify against Round 1; the current invitation does not identify the selected track. |
| 3, technical | Project name | Yes | Product name may differ from the team name. |
| 3, technical | GitHub repository URL | Yes | Form explicitly requires a public repository. |
| 3, technical | Demo recording URL | Yes | Google Drive, Loom, or unlisted YouTube; anyone with the link must be able to view it. |
| 3, technical | Architecture / approach / tradeoffs answer | Yes | 200–300 words, including tools/models and what would change with more time. |
| 3, technical | Repository access and key-free confirmation | Yes | Verify the actual published repository before checking. |
| 3, design | Project name | Yes | Alternate branch, not an extra technical deliverable. |
| 3, design | Mockup URL | Yes | Figma or equivalent. |
| 3, design | Product brief URL | Yes | Google Doc or PDF covering implementation and roadmap. |
| 5 | In-person final attendance | Yes | Yes/no; the team must supply the true answer. |
| 5 | Four team confirmations | Yes | All four are required; see below. |
| 5 | Additional context | No | Optional free text. |

The four required confirmations concern teammate agreement, a single team submission, organizer permission to contact team members, and sign-in-free access to supplemental materials. These are team statements, not engineering checks the build process can infer.

## Submission access checks

- Open the public GitHub URL without authentication. Confirm it is the intended repository and that its latest reviewed source contains no API keys or private session transcripts.
- Open the final video URL signed out. Confirm it plays the correct video with audible narration and readable figures.
- A localhost URL cannot be viewed by judges. A private hosted Site may be useful to the owner but does not satisfy the form’s sign-in-free supplemental-access confirmation.
- Confirm the Round 1 track and the final name. No original Round 1 response receipt was found in the available Gmail search; it may be in the teammate’s inbox.
- Confirm November 19 attendance and team participation with the team before submitting.

## Research source record

Official sources were checked on October 28, 2026:

| Source | What it supports | What it does not establish |
| --- | --- | --- |
| [Ramp vendor-credit documentation](https://support.ramp.com/vendor-credits-credit-memos-on-ramp-bill-pay/) | Ramp already records vendor credits and applies them to bills, including partial applications. | That every required credit-application detail is available through the public API. |
| [Ramp Applied AI Solutions](https://ramp.com/applied-ai-solutions) | Existing contract-to-invoice reconciliation and source-cited policy interpretation. | That Truthful invents these categories or has an integration with that service. |
| [Ramp authorization reference](https://docs.ramp.com/developer-api/v1/scopes) | Official search-indexed documentation lists a read scope for bills. | Account eligibility, exact data completeness, or a working connector. The direct page is JavaScript-rendered, and its suggested machine-readable guide returned HTTP 403 during this check. |
| [Ramp agent payments](https://docs.ramp.com/developer-api/v1/agent-payments) | Official search-indexed documentation describes agent purchasing under connected user permissions. | A live agent/payment integration in Truthful. Direct text-guide access also returned HTTP 403 during this check. |

Do not copy Ramp’s usage statistics or security guarantees into Truthful’s claims. They describe Ramp’s offering, not this prototype.
