// The model reader: Claude reads a pasted email, contract or invoice and says what
// it promises; then plain code checks every figure against the text before any of
// it can be used.
//
//   readWithClaude({ text, kind?, vendorHint? }, { client?, apiKey? })
//     → { model, facts, rejected, verified: true }
//
// The key stays on the server (ANTHROPIC_API_KEY). Without one, readWithClaude
// throws MODEL_KEY_MISSING and the built-in reader stays the only reader.
// handleModelRequest(req, res) serves GET /api/model/status and POST /api/model/read
// for server/host.mjs and the local backend (server/service.mjs).

export const MODEL = 'claude-opus-5-5';
export const MAX_TEXT = 200_000;
const KEY_MISSING = 'Add an Anthropic API key on the server to read with Claude.';

export class ModelReaderError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.name = 'ModelReaderError';
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

const DOCUMENT_KINDS = ['promise', 'invoice', 'credit_note', 'reply', 'other'];

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vendor', 'documentKind', 'promises', 'credits', 'notes'],
  properties: {
    vendor: { type: 'string', description: 'The company that sent or issued the document, as written in it. Empty if unknown.' },
    documentKind: { type: 'string', enum: DOCUMENT_KINDS },
    promises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amountCents', 'currency', 'dueDate', 'reference', 'conditions', 'quote'],
        properties: {
          amountCents: { type: 'integer', description: 'The promised credit in minor units: $1,250.00 is 125000.' },
          currency: { type: 'string', description: 'ISO 4217 code, e.g. USD.' },
          dueDate: { type: 'string', description: 'YYYY-MM-DD when the text gives a date for the credit, otherwise an empty string.' },
          reference: { type: 'string', description: 'The ticket, case, contract or credit reference exactly as written, or an empty string.' },
          conditions: { type: 'array', items: { type: 'string' }, description: 'Strings attached to the credit (renewals, upgrades, deadlines to claim). Empty when unconditional.' },
          quote: { type: 'string', description: 'The shortest passage, copied character for character from the text, that states this amount.' },
        },
      },
    },
    credits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amountCents', 'invoiceId', 'reference', 'quote'],
        properties: {
          amountCents: { type: 'integer', description: 'The credit actually applied or issued, in minor units, as a positive number.' },
          invoiceId: { type: 'string', description: 'The invoice or credit note number exactly as written, or an empty string.' },
          reference: { type: 'string', description: 'The reference the credit line names, exactly as written, or an empty string.' },
          quote: { type: 'string', description: 'The line or passage, copied character for character from the text, that shows this credit.' },
        },
      },
    },
    notes: { type: 'array', items: { type: 'string' }, description: 'Anything a finance reviewer should know that does not fit above. Short.' },
  },
};

export const SYSTEM = [
  'You read documents a company sent to its customer: emails, support replies, contracts, invoices (often CSV) and credit notes.',
  'Your job is to find credits the vendor promised (promises) and credits that actually appear on invoices or credit notes (credits).',
  '',
  'Rules:',
  '- Copy every `quote` verbatim from the text: same characters, same punctuation, same spacing. Never paraphrase, never fix typos, never join pieces from different places. A program will look for the exact quote in the text and discard anything it cannot find.',
  '- Each quote must contain the amount it supports, written as it appears in the text.',
  '- amountCents is the amount in minor units ($1,250 is 125000). Use positive numbers for credits even when an invoice shows them as negative.',
  '- Only report what the text states. If a date or reference is not written, leave it as an empty string.',
  '- A promise that depends on something (a renewal, an upgrade, a signature) lists that in conditions.',
  '- Invoice charges are not credits. Only report lines that reduce what is owed.',
].join('\n');

// —— verification

const ws = /\s+/g;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where the quote sits in the text: exact first, then allowing only runs of whitespace to differ. */
export function locate(text, quote) {
  const q = String(quote ?? '').trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact >= 0) return { start: exact, end: exact + q.length };
  const pattern = new RegExp(q.split(ws).map(escape).join('\\s+'));
  const found = pattern.exec(text);
  return found ? { start: found.index, end: found.index + found[0].length } : null;
}

/** Every money-looking figure in a passage, in minor units. "$1,250.00" → 125000, "-450.5" → 45050. */
export function amountsIn(passage) {
  const out = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?!\d)/g;
  for (const m of String(passage ?? '').matchAll(re)) {
    const whole = Number(m[1].replaceAll(',', ''));
    const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
    if (Number.isSafeInteger(whole)) out.push(whole * 100 + cents);
    // "1.2k" / "1.5k" style shorthand
    const after = passage.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if (/k/i.test(after)) out.push(Math.round(Number(`${m[1].replaceAll(',', '')}.${m[2] || 0}`) * 100_000));
  }
  return out;
}

const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

function checkFigure(text, item, field, rejected, extra = []) {
  const reject = reason => { rejected.push({ field, reason }); return null; };
  if (!Number.isSafeInteger(item.amountCents) || item.amountCents <= 0) return reject(`amount ${item.amountCents} is not a positive whole number of cents`);
  const at = locate(text, item.quote);
  if (!at) return reject(`quote not found in the text: "${String(item.quote).slice(0, 120)}"`);
  const quoted = text.slice(at.start, at.end);
  if (!amountsIn(quoted).includes(item.amountCents)) return reject(`amount ${item.amountCents} does not appear in the quote "${quoted.slice(0, 120)}"`);
  for (const [name, value] of extra) {
    if (value && !text.includes(value)) return reject(`${name} "${value}" is not in the text`);
  }
  return { ...item, quote: quoted, at };
}

/** Check the model's answer against the text. Anything that fails is dropped and reported. */
export function verifyExtraction(text, raw) {
  const rejected = [];
  const facts = {
    vendor: typeof raw?.vendor === 'string' ? raw.vendor.trim() : '',
    documentKind: DOCUMENT_KINDS.includes(raw?.documentKind) ? raw.documentKind : 'other',
    promises: [],
    credits: [],
    notes: Array.isArray(raw?.notes) ? raw.notes.filter(n => typeof n === 'string' && n.trim()).map(n => n.trim()) : [],
  };
  (Array.isArray(raw?.promises) ? raw.promises : []).forEach((p, i) => {
    const field = `promises[${i}]`;
    if (p?.dueDate && !isDay(p.dueDate)) { rejected.push({ field, reason: `due date "${p.dueDate}" is not a calendar day` }); return; }
    const kept = checkFigure(text, p || {}, field, rejected, [['reference', p?.reference]]);
    if (kept) facts.promises.push({
      amountCents: kept.amountCents,
      currency: /^[A-Z]{3}$/.test(kept.currency || '') ? kept.currency : 'USD',
      dueDate: kept.dueDate || '',
      reference: kept.reference || '',
      conditions: Array.isArray(kept.conditions) ? kept.conditions.filter(c => typeof c === 'string' && c.trim()) : [],
      quote: kept.quote,
      at: kept.at,
    });
  });
  (Array.isArray(raw?.credits) ? raw.credits : []).forEach((c, i) => {
    const field = `credits[${i}]`;
    const kept = checkFigure(text, c || {}, field, rejected, [['invoice number', c?.invoiceId], ['reference', c?.reference]]);
    if (kept) facts.credits.push({ amountCents: kept.amountCents, invoiceId: kept.invoiceId || '', reference: kept.reference || '', quote: kept.quote, at: kept.at });
  });
  if (facts.vendor && !text.toLowerCase().includes(facts.vendor.toLowerCase())) {
    rejected.push({ field: 'vendor', reason: `company "${facts.vendor}" is not named in the text` });
    facts.vendor = '';
  }
  return { facts, rejected };
}

// —— the call

let sdk = null;
async function loadSdk() {
  if (!sdk) sdk = (await import('@anthropic-ai/sdk')).default;
  return sdk;
}

export function modelAvailable(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY);
}

async function sdkError(error) {
  if (error instanceof ModelReaderError) return error;
  let A = null;
  try { A = await loadSdk(); } catch { /* SDK absent: fall through */ }
  if (A) {
    if (error instanceof A.AuthenticationError) return new ModelReaderError('MODEL_KEY_REJECTED', 502, 'The Anthropic API key on the server was rejected.');
    if (error instanceof A.PermissionDeniedError) return new ModelReaderError('MODEL_FORBIDDEN', 502, 'The Anthropic API key on the server is not allowed to use this model.');
    if (error instanceof A.RateLimitError) return new ModelReaderError('MODEL_BUSY', 429, 'Claude is busy. Try again in a minute.');
    if (error instanceof A.BadRequestError) return new ModelReaderError('MODEL_REQUEST_REJECTED', 502, `The model request was rejected: ${error.message}`);
    if (error instanceof A.APIConnectionError) return new ModelReaderError('MODEL_UNREACHABLE', 502, 'Couldn’t reach Claude. Check the server’s connection.');
    if (error instanceof A.APIError) return new ModelReaderError('MODEL_ERROR', 502, `Claude returned an error (${error.status ?? 'no status'}).`);
  }
  return new ModelReaderError('MODEL_ERROR', 502, error?.message || 'The model reader failed.');
}

function prompt({ text, kind, vendorHint }) {
  const lines = [];
  if (kind) lines.push(`The customer filed this as: ${kind}.`);
  if (vendorHint) lines.push(`The customer believes it is from: ${vendorHint}.`);
  lines.push('Read the document between the markers and report what it says about credits.', '<document>', text, '</document>');
  return lines.join('\n');
}

export async function readWithClaude({ text, kind = '', vendorHint = '' } = {}, { client, apiKey = process.env.ANTHROPIC_API_KEY } = {}) {
  const source = typeof text === 'string' ? text : '';
  if (!source.trim()) throw new ModelReaderError('VALIDATION', 400, 'Paste the text to read first.');
  if (source.length > MAX_TEXT) throw new ModelReaderError('VALIDATION', 400, `That text is longer than ${MAX_TEXT.toLocaleString('en-US')} characters.`);
  if (!client && !apiKey) throw new ModelReaderError('MODEL_KEY_MISSING', 503, KEY_MISSING);

  let response;
  try {
    const api = client || new (await loadSdk())({ apiKey });
    response = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt({ text: source, kind: String(kind || ''), vendorHint: String(vendorHint || '') }) }],
    });
  } catch (error) {
    throw await sdkError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new ModelReaderError('MODEL_REFUSED', 422, 'Claude declined to read this text. The built-in reader still can.', response.stop_details ?? null);
  }
  if (response.stop_reason === 'max_tokens') throw new ModelReaderError('MODEL_TRUNCATED', 502, 'Claude’s answer was cut off. Try a shorter text.');

  const texts = (response.content || []).filter(block => block.type === 'text');
  if (!texts.length) throw new ModelReaderError('MODEL_EMPTY', 502, 'Claude returned no answer.');
  let raw;
  try { raw = JSON.parse(texts.at(-1).text); } catch { throw new ModelReaderError('MODEL_BAD_JSON', 502, 'Claude’s answer was not readable JSON.'); }

  const { facts, rejected } = verifyExtraction(source, raw);
  return { model: response.model || MODEL, facts, rejected, verified: true };
}

// —— HTTP

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = MAX_TEXT * 2 + 4096) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ModelReaderError('VALIDATION', 413, 'That text is too long to read.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new ModelReaderError('VALIDATION', 400, 'Send JSON: { "text": "…" }.'); }
}

/** Serves the two model routes. Returns true when it answered the request. */
export async function handleModelRequest(req, res, { env = process.env, read = readWithClaude, client } = {}) {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/model/status' && req.method === 'GET') {
    send(res, 200, { available: modelAvailable(env), model: MODEL });
    return true;
  }
  if (path === '/api/model/read' && req.method === 'POST') {
    try {
      const input = await readBody(req);
      const result = await read({ text: input?.text, kind: input?.kind, vendorHint: input?.vendorHint }, { apiKey: env.ANTHROPIC_API_KEY, client });
      send(res, 200, result);
    } catch (error) {
      const e = error instanceof ModelReaderError ? error : await sdkError(error);
      send(res, e.status || 500, { error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } });
    }
    return true;
  }
  if (path === '/api/model/status' || path === '/api/model/read') {
    send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for status and POST for read.' } });
    return true;
  }
  return false;
}
