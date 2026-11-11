import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, ModelReaderError, amountsIn, handleModelRequest, locate, readWithClaude } from './model-reader.mjs';
import { parseEnv } from './env-file.mjs';

const EMAIL = `From: Priya Raman <priya@northwind.io>
Subject: Re: outage on March 3

Hi Dana,

Sorry again for the outage. We will apply a service credit of $1,250.00 to your
April invoice, reference CASE-4471. If you renew for 2027 we can add another $800.

Northwind Cloud`;

function fakeClient(payload, { stop_reason = 'end_turn', stop_details = null, model = MODEL, sink } = {}) {
  return {
    beta: {
      messages: {
        async create(params) {
          if (sink) sink.push(params);
          return {
            model,
            stop_reason,
            stop_details,
            content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
          };
        },
      },
    },
  };
}

const answer = over => ({
  vendor: 'Northwind Cloud',
  documentKind: 'promise',
  promises: [
    { amountCents: 125000, currency: 'USD', dueDate: '', reference: 'CASE-4471', conditions: [], quote: 'service credit of $1,250.00 to your\nApril invoice' },
    { amountCents: 80000, currency: 'USD', dueDate: '', reference: '', conditions: ['Renew for 2027'], quote: 'If you renew for 2027 we can add another $800.' },
  ],
  credits: [],
  notes: [],
  ...over,
});

test('a valid extraction is verified, located and sent with the right request shape', async () => {
  const sink = [];
  const result = await readWithClaude({ text: EMAIL, vendorHint: 'Northwind' }, { client: fakeClient(answer(), { sink }) });
  assert.equal(result.verified, true);
  assert.equal(result.model, MODEL);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.facts.vendor, 'Northwind Cloud');
  assert.equal(result.facts.promises.length, 2);
  const [first, second] = result.facts.promises;
  assert.equal(first.amountCents, 125000);
  assert.equal(EMAIL.slice(first.at.start, first.at.end), first.quote);
  assert.deepEqual(second.conditions, ['Renew for 2027']);

  const [params] = sink;
  assert.equal(params.model, 'claude-opus-5-5');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.fallbacks, 'default');
  assert.equal(params.output_config.effort, 'low');
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.output_config.format.schema.additionalProperties, false);
  assert.match(params.system, /verbatim/);
  assert.match(params.messages[0].content, /Northwind Cloud/);
});

test('a quote that is not in the text is dropped and reported', async () => {
  const bad = answer({ promises: [{ amountCents: 125000, currency: 'USD', dueDate: '', reference: '', conditions: [], quote: 'We will credit you $1,250.00 next month.' }] });
  const result = await readWithClaude({ text: EMAIL }, { client: fakeClient(bad) });
  assert.equal(result.facts.promises.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].field, 'promises[0]');
  assert.match(result.rejected[0].reason, /quote not found/);
});

test('an amount that does not match its quote is dropped and reported', async () => {
  const bad = answer({
    promises: [{ amountCents: 1250000, currency: 'USD', dueDate: '', reference: '', conditions: [], quote: 'service credit of $1,250.00' }],
    credits: [{ amountCents: 90000, invoiceId: '', reference: '', quote: 'another $800' }],
  });
  const result = await readWithClaude({ text: EMAIL }, { client: fakeClient(bad) });
  assert.equal(result.facts.promises.length, 0);
  assert.equal(result.facts.credits.length, 0);
  assert.deepEqual(result.rejected.map(r => r.field), ['promises[0]', 'credits[0]']);
  assert.ok(result.rejected.every(r => /does not appear in the quote/.test(r.reason)));
});

test('references, invoice numbers and the company must be in the text too', async () => {
  const bad = answer({
    vendor: 'Contoso',
    promises: [{ amountCents: 125000, currency: 'USD', dueDate: '2026-13-40', reference: '', conditions: [], quote: 'service credit of $1,250.00' }],
    credits: [{ amountCents: 80000, invoiceId: 'INV-9', reference: '', quote: 'another $800' }],
  });
  const result = await readWithClaude({ text: EMAIL }, { client: fakeClient(bad) });
  assert.equal(result.facts.vendor, '');
  assert.deepEqual(result.rejected.map(r => r.field).sort(), ['credits[0]', 'promises[0]', 'vendor']);
});

test('a refusal becomes a typed error carrying stop_details', async () => {
  const details = { type: 'refusal', category: 'cyber', explanation: 'declined' };
  await assert.rejects(
    readWithClaude({ text: EMAIL }, { client: fakeClient('', { stop_reason: 'refusal', stop_details: details }) }),
    error => error instanceof ModelReaderError && error.code === 'MODEL_REFUSED' && error.details === details,
  );
});

test('no key means MODEL_KEY_MISSING, and empty text is a 400 first', async () => {
  await assert.rejects(readWithClaude({ text: EMAIL }, { apiKey: '' }), error => error.code === 'MODEL_KEY_MISSING' && error.status === 503 && /Anthropic API key/.test(error.message));
  await assert.rejects(readWithClaude({ text: '   ' }, { apiKey: '' }), error => error.status === 400);
});

test('SDK errors map to typed reader errors', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const failing = error => ({ beta: { messages: { async create() { throw error; } } } });
  await assert.rejects(readWithClaude({ text: EMAIL }, { client: failing(new Anthropic.RateLimitError(429, {}, 'slow down', new Headers())) }), e => e.code === 'MODEL_BUSY' && e.status === 429);
  await assert.rejects(readWithClaude({ text: EMAIL }, { client: failing(new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers())) }), e => e.code === 'MODEL_KEY_REJECTED');
});

test('the HTTP routes: status, 400, 503', async () => {
  const call = async (method, url, body, env = {}) => {
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
    const req = { method, url, headers: {}, async *[Symbol.asyncIterator]() { yield* chunks; } };
    const res = { status: 0, body: '', writeHead(s) { this.status = s; }, end(b) { this.body = b; } };
    const handled = await handleModelRequest(req, res, { env });
    return { handled, status: res.status, json: res.body ? JSON.parse(res.body) : null };
  };
  let r = await call('GET', '/api/model/status');
  assert.deepEqual(r.json, { available: false, model: 'claude-opus-5-5' });
  r = await call('GET', '/api/model/status', undefined, { ANTHROPIC_API_KEY: 'sk-test' });
  assert.equal(r.json.available, true);
  r = await call('POST', '/api/model/read', { text: '' });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/model/read', { text: EMAIL });
  assert.equal(r.status, 503);
  assert.equal(r.json.error.code, 'MODEL_KEY_MISSING');
  assert.equal((await call('GET', '/api/workspace')).handled, false);
});

test('helpers: amounts, whitespace-tolerant location, .env parsing', () => {
  assert.ok(amountsIn('-$1,250.00 credit').includes(125000));
  assert.ok(amountsIn('about $1.2k').includes(120000));
  assert.deepEqual(locate('a  b\nc', 'a b c'), { start: 0, end: 6 });
  assert.equal(locate('abc', 'xyz'), null);
  assert.deepEqual(parseEnv('# c\nANTHROPIC_API_KEY=\nA="x y"\nexport B=2 # note\n'), { ANTHROPIC_API_KEY: '', A: 'x y', B: '2' });
});
