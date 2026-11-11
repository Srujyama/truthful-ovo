// Two clerks, one credit.
//
// Two programs each do the right thing and still get the book wrong when their
// steps are shuffled together. This runs every ordering of their steps twice:
// once trusting an earlier look (how most software works), once looking again at
// the moment of writing (what Truthful's ledger does), and lays the two side by
// side on the page. Nothing here writes to the book; it all runs on a copy.
//
// The engine is src/explorer. In the browser-only book it runs right here; with
// the real server the run is the server's (POST /explorer/compare) and so is the
// replay check (POST /explorer/verify).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { compareScenario, createScenario, explorePlan, scenarioCatalog, verifyExplorationPacket } from '../../../explorer/index.mjs';
import { createPortfolioScenario } from '../../../explorer/portfolio.mjs';
import { canonical } from '../../../assurance/index.mjs';
import { Btn, Cell, Field, Ledger, Paper, Row, Stamp } from '../../shell/parts.jsx';
import { ledger } from '../../shell/money.mjs';
import { decisionSays } from '../account/entries.mjs';
import { saveFile } from '../records/save.mjs';
import { LIMITS, MEANWHILE, clerk, clerkTech, didWords, everyOrdering, factsOf, figuresOf, fixWords, pairOf, rowsOf, runTrouble, setupWords, verdictOf } from './plain.mjs';

const COLS = 'var(--bk-lm) minmax(150px, 0.6fr) minmax(190px, 1fr) minmax(240px, 1.22fr) minmax(240px, 1.22fr) 34px';
const HEAD = [
  null,
  { label: 'Who', rule: 'red' },
  { label: 'What they did' },
  { label: 'Checking once: the ledger said', rule: 'double' },
  { label: 'Checking again: the ledger said', rule: 'red' },
  { label: '', rule: 'double' },
];
const FIX_COLS = 'var(--bk-lm) minmax(150px, 0.6fr) minmax(190px, 1fr) minmax(240px, 2.44fr) 34px';
const FIX_HEAD = [null, { label: 'Who', rule: 'red' }, { label: 'What they did' }, { label: 'The ledger said', rule: 'double' }, { label: '', rule: 'double' }];

const SIDES = {
  naive: { title: 'Checking once, then trusting it', tech: 'the stale check · naive', file: 'truthful-exploration-naive.json' },
  guarded: { title: 'Checking again at the moment of writing', tech: 'what Truthful does · guarded', file: 'truthful-exploration-guarded.json' },
  repair: { title: 'A way that works', tech: 'the repair · guarded', file: 'truthful-exploration-repair.json' },
};

const capital = text => text.charAt(0).toUpperCase() + text.slice(1);

export default function Clerks({ service, view }) {
  const [setupId, setSetupId] = useState(scenarioCatalog[0].id);
  const [limit, setLimit] = useState('2000');
  const [meanwhile, setMeanwhile] = useState('none');
  const [typed, setTyped] = useState(null);           // the steps as JSON, once someone has changed them
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState('');
  const [replays, setReplays] = useState({});         // { naive | guarded | repair: { valid, errors, digest } | 'checking' }
  const [at, setAt] = useState(0);                    // which step the two columns are stopped on
  const [fixOpen, setFixOpen] = useState(false);
  const ticket = useRef(0);                           // a run that was overtaken is dropped when it comes back
  const rowRefs = useRef([]);

  // A different person, team or pen gets a clean bench.
  const whose = JSON.stringify([service.mode, service.authMode, service.session?.workspace?.id, service.session?.user?.id, service.actor?.id, service.actor?.role]);
  const fromBook = setupId.startsWith('book:');
  const decisionId = fromBook ? setupId.slice(5) : '';
  const approved = useMemo(() => (view ? view.actions.filter(a => a.status === 'approved' && !a.executed) : []), [view]);
  const decisionLabel = action => {
    const promise = view.commitments.find(c => c.id === action.commitmentId);
    const offer = view.amendments.find(m => m.id === action.payload?.amendmentId);
    const company = view.vendors.find(v => v.id === promise?.vendorId)?.name || 'A company';
    return `${company}: ${decisionSays(action, offer, promise, view.asOf)}`;
  };

  // The steps as they are written for this set-up, before anyone edits them.
  const [written, cannot] = useMemo(() => {
    try {
      const plan = fromBook
        ? createPortfolioScenario(service.workspace, { actionId: decisionId, adversary: meanwhile, now: new Date().toISOString() })
        : createScenario(setupId);
      return [plan, ''];
    } catch (error) {
      return [null, runTrouble(error)];
    }
  }, [setupId, meanwhile, fromBook, decisionId, service.workspace]);

  function clear() {
    ticket.current++;
    setBusy(false);
    setResult(null);
    setReplays({});
    setTrouble('');
    setAt(0);
    setFixOpen(false);
  }
  function choose(id) {
    clear();
    setSetupId(id);
    setTyped(null);
    setMeanwhile('none');
  }
  useEffect(() => { choose(scenarioCatalog[0].id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [whose]);
  useEffect(() => () => { ticket.current++; }, []);
  // A decision that has since been written in, or gone out of date, is no longer on the list.
  useEffect(() => {
    if (fromBook && view && !approved.some(a => a.id === decisionId) && !result) choose(scenarioCatalog[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, fromBook, decisionId]);

  const onServer = service.mode === 'server';
  const reader = onServer && service.actor?.role === 'viewer';
  const post = (path, input) => service.apiRequest(path, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) });

  async function run() {
    const mine = ++ticket.current;
    const stale = () => mine !== ticket.current;
    setBusy(true); setTrouble(''); setReplays({}); setResult(null); setFixOpen(false);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));      // let the button say what it is doing first
      const bounds = { maxDepth: 12, maxStates: Number(limit), maxTransitions: 6000, maxTimeMs: 2000 };
      let next;
      if (onServer) {
        let input = { bounds };
        if (typed != null) input.plan = JSON.parse(typed);
        else if (fromBook) {
          const captured = await service.apiRequest('/workspace');
          if (stale()) return;
          input = { ...input, portfolio: { actionId: decisionId, adversary: meanwhile }, expectedRevision: captured.revision };
        } else input.scenarioId = setupId;
        if (stale()) return;
        const stored = await post('/explorer/compare', input);
        next = { ...stored.report, runId: stored.runId, capturedRevision: stored.capturedRevision, recordedAt: stored.recordedAt };
      } else if (fromBook && typed == null) {
        const live = await service.refresh() || service.workspace;
        if (stale()) return;
        const plan = createPortfolioScenario(live, { actionId: decisionId, adversary: meanwhile, now: new Date().toISOString() });
        next = await compareScenario(plan, { bounds });
      } else if (typed != null) {
        const plan = JSON.parse(typed);
        plan.id = `custom:${setupId}`;
        plan.metadata = { ...(plan.metadata || {}), origin: 'user-supplied', assumptionNotice: 'Steps typed by hand at the test bench. They run on a copy of the book, with a made-up approval.' };
        const naive = await explorePlan(plan, { mode: 'naive', bounds });
        if (stale()) return;
        const guarded = await explorePlan(plan, { mode: 'guarded', bounds });
        next = { scenario: plan, naive, guarded, repair: null };
      } else next = await compareScenario(setupId, { bounds });
      if (stale()) return;
      setResult(next);
      const pair = pairOf(next);
      const wrongAt = pair.once ? pair.once.trace.findIndex(step => pair.once.unsafeEffects.some(effect => effect.stepId === step.stepId)) : -1;
      setAt(wrongAt >= 0 ? wrongAt : Math.max(0, pair.rows.length - 1));
    } catch (error) {
      if (!stale()) setTrouble(runTrouble(error));
    } finally {
      if (!stale()) setBusy(false);
    }
  }

  // The browser-only book opens with the first set-up already run, so the page shows what it is for.
  // With the real server a run is kept on file, so it waits to be asked.
  const opened = useRef('');
  useEffect(() => {
    if (onServer || service.mode !== 'browser' || opened.current === whose) return;
    opened.current = whose;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whose, service.mode]);

  async function replay(which) {
    const packet = which === 'repair' ? result?.repair?.report : result?.[which];
    const mine = ticket.current;
    if (!packet) return;
    setReplays(now => ({ ...now, [which]: 'checking' }));
    let checked;
    try {
      checked = onServer ? await post('/explorer/verify', { runId: result.runId, variant: which }) : await verifyExplorationPacket(packet);
    } catch (error) {
      checked = { valid: false, errors: [runTrouble(error)] };
    }
    if (mine === ticket.current) setReplays(now => ({ ...now, [which]: { ...checked, digest: packet.digest } }));
  }
  const download = which => {
    const packet = which === 'repair' ? result.repair.report : result[which];
    saveFile(SIDES[which].file, JSON.stringify(packet, null, 2), 'application/json');
  };

  const pair = useMemo(() => pairOf(result), [result]);
  const figures = useMemo(() => (result ? { once: figuresOf(result.scenario, pair.once), again: figuresOf(result.scenario, pair.again) } : null), [result, pair]);
  const step = Math.min(at, Math.max(0, pair.rows.length - 1));
  function move(by) {
    const next = Math.min(pair.rows.length - 1, Math.max(0, step + by));
    setAt(next);
    if (rowRefs.current.includes(document.activeElement)) rowRefs.current[next]?.focus();
  }
  function onKeys(event) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1); }
  }

  const words = fromBook ? MEANWHILE.find(m => m.id === meanwhile) : setupWords(setupId, scenarioCatalog.find(s => s.id === setupId));
  const plan = typed == null ? written : null;
  const why = reader
    ? 'Waiting for anyone with a pen. You are signed in as reader, and a run is kept on file.'
    : typed == null && cannot ? cannot : '';
  const moved = result?.scenario.metadata?.origin === 'portfolio-copy' && service.workspace && canonical(result.scenario.initialState) !== canonical(service.workspace);

  return (
    <>
      <div className="bk-part bk-bench-desk">
        <Paper className="bk-form bk-bench-form" w={300} rot={-0.25}>
          <h2 className="bk-form-title">Two clerks, one credit <small>Runs on a copy. The book is not touched.{onServer ? ' The server keeps each run on file.' : ''}</small></h2>
          <div className="bk-bench-fields">
            <Field label="What they are both trying to do">
              <select value={setupId} onChange={e => choose(e.target.value)}>
                <optgroup label="Written set-ups">
                  {scenarioCatalog.map(s => <option key={s.id} value={s.id}>{setupWords(s.id, s).label}</option>)}
                </optgroup>
                <optgroup label="A decision approved in this book">
                  {approved.map(a => <option key={a.id} value={`book:${a.id}`}>{capital(decisionLabel(a))}</option>)}
                  {fromBook && !approved.some(a => a.id === decisionId) && <option value={setupId}>A decision no longer waiting</option>}
                  {!approved.length && !fromBook && <option disabled>None yet. Approve one on its IOU page.</option>}
                </optgroup>
              </select>
            </Field>
            {fromBook && (
              <Field label="What else happens meanwhile">
                <select value={meanwhile} onChange={e => { clear(); setTyped(null); setMeanwhile(e.target.value); }}>
                  {MEANWHILE.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="How far to look">
              <select value={limit} onChange={e => { clear(); setLimit(e.target.value); }}>
                {LIMITS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <div className="bk-bench-go">
              <Btn big onClick={run} busy={busy ? 'Trying every ordering…' : ''} disabled={Boolean(why)}>Run both ways</Btn>
            </div>
          </div>
          {why && <p className="bk-why bk-bench-whynot">{why}</p>}
          {trouble && <p className="bk-bench-trouble" role="alert">{trouble}</p>}
          {words?.line && <p className="bk-bench-setup">{words.line}{words.tech && <small> {words.tech}</small>}</p>}

          <details className="bk-bench-steps">
            <summary>Their steps</summary>
            {plan && (
              <ul className="bk-bench-plan">
                {plan.agents.map(agent => (
                  <li key={agent.id}>
                    <b>{clerk(agent.id)}</b> <small>{clerkTech(agent.id, agent.actor)}</small>
                    <ol>{agent.steps.map(s => <li key={s.id}>{didWords(s, plan)}</li>)}</ol>
                  </li>
                ))}
              </ul>
            )}
            <p className="bk-bench-note">
              {typed == null
                ? 'Each keeps their own order. The bench shuffles the two together every way it can, up to 12 steps deep, for 2 seconds at most.'
                : 'These are your steps now. The bench runs them as typed.'}
            </p>
            <Field label="The same steps, typed (JSON)" hint={typed == null ? 'Change anything here and the bench runs your version.' : undefined}>
              <textarea
                className="bk-bench-json"
                value={typed ?? (written ? JSON.stringify(written, null, 2) : '')}
                onChange={e => { clear(); setTyped(e.target.value); }}
                maxLength={150000}
                spellCheck={false}
              />
            </Field>
            {typed != null && <button type="button" className="bk-link" onClick={() => { clear(); setTyped(null); }}>Put the written steps back</button>}
          </details>

        </Paper>
      </div>

      {result && (
        <section className="bk-bench-run" aria-label="The run, both ways" onKeyDown={onKeys}>
          <div className="bk-bench-verdicts" style={{ '--cols': COLS }}>
            <div className="bk-bench-lead">
              <h2 className="bk-h2">
                {pair.kind === 'wrong' ? 'The shortest way it goes wrong' : pair.kind === 'none' ? 'No ordering got to the end' : pair.kind === 'refusal' ? 'An ordering the ledger stops' : 'One ordering, start to finish'}
              </h2>
              <p className="bk-bench-tech">
                {pair.kind === 'wrong' ? 'minimal unsafe trace' : pair.kind === 'none' ? 'search cut off' : pair.kind === 'refusal' ? 'rejected trace' : 'completion trace'}
                {pair.rows.length > 0 && ` · ${pair.rows.length} steps`}
              </p>
              {pair.rows.length > 1 && (
                <div className="bk-bench-stepper">
                  <button type="button" className="bk-bench-arrow" onClick={() => move(-1)} disabled={step === 0} aria-label="The step before">←</button>
                  <span aria-live="polite">Step {step + 1} of {pair.rows.length}</span>
                  <button type="button" className="bk-bench-arrow" onClick={() => move(1)} disabled={step === pair.rows.length - 1} aria-label="The next step">→</button>
                </div>
              )}
              {result.scenario.metadata?.origin === 'portfolio-copy' && (
                <p className="bk-bench-note">
                  A copy of {result.scenario.metadata.vendorName}’s {result.scenario.metadata.reference} as the book stood at entry {result.scenario.metadata.snapshotRevision}.
                  {moved && <span className="bk-hand"> The book has moved on since. Run it again.</span>}
                </p>
              )}
              {result.runId && <p className="bk-bench-tech">kept by the server as {result.runId} · book at entry {result.capturedRevision}</p>}
            </div>
            <Verdict which="naive" packet={result.naive} kept={pair.once} replay={replays.naive} onReplay={replay} onDownload={download} reader={reader} />
            <Verdict which="guarded" packet={result.guarded} kept={pair.again} replay={replays.guarded} onReplay={replay} onDownload={download} reader={reader} />
          </div>

          {pair.rows.length > 0 && (
            <>
              <Ledger cols={COLS} head={HEAD} className="bk-bench-ledger">
                {pair.rows.map((row, i) => (
                  <Row
                    key={`${row.id}-${i}`}
                    ref={el => { rowRefs.current[i] = el; }}
                    lines={2}
                    open={i === step}
                    onClick={() => setAt(i)}
                    aria-current={i === step ? 'step' : undefined}
                    aria-label={`Step ${i + 1}: ${row.who}. ${row.did}`}
                    data-step={i}
                  >
                    <Cell no>{i + 1}</Cell>
                    <Cell rule="red" label="Who" className="bk-bench-who">{row.who}<small>{row.whoTech}</small></Cell>
                    <Cell label="What they did">{row.did}</Cell>
                    <Cell rule="double" label="Checking once" owed={row.once?.tone === 'wrong'} className={row.once?.tone === 'no' ? 'bk-bench-no' : undefined}>{row.once?.text}</Cell>
                    <Cell rule="red" label="Checking again" owed={row.again?.tone === 'wrong'} className={row.again?.tone === 'no' ? 'bk-bench-no' : undefined}>
                      {row.apart && <small>{row.againDid}</small>}{row.again?.text}
                    </Cell>
                    <Cell rule="double" />
                  </Row>
                ))}
              </Ledger>
              <Figures row={pair.rows[step]} once={figures.once[step]} again={figures.again[step]} step={step} />
              <details className="bk-part bk-bench-raw">
                <summary>Step {step + 1} as the engine has it</summary>
                <pre tabIndex={0}>{JSON.stringify(rawStep(pair.rows[step]), null, 2)}</pre>
              </details>
            </>
          )}

          {result.repair ? (
            <Fix repair={result.repair} open={fixOpen} onToggle={() => setFixOpen(open => !open)} replay={replays.repair} onReplay={replay} onDownload={download} reader={reader} />
          ) : pair.kind === 'wrong' && (
            <p className="bk-part bk-bench-note bk-bench-nofix">
              {typed != null
                ? 'Truthful has no ready-made fix for steps typed by hand. Change them and run again.'
                : 'The fix for a decision from the book is the usual one: prepare it again, approve it again, then write it in.'}
            </p>
          )}
        </section>
      )}
    </>
  );
}

/** One side of the run: its rule, the stamp, the one line, and the two things you can do with it. */
function Verdict({ which, packet, kept, replay, onReplay, onDownload, reader }) {
  const side = SIDES[which];
  const v = verdictOf(packet, kept);
  return (
    <div className="bk-bench-verdict">
      <h3 className="bk-bench-rule">{side.title}</h3>
      <p className="bk-bench-tech">{side.tech}</p>
      <div className="bk-bench-stampline">
        <Stamp ink={v.ink} small={v.small} seed={`bench-${which}-${packet.digest}`} land>{v.stamp}</Stamp>
        {replay && replay !== 'checking' && replay.digest === packet.digest && replay.valid && <Stamp small seed={`replays-${which}-${packet.digest}`} land>Replays</Stamp>}
      </div>
      <p className={v.ink === 'red' ? 'bk-bench-line is-wrong' : 'bk-bench-line'}>{v.line}</p>
      <p className="bk-bench-facts">{factsOf(packet)}</p>
      <Doing which={which} packet={packet} replay={replay} onReplay={onReplay} onDownload={onDownload} reader={reader} />
    </div>
  );
}

function Doing({ which, packet, replay, onReplay, onDownload, reader }) {
  const checked = replay && replay !== 'checking' && replay.digest === packet.digest ? replay : null;
  return (
    <div className="bk-bench-doing">
      <button type="button" className="bk-link" onClick={() => onReplay(which)} disabled={replay === 'checking' || reader}>
        {replay === 'checking' ? 'Replaying it…' : checked?.valid ? 'Check it replays again' : 'Check it replays'}
      </button>
      <button type="button" className="bk-link" onClick={() => onDownload(which)}>Download this run</button>
      {reader && <span className="bk-why">A replay is kept on file, so it waits for anyone with a pen.</span>}
      {checked && !checked.valid && <p className="bk-bench-trouble" role="status">It does not replay. {checked.errors.join(' ')}</p>}
    </div>
  );
}

/** The two figures that matter, just before the step and just after it, under each rule. */
function Figures({ row, once, again, step }) {
  const lead = once || again;
  if (!lead) return null;
  const hasNote = lead.before.creditLeftCents != null;
  const lines = [
    hasNote
      ? { label: 'Credit left on the note', get: f => f.creditLeftCents, money: true }
      : { label: 'The decision', get: f => f.decision, money: false },
    { label: 'Still owed on the promise', get: f => f.owedCents, money: true },
    { label: 'Entries in the book', get: f => f.entries, money: false, tech: 'revision' },
  ];
  const show = (line, value) => (value == null ? '' : line.money ? ledger(value) : String(value));
  const cell = (line, side, tone) => {
    if (!side) return <span className="bk-bench-fig" />;
    const before = line.get(side.before), after = line.get(side.after);
    const wrong = line.money ? after < 0 : tone === 'wrong' && before !== after && line.label === 'The decision';
    return (
      <span className={wrong ? 'bk-bench-fig is-wrong' : 'bk-bench-fig'}>
        <i>{show(line, before)}</i><em aria-label="then">→</em><b>{show(line, after)}</b>
      </span>
    );
  };
  return (
    <div className="bk-bench-figs" style={{ '--cols': COLS }} role="table" aria-label={`Step ${step + 1}, before and after`}>
      {lines.map((line, i) => (
        <div key={line.label} className="bk-bench-figrow" role="row">
          <span className="bk-bench-figlabel" role="rowheader">
            {i === 0 && <b className="bk-bench-figstep">Step {step + 1}, before → after</b>}
            {line.label}{line.tech && <small className="bk-bench-tech"> {line.tech}</small>}
          </span>
          <span role="cell" data-label="Checking once">{cell(line, once, row.once?.tone)}</span>
          <span role="cell" data-label="Checking again">{cell(line, again, row.again?.tone)}</span>
          <span />
        </div>
      ))}
    </div>
  );
}

/** A step the way the engine keeps it, for whoever wants the raw thing. */
function rawStep(row) {
  const side = view => view && { status: view.step.status, error: view.step.error || undefined, theLedgerNow: view.step.oracle || undefined, entriesWritten: view.step.effects.map(e => e.type), wrong: view.wrong || undefined };
  const lead = (row.once || row.again).step;
  return { step: lead.stepId, agent: lead.agentId, actor: lead.actor, kind: lead.kind, at: lead.now, command: lead.command, checkingOnce: side(row.once), checkingAgain: side(row.again) };
}

/** The engine's own repaired steps, opened the same way as the run above. */
function Fix({ repair, open, onToggle, replay, onReplay, onDownload, reader }) {
  const report = repair.report;
  const kept = report.completionTrace || report.guardedRejection;
  const rows = rowsOf(kept, null);
  const v = verdictOf(report, kept);
  const g = report.goalCompletion;
  const line = g.blockedOrIncompleteSchedules > 0 && g.terminalSchedules > 0
    ? `${g.safeCompletedSchedules} of ${g.terminalSchedules} orderings ${g.safeCompletedSchedules === 1 ? 'finishes' : 'finish'}. The ledger refuses the rest, as it should.`
    : report.status === 'no_unsafe_effect_within_bounds' ? `Tried ${everyOrdering(report.stats.terminalSchedules)}. Every one ends clean.` : v.line;
  return (
    <div className="bk-bench-fix">
      <div className="bk-part">
        <button type="button" className="bk-bench-fixhead" aria-expanded={open} onClick={onToggle}>
          <span className="bk-h2">A way that works</span>
          <span className="bk-bench-tech">the repair · {repair.plan.repair.operation.replaceAll('_', ' ')}</span>
          <span className="bk-link">{open ? 'Close it' : 'Open it'}</span>
        </button>
        <p className="bk-bench-fixsaid">{fixWords(repair)}</p>
      </div>
      {open && (
        <>
          <div className="bk-part bk-bench-fixverdict">
            <div className="bk-bench-stampline">
              <Stamp ink={v.ink} small={v.small} seed={`bench-repair-${report.digest}`} land>{v.stamp}</Stamp>
              {replay && replay !== 'checking' && replay.digest === report.digest && replay.valid && <Stamp small seed={`replays-repair-${report.digest}`} land>Replays</Stamp>}
            </div>
            <div>
              <p className="bk-bench-line">{line}</p>
              <p className="bk-bench-facts">{factsOf(report)}</p>
              <Doing which="repair" packet={report} replay={replay} onReplay={onReplay} onDownload={onDownload} reader={reader} />
            </div>
          </div>
          {rows.length > 0 && (
            <Ledger cols={FIX_COLS} head={FIX_HEAD} className="bk-bench-ledger">
              {rows.map((row, i) => (
                <Row key={row.id} lines={2}>
                  <Cell no>{i + 1}</Cell>
                  <Cell rule="red" label="Who" className="bk-bench-who">{row.who}<small>{row.whoTech}</small></Cell>
                  <Cell label="What they did">{row.did}</Cell>
                  <Cell rule="double" label="The ledger said" className={row.once.tone === 'no' ? 'bk-bench-no' : undefined}>{row.once.text}</Cell>
                  <Cell rule="double" />
                </Row>
              ))}
            </Ledger>
          )}
        </>
      )}
    </div>
  );
}
