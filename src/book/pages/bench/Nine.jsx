// Nine ways it could go wrong.
//
// Nine old tricks, each tried against a fresh copy of the demo book by the real
// ledger rules (runScenario in src/assurance/scenarios.mjs: pure, nothing is
// saved). A refusal is the pass. Under the nine, a blank for a command written
// by hand, which goes to the real book the way any other write does.

import React, { useState } from 'react';
import { runScenario, scenarios } from '../../../assurance/index.mjs';
import { Btn, Cell, Field, Ledger, Row, Stamp } from '../../shell/parts.jsx';
import { plainError, whyNot } from '../../shell/roles.mjs';
import { checkWords, trialStamp, trialStep, trialWords } from './plain.mjs';

const COLS = 'var(--bk-lm) minmax(280px, 1.5fr) minmax(300px, 1.7fr) 168px 34px';
const HEAD = [null, { label: 'What it tries', rule: 'red' }, { label: 'What the ledger did' }, { label: '', rule: 'double' }, { label: '', rule: 'double' }];

// Commands to start from when writing one by hand. They are the demo book's own ids.
const BY_HAND = [
  { label: 'Match the $900 credit a second time', command: { type: 'ALLOCATE_CREDIT', allocationId: 'attempt-duplicate', creditId: 'credit-pipeline-900', commitmentId: 'pipeline-seats', amountCents: 90000 } },
  { label: 'Prepare a decision to keep the original promise', command: { type: 'PROPOSE_ACTION', action: { commitmentId: 'pipeline-seats', type: 'preserve_original', payload: {} } } },
  {
    label: 'File an invoice for the last $1,500 and match it',
    command: [
      { type: 'ADD_SOURCE', source: { id: 'source-pipeline-extra', vendorId: 'pipeline', title: 'Made-up invoice for the rest', kind: 'invoice', text: 'MADE-UP EXAMPLE. Invoice INV-PC-EXTRA applies the remaining USD 1,500 credit for PC-SEATS-2026. This is a separate credit line from the USD 900 October correction.' } },
      { type: 'REGISTER_CREDIT', credit: { id: 'credit-pipeline-extra', lineId: 'line-extra', invoiceId: 'INV-PC-EXTRA', vendorId: 'pipeline', currency: 'USD', reference: 'PC-SEATS-2026', amountCents: 150000, status: 'applied', sourceIds: ['source-pipeline-extra'] } },
      { type: 'ALLOCATE_CREDIT', allocationId: 'allocation-pipeline-extra', creditId: 'credit-pipeline-extra', commitmentId: 'pipeline-seats', amountCents: 150000 },
    ],
  },
];
const typedOut = value => JSON.stringify(value, null, 2);

export default function Nine({ service, say }) {
  const [results, setResults] = useState({});
  const [open, setOpen] = useState('');
  const [running, setRunning] = useState('');   // a trial's id, or 'all'

  function attempt(id) {
    try { return runScenario(id); }
    catch (error) { return { passed: false, checks: [{ name: 'Scenario execution', passed: false, detail: error.message }], steps: [] }; }
  }
  async function run(ids, mark) {
    setRunning(mark);
    await new Promise(resolve => requestAnimationFrame(() => resolve()));   // let the button say what it is doing
    try {
      const next = {};
      for (const id of ids) next[id] = attempt(id);
      setResults(now => ({ ...now, ...next }));
      if (ids.length === 1) setOpen(ids[0]);
    } finally {
      setRunning('');
    }
  }

  const tried = scenarios.filter(s => results[s.id]);
  const held = tried.filter(s => results[s.id].passed).length;
  const through = tried.length - held;

  return (
    <>
      <div className="bk-part bk-bench-nine">
        <div className="bk-actions">
          <Btn big onClick={() => run(scenarios.map(s => s.id), 'all')} busy={running === 'all' ? 'Trying all nine…' : ''}>Try all nine</Btn>
          <span className="bk-why">
            {tried.length === 0
              ? 'Each runs on a fresh copy of the demo book. Yours is not touched.'
              : through
                ? `${through} of ${tried.length} got through.`
                : `${tried.length} of ${scenarios.length} tried. The ledger held every time.`}
          </span>
        </div>
      </div>

      <Ledger cols={COLS} head={HEAD} className="bk-bench-ledger bk-bench-trials">
        {scenarios.map((scenario, i) => {
          const words = trialWords(scenario);
          const result = results[scenario.id];
          const stamp = trialStamp(result);
          const isOpen = open === scenario.id && Boolean(result);
          return (
            <React.Fragment key={scenario.id}>
              <Row lines={2} open={isOpen} className="bk-bench-trial">
                <Cell no>{i + 1}</Cell>
                <Cell rule="red" className="bk-bench-tries"><b>{words.name}</b><small>{words.line}</small></Cell>
                <Cell label="The ledger" className="bk-bench-did">
                  {stamp ? (
                    <>
                      <Stamp small ink={stamp.ink} seed={`trial-${scenario.id}-${stamp.word}`} land>{stamp.word}</Stamp>
                      <button type="button" className="bk-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : scenario.id)}>
                        {isOpen ? 'Fold it away' : `${result.checks.length} checks, ${result.steps.length} ${result.steps.length === 1 ? 'step' : 'steps'}`}
                      </button>
                    </>
                  ) : <span className="bk-muted">not tried yet</span>}
                </Cell>
                <Cell rule="double" className="bk-bench-try">
                  <Btn quiet onClick={() => run([scenario.id], scenario.id)} busy={running === scenario.id ? 'Trying it…' : ''} disabled={Boolean(running)}>{result ? 'Try it again' : 'Try it'}</Btn>
                </Cell>
                <Cell rule="double" />
              </Row>
              {isOpen && (
                <div className="bk-bench-opened" role="row">
                  <div role="cell">
                    <span className="bk-label">What was checked</span>
                    <ul className="bk-bench-checks">
                      {result.checks.map((check, n) => {
                        const said = checkWords(check, scenario.id);
                        return <li key={n} className={said.passed ? undefined : 'is-wrong'}><i aria-hidden="true">{said.passed ? '✓' : '✕'}</i>{said.text}{said.tech && <small> {said.tech}</small>}</li>;
                      })}
                    </ul>
                  </div>
                  <div role="cell">
                    <span className="bk-label">What was tried, and what the ledger answered</span>
                    <ol className="bk-bench-tried">
                      {result.steps.map((step, n) => {
                        const said = trialStep(step, scenario.id);
                        return <li key={n}><span>{said.did}</span><b className={said.refused ? 'is-no' : undefined}>{said.said}</b><small>{said.tech}</small></li>;
                      })}
                    </ol>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </Ledger>

      <ByHand service={service} say={say} />
    </>
  );
}

/** A command written by hand and sent to the real book, for whoever wants to try a tenth way. */
function ByHand({ service, say }) {
  const [text, setText] = useState(() => typedOut(BY_HAND[0].command));
  const [answer, setAnswer] = useState(null);
  let parsed = null, why = '';
  try { parsed = JSON.parse(text); } catch { why = 'That is not valid JSON yet.'; }
  const batch = parsed == null ? [] : Array.isArray(parsed) ? parsed : [parsed];
  if (!why && !batch.every(c => c && typeof c.type === 'string')) why = 'A command needs a "type".';
  if (!why) why = whyNot(batch.map(c => c.type), service);

  async function send() {
    setAnswer(null);
    try {
      const reply = Array.isArray(parsed) ? await service.commands(parsed) : await service.command(parsed);
      setAnswer({ ok: true, result: reply?.result });
      say('Written in the book.');
    } catch (error) {
      setAnswer({ ok: false, text: plainError(error), raw: String(error?.message || error) });
      say(plainError(error), { wrong: true });
    }
  }

  return (
    <details className="bk-part bk-bench-byhand">
      <summary>A tenth way: write a command by hand <small>goes to the real book</small></summary>
      <div className="bk-bench-pick">
        <Field label="Start from">
          <select onChange={e => { setText(typedOut(BY_HAND[Number(e.target.value)].command)); setAnswer(null); }} defaultValue="0">
            {BY_HAND.map((item, i) => <option key={item.label} value={i}>{item.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="The command, typed (JSON)" hint="One command, or a list of them that go in together or not at all.">
        <textarea className="bk-bench-json" value={text} onChange={e => { setText(e.target.value); setAnswer(null); }} spellCheck={false} maxLength={150000} />
      </Field>
      <div className="bk-actions">
        <Btn onClick={send} busy={service.busy ? 'Writing it in…' : ''} why={why}>Send it to the book</Btn>
        {!why && <span className="bk-why">This one is real. It writes in {service.mode === 'server' ? 'your team’s book' : 'this demo book'}, as the pen you hold.</span>}
      </div>
      {answer && (answer.ok
        ? <p className="bk-bench-fine" role="status">Written in. The book is at entry {service.workspace?.revision}.{answer.result?.commandId && <small> {answer.result.commandId}</small>}</p>
        : <p className="bk-bench-trouble" role="alert">The ledger refused. {answer.text} <small>{answer.raw}</small></p>)}
    </details>
  );
}
