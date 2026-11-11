# The model reader

Truthful has two readers for the papers a vendor sends: the built-in reader (deterministic, in
`src/engine` and `src/assuranceImport.mjs`) and a Claude reader that runs on the server whenever an
Anthropic API key is present. The repository ships no key.

## What it does

`server/model-reader.mjs` sends one pasted email, contract, reply or invoice CSV to
**Claude Opus 5.5** (`claude-opus-5-5`) through the official SDK (`@anthropic-ai/sdk`) and asks for
structured JSON:

```
{ vendor, documentKind: promise | invoice | credit_note | reply | other,
  promises: [{ amountCents, currency, dueDate, reference, conditions[], quote }],
  credits:  [{ amountCents, invoiceId, reference, quote }],
  notes: [] }
```

The request uses structured outputs (`output_config.format`, a strict JSON schema), `effort: "low"`,
and the server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`,
`fallbacks: "default"`). A refusal comes back as `MODEL_REFUSED` with the API's `stop_details`; SDK
errors map to typed codes (`MODEL_KEY_REJECTED`, `MODEL_BUSY`, `MODEL_UNREACHABLE`, `MODEL_ERROR`).

## The verification step

The model never writes a figure into the book on its own word. Every figure it returns is checked by
plain code against the text it was given:

1. The `quote` must occur in the source text verbatim (runs of whitespace may differ, nothing else).
2. The amount written inside that quote must equal `amountCents`.
3. A `reference` or `invoiceId`, when given, must appear in the text; a `dueDate` must be a real
   calendar day; the vendor must be named in the text.

Anything that fails is dropped and listed in `rejected: [{ field, reason }]`. Each figure that passes
carries `at: { start, end }`, the character range of its quote, so the tray puts it under the same
highlighter the built-in reader uses. The engine stays the authority: the tray still runs the
deterministic reading, and only that reading goes into the book.

## Turning it on

```
cp .env.example .env        # .env is ignored by Git
# put the key after ANTHROPIC_API_KEY=
node server/host.mjs        # or npm run dev
```

`server/host.mjs` and `server/start.mjs` read `.env` at startup (values already in the environment
win). The key stays in the server process: the browser only ever calls the two endpoints below.

## Endpoints

| Route | Answer |
|---|---|
| `GET /api/model/status` | `{ available: Boolean(ANTHROPIC_API_KEY), model: "claude-opus-5-5" }` |
| `POST /api/model/read` with `{ text, kind?, vendorHint? }` | `{ model, facts, rejected, verified: true }`; 400 on empty text; 503 `MODEL_KEY_MISSING` without a key |

Both are served by `server/host.mjs` before its `/api` proxy, and by the local backend
(`server/service.mjs`) so `npm run dev` has them too. POSTs from another origin are refused.

## In the tray

`#/tray` shows **read with**: `Claude (Opus 5.5)` when the status says a key is present, otherwise
`the built-in reader` and the line *Add an Anthropic API key on the server to read with Claude.* With
Claude chosen, "Read them" sends each paper to `/api/model/read` alongside the built-in reading and
lists what Claude found, each figure highlighted at its quote in the papers, under the line
`read by claude-opus-5-5 · every figure checked against the text`. In the browser-only demo there is
no server, so the tray reads with the built-in reader.

## Tests

`node --test server/model-reader.test.mjs` (part of `npm test`) stubs the SDK client and covers a
verified extraction, a quote missing from the text, an amount mismatch, a refusal, SDK error mapping,
the HTTP routes and the missing key.
