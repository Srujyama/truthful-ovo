# Truthful: questions from engineers

## What is the actual problem?

A vendor commitment can sit in a conversation while the invoice lives elsewhere. The operator has to remember the terms, detect partial fulfillment, chase the gap, and confirm the outcome. Our prototype puts those decisions and their evidence in one workflow. We have not measured how often customers lose these concessions or the market-wide dollar value.

## Doesn’t Ramp already handle vendor credits?

Yes. Ramp already supports creating and applying vendor credits, and its Applied AI offering advertises contract-to-invoice reconciliation. We are demonstrating a focused extension: preserve a promise before a formal memo exists, carry its conditions and approval boundary forward, and distinguish a negotiated concession from its actual fulfillment. We do not claim that credit reconciliation is a new category. See [Ramp’s vendor-credit documentation](https://support.ramp.com/vendor-credits-credit-memos-on-ramp-bill-pay/) and [Applied AI Solutions](https://ramp.com/applied-ai-solutions).

## Where is the AI?

The financial runtime is deterministic. The prepared Nimbus case and the supported-format evidence lab do not call a live language model. AI-assisted development is different from runtime AI, and we label that honestly. A model extraction layer is a proposed extension, not a current capability. If the final build adds one, show the exact provider/model path, output schema, citation checks, failure behavior, and evaluation before changing this answer.

## Why not put an LLM in charge of the whole workflow?

A fluent answer is insufficient evidence that a credit reached an invoice. Extraction can be probabilistic, but reconciliation, monetary arithmetic, state transitions, and action approval should be independently checkable. A future model can propose structured terms; the core should reject unsupported values and invalid references before changing a financial result.

## What is real versus simulated?

Nimbus, Pipeline, Orbit, and Parcel are synthetic. Nimbus’s incident, vendor responses, and invoice arrivals are controlled replay events. Its arithmetic and state transitions are executed. The evidence lab processes supplied text and a positive applied-credit CSV using a documented supported format. Exact citation offsets are UTF-16 string indices, not byte offsets. No inbox, Ramp account, vendor endpoint, payment service, or live LLM is connected.

## How do you know a credit belongs to this promise?

The evidence lab accepts a positive applied-credit ledger and requires matching normalized vendor, USD currency, and exact commitment reference. It is not an arbitrary gross-invoice parser. A similar amount alone is insufficient. A source citation explains the extracted promise, and matched invoice rows support the applied total. This relies on the provided data being authentic; the prototype does not verify the issuer’s identity or prove that an imported invoice is genuine.

## What if two rows look the same?

Duplicate evidence must not inflate savings. Identical repeated rows with the same invoice ID count once. Different rows sharing an invoice ID are treated as conflicting evidence and require correction. The supported ledger uses one credit row per invoice. This is a bounded deduplication policy, not full accounting-system idempotency.

## What if the vendor adds a condition?

The reply does not silently amend the original commitment. A renewal condition needs a separate decision. It creates no additional applied savings. In the Nimbus replay, preserving the original terms keeps the claim open; issuance still waits for invoice application.

## What if only part arrives?

Keep the original promised amount and subtract only matched applied credits. Pipeline begins with $2,400 promised, $900 applied, and $1,500 outstanding. Partial fulfillment remains open. The operator can inspect the original email and supporting invoice.

## Why integer cents?

The generalized evidence engine uses integer cents to avoid binary floating-point accumulation in credit totals. The original SLA helper rounds a rate calculation to cents and has separate boundary tests. We do not claim support for every currency, exchange rates, or arbitrary tax treatment.

## What happens when extraction is ambiguous?

It asks for review or reports unsupported input. It must not invent a date, currency, reference, or amount. The scope is deliberately narrower than arbitrary document understanding. Demonstrate an unsupported example and inspect the warnings rather than describing every rejection as a successful extraction.

## Can a document prompt the app to send money or accept a renewal?

The current processor has no execution or outbound payment tool. Source text is data, not an instruction channel. Approval records only the exact reviewed draft; downloading its `.eml` file does not send it. That reduces this prototype’s action surface; it does not establish that a future LLM connector would be immune to prompt injection. Such a connector needs isolation, constrained output, citations, and explicit authorization at the action boundary.

## Is the audit log tamper-proof?

No. The report snapshot and local approval events are SHA-256 hash-linked. The exported packet includes the original documents and exact approved draft; the verifier detects changes relative to that chain. A user controlling the browser can recompute a new chain. It does not authenticate the vendor, invoice, reviewer, or timestamp. Up to thirty cases persist in localStorage, with no account authentication. Production needs server-enforced actor identity and an independently protected event store.

## Why no backend?

For this scope, browser-local processing makes setup repeatable and avoids sending supplied evidence to an external processor. It also means no multi-user coordination, independent authentication, managed backups, or authoritative ledger. Those are explicit production gaps, not features hidden by the interface.

## How is it tested?

Separate financial/state-transition tests from the engine’s extraction and reconciliation tests. Show the actual command output. The included scenarios and adversarial examples are authored regression fixtures. Passing them does not establish real-world extraction accuracy, customer savings, or generalization to unseen contracts.

## What would you validate with a real finance team?

Start with permissioned historical cases. Ask an operator to label the original commitment, conditions, due date, correct invoice application, and final disposition. Hold out independently reviewed cases before tuning extraction. Measure precision of surfaced recoveries, unsupported-input rate, false applied-credit matches, time spent reviewing, and incremental credits actually applied. Keep vendor concessions separate from ordinary contract discounts and avoid double-counting savings already identified by existing tools.

## How would Ramp integration work?

Begin with a consented, read-only adapter for supported bill/vendor data and separately authorized source access. Keep approval and reconciliation in our domain layer. Verify the available endpoints, scopes, account access, and credit-application records before writing an adapter. Ramp’s authorization documentation lists `bills:read`; that is a possible starting point, not proof that every required field is exposed. No such adapter is implemented here. [Ramp authorization documentation](https://docs.ramp.com/developer-api/v1/scopes).

## Why mention purchasing agents?

Agents can negotiate or purchase, but financial fulfillment still needs proof. Ramp’s agent-payments documentation already supports purchases under user permissions. Our hypothesis is that a durable commitment record can complement that execution layer. The prototype’s Orbit case illustrates the authority boundary; it is not a connected agent-to-agent negotiation. [Ramp agent payments](https://docs.ramp.com/developer-api/v1/agent-payments).

## What would you build next?

First validate supported cases with finance operators. Then add authenticated storage and read-only source connectors. Add model-assisted extraction only behind schema and citation checks, and evaluate it on held-out, permissioned evidence. Outbound recovery actions come later, with scoped approval, idempotency, and a real audit trail. Broader SLA ingestion, OCR, currencies, amendments, and accounting writeback each need explicit domain support.
