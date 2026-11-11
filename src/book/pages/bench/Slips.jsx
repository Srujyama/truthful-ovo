// Permission slips.
//
// A permission slip lets a program write ONE decision in the book, ONCE, up to
// a limit, for a few minutes. It is signed by the book's key and held by a key
// made for it. It can be handed on, but only narrower. Used twice, the ledger
// refuses. Taken back, or with the paper under it replaced, it is dead.
//
// All of that is src/useDelegation.js (the hook) and src/authority (the keys,
// the signatures, the checks). In the browser-only book the hook works on its
// own practice copy of the demo book; with the real server it is the team's
// book and the server's /authority/* routes. This file is only the paper.

import React, { useEffect, useRef, useState } from 'react';
import useDelegation from '../../../useDelegation.js';
import { Btn, Field, Paper, Stamp } from '../../shell/parts.jsx';
import { day, dollars, ledger, shortDay } from '../../shell/money.mjs';
import { roleName } from '../../shell/roles.mjs';
import { decisionSays } from '../account/entries.mjs';
import { plainReasons, typedDollars } from '../account/acct-words.mjs';
import { saveFile } from '../records/save.mjs';
import { HANDS, recordTrouble, short, slipTrouble, timeLeft } from './plain.mjs';

const capital = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');
const toTheSecond = instant => new Date(instant).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
/** Today: the time to the second. Any other day: the day. Both by the reader's own clock. */
function when(instant) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  const local = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local(at) === local(new Date()) ? toTheSecond(at) : shortDay(local(at));
}
const STANDING = { proposed: 'prepared', approved: 'approved', stale: 'out of date', blocked: 'stopped by the house rules', executed: 'written in' };

export default function Slips({ service, route, say }) {
  const practice = service.mode === 'browser';
  const askedDecision = route.query.a || undefined, askedPromise = route.query.iou || undefined;
  // With the real server the hook opens on the decision the address names. The practice copy
  // only has the demo book's decisions, so there the page looks the decision up itself (below).
  const a = useDelegation(service, practice ? {} : { actionId: askedDecision, commitmentId: askedPromise });

  const [upTo, setUpTo] = useState('0');
  const [extra, setExtra] = useState('0');
  const [lasts, setLasts] = useState('120');
  const [nextUpTo, setNextUpTo] = useState('0');
  const [nextExtra, setNextExtra] = useState('0');
  const [paperText, setPaperText] = useState('');
  const [last, setLast] = useState('');            // the step last pressed: its refusal is printed beside it
  const [sameBack, setSameBack] = useState(false); // the very same request was sent again and the same receipt came back
  const [elsewhere, setElsewhere] = useState('');  // the address named a decision the practice book does not have
  const [queue, setQueue] = useState([]);          // what is left to do to the record, one thing per turn
  const [pasted, setPasted] = useState(false);     // the record in the box was typed or pasted in, so check that one
  const [now, setNow] = useState(() => Date.now());

  const view = a.snapshot?.view;
  const decision = a.selected, promise = a.commitment;
  const moves = a.simulation?.amountCents || 0;
  const brings = a.simulation?.economics?.incrementalRenewalCostCents || 0;

  useEffect(() => {
    setUpTo(typedDollars(moves)); setNextUpTo(typedDollars(moves));
    setExtra(typedDollars(brings)); setNextExtra(typedDollars(brings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.scopeKey, decision?.id]);
  useEffect(() => { setPaperText(a.boundSource?.text || ''); }, [a.scopeKey, a.boundSource?.id, a.boundSource?.revision]);

  // The practice book: open on the decision the address names, when the copy has it.
  const looked = useRef('');
  useEffect(() => {
    if (!practice || !view) return;
    const key = `${a.scopeKey}|${askedDecision}|${askedPromise}`;
    if (looked.current === key) return;
    looked.current = key;
    setElsewhere('');
    if (!askedDecision && !askedPromise) return;
    const wanted = view.actions.find(x => x.id === askedDecision);
    const its = view.commitments.find(c => c.id === (wanted?.commitmentId || askedPromise));
    if (wanted) { if (decision?.id !== wanted.id) a.selectAction(wanted.id); }
    else if (its) {
      const open = view.actions.find(x => x.commitmentId === its.id && !x.executed);
      if (open) a.selectAction(open.id); else a.selectCommitment(its.id);
      if (askedDecision) setElsewhere('That decision is in your own book. This bench practises on a separate copy, so here is the same promise.');
    } else setElsewhere('That decision is in your own book. This bench practises on a separate copy: pick one of its decisions.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, view, a.scopeKey, askedDecision, askedPromise]);

  const root = a.grant?.payload, leaf = a.chain.at(-1)?.payload;
  const used = Boolean(a.grantStatus?.consumedAt), takenBack = Boolean(a.grantStatus?.revokedAt);
  const ranOut = Boolean(leaf) && now >= Date.parse(leaf.expiresAt);
  const stale = Boolean(root) && !used && Boolean(decision) && (decision.status === 'stale' || decision.approvalStale || decision.proposalStale);
  const dead = used || takenBack || ranOut;

  // The clock on the slip runs while the slip is still good.
  useEffect(() => {
    if (!leaf || used || takenBack) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [leaf?.grantId, leaf?.expiresAt, used, takenBack]);

  /** Do one step. The hook answers null when it was refused, and keeps the reason. */
  async function act(step, doIt, done) {
    setLast(step);
    setSameBack(false);
    const out = await doIt();
    if (out === null) return null;
    if (done) say(done);
    return out;
  }

  // The record is checked in turns: fetch it, maybe spoil it, then check it. Each turn has to
  // see what the turn before left, so they run one per render.
  useEffect(() => {
    if (!queue.length || a.busy) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    if (next === 'fetch') { if (!a.packetText || !pasted) a.exportEvidence().then(packet => { if (!packet) setQueue([]); }); }
    else if (next === 'spoil') { if (a.packetText) { a.tamper(); setPasted(false); } else setQueue([]); }
    else if (next === 'check') { if (a.packetText) a.verify(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, a.busy]);

  if (!a.snapshot || !a.info) {
    return (
      <div className="bk-part bk-bench-desk">
        <p className="bk-hand">{a.error ? slipTrouble(a.error) || 'The book won’t open.' : practice ? 'Opening a practice book…' : 'Opening your team’s book…'}</p>
        {a.error && <Btn quiet onClick={a.refresh} busy={a.busy ? 'Trying…' : ''} style={{ marginTop: 12 }}>Try again</Btn>}
      </div>
    );
  }

  const company = id => view.vendors.find(v => v.id === id)?.name || 'A company';
  const offerOf = action => view.amendments.find(m => m.id === action?.payload?.amendmentId);
  const says = action => capital(decisionSays(action, offerOf(action), view.commitments.find(c => c.id === action.commitmentId), view.asOf));
  const pen = roleName(a.actor?.role).toLowerCase();
  const stopped = decision && a.simulation && !a.simulation.policyDecision.allowed
    ? plainReasons({ ...decision, policyDecision: a.simulation.policyDecision }, { policy: view.policy, asOf: view.asOf })
    : [];
  const trouble = step => (last === step && a.error ? slipTrouble(a.error) : '');
  const busyWith = (step, words) => (a.busy && last === step ? words : '');
  const hold = step => (a.busy && last !== step ? 'One second, the last step is still going.' : '');

  const whyPrepare = !promise ? 'Pick a promise first.'
    : !a.canPrepare ? `Waiting for an analyst or an approver. You are signed in as ${pen}.` : hold('prepare');
  const whyApprove = !decision ? 'Prepare a decision first.'
    : decision.status === 'approved' ? ''
    : decision.status === 'executed' ? 'It is already written in the book. Prepare a new one.'
    : decision.status === 'stale' || decision.proposalStale ? 'The papers changed since this was prepared. Prepare it again.'
    : stopped.length ? stopped.join(' ')
    : !a.canApprove ? `Waiting for an approver. You are signed in as ${pen}.` : hold('approve');
  const whyWrite = !decision || decision.status !== 'approved' ? (decision?.status === 'executed' ? 'This decision is already written in. Prepare a new one.' : 'Waits for an approval.')
    : stopped.length ? stopped.join(' ')
    : !a.canApprove ? `Waiting for an approver. You are signed in as ${pen}.` : hold('write');
  const whyHand = !leaf ? 'Write a slip first.'
    : used ? 'This slip has been used.' : takenBack ? 'This slip was taken back.' : ranOut ? 'This slip has run out.'
    : a.chain.length >= 4 ? 'Four hands is as far as one slip goes.' : hold('hand');
  const whyUse = !leaf ? 'Write a slip first.' : hold('use');
  const whyBack = !root ? 'Write a slip first.' : takenBack ? 'It has been taken back.'
    : !a.canApprove ? `Waiting for an approver. You are signed in as ${pen}.` : hold('back');
  const whyPaper = !a.boundSource ? 'This decision rests on no paper.'
    : used ? 'The slip has been used. Write another to see one go stale.'
    : !a.canRevise ? `Waiting for an analyst. You are signed in as ${pen}.`
    : paperText === a.boundSource.text || !paperText.trim() ? 'Change the text first.' : hold('paper');

  const trusted = Boolean(a.pinned);
  const checked = a.verification;

  return (
    <>
      <div className="bk-part bk-bench-slips">
        <ol className="bk-bench-todo">
          <li>
            <h3>Choose the promise and the decision</h3>
            <p className="bk-bench-note">{practice ? 'A separate practice book. Yours is not touched.' : 'This is your team’s real book. Using a slip writes the decision in it.'}</p>
            {elsewhere && <p className="bk-hand bk-bench-elsewhere">{elsewhere}</p>}
            <div className="bk-bench-pick">
              <Field label="The promise">
                <select value={promise?.id || ''} onChange={e => { setLast(''); a.selectCommitment(e.target.value); }} disabled={a.busy}>
                  {!promise && <option value="">{view.commitments.length ? 'Pick one' : 'No promises in this book yet'}</option>}
                  {view.commitments.map(c => <option key={c.id} value={c.id}>{company(c.vendorId)} · {c.reference}</option>)}
                </select>
              </Field>
              <Field label="The decision">
                <select value={decision?.id || ''} onChange={e => { setLast(''); if (e.target.value) a.selectAction(e.target.value); else a.selectCommitment(promise.id); }} disabled={a.busy || !promise}>
                  <option value="">A new one (prepare it below)</option>
                  {view.actions.filter(x => x.commitmentId === promise?.id).map(x => <option key={x.id} value={x.id}>{says(x)} · {STANDING[x.status] || x.status}</option>)}
                </select>
              </Field>
            </div>
            {decision && (
              <p className="bk-bench-says">
                It moves {dollars(moves)}{brings ? ` and brings ${dollars(brings)} of extra spending` : ''}.
                <small> {decision.id}</small>
              </p>
            )}
          </li>

          <li>
            <h3>Prepare a decision</h3>
            <div className="bk-actions">
              <Btn quiet={Boolean(decision) && !['stale', 'executed', 'blocked'].includes(decision.status)} onClick={() => act('prepare', a.fresh, 'Prepared. It waits for an approver.')} busy={busyWith('prepare', 'Preparing it…')} why={whyPrepare}>
                {decision ? 'Prepare a new one' : 'Prepare a decision'}
              </Btn>
              {decision && !whyPrepare && <span className="bk-hand">{decision.status === 'proposed' || decision.status === 'approved' ? 'Prepared' : capital(STANDING[decision.status] || decision.status)}{decision.proposedAt && (decision.status === 'proposed' || decision.status === 'approved') ? `, ${when(decision.proposedAt)}` : ''}</span>}
            </div>
            {trouble('prepare') && <p className="bk-bench-trouble" role="alert">{trouble('prepare')}</p>}
          </li>

          <li>
            <h3>Approve it</h3>
            <div className="bk-actions">
              {decision?.status === 'approved'
                ? <span className="bk-hand">Approved{decision.approval?.approvedAt ? `, ${when(decision.approval.approvedAt)}` : ''}</span>
                : <Btn onClick={() => act('approve', a.approve, 'Approved.')} busy={busyWith('approve', 'Approving it…')} why={whyApprove}>Approve it</Btn>}
            </div>
            {trouble('approve') && <p className="bk-bench-trouble" role="alert">{trouble('approve')}</p>}
          </li>

          <li>
            <h3>Write a permission slip</h3>
            <div className="bk-bench-limits">
              <Field label="Up to, USD" hint="the most it may move"><input inputMode="decimal" value={upTo} onChange={e => setUpTo(e.target.value)} /></Field>
              <Field label="Extra spending, USD" hint="the most it may bring"><input inputMode="decimal" value={extra} onChange={e => setExtra(e.target.value)} /></Field>
              <Field label="Lasts, seconds" hint="15 to 600"><input inputMode="numeric" value={lasts} onChange={e => setLasts(e.target.value)} /></Field>
            </div>
            <div className="bk-actions">
              <Btn onClick={() => act('write', () => a.issue(upTo, lasts, extra), 'Slip written and signed.')} busy={busyWith('write', 'Signing it…')} why={whyWrite}>
                {root ? 'Write a fresh slip' : 'Write a permission slip'}
              </Btn>
            </div>
            {trouble('write') && <p className="bk-bench-trouble" role="alert">{trouble('write')}</p>}
          </li>

          <li>
            <h3>Hand on a narrower one</h3>
            <div className="bk-bench-limits">
              <Field label="Up to, USD"><input inputMode="decimal" value={nextUpTo} onChange={e => setNextUpTo(e.target.value)} disabled={!leaf} /></Field>
              <Field label="Extra spending, USD"><input inputMode="decimal" value={nextExtra} onChange={e => setNextExtra(e.target.value)} disabled={!leaf} /></Field>
            </div>
            <div className="bk-actions">
              <Btn quiet onClick={() => act('hand', () => a.delegate(nextUpTo, nextExtra), 'Handed on, narrower.')} busy={busyWith('hand', 'Signing it over…')} why={whyHand}>Hand on a narrower one</Btn>
              {leaf && !whyHand && <span className="bk-why">The next hand gets a new key and 60 seconds at most. Four hands in all.</span>}
            </div>
            {trouble('hand') && <p className="bk-bench-trouble" role="alert">{trouble('hand')}</p>}
          </li>

          <li>
            <h3>{used ? 'Try to use it again' : 'Use it'}</h3>
            <div className="bk-actions">
              <Btn onClick={() => act('use', () => a.execute(false), used ? '' : 'Used once. Receipt printed.')} busy={busyWith('use', 'Asking the ledger…')} why={whyUse}>
                {used ? 'Try to use it again' : 'Use it'}
              </Btn>
              {a.receipt && (
                <Btn quiet onClick={async () => { const out = await act('same', () => a.execute(true), 'Same receipt. Nothing written twice.'); if (out) setSameBack(true); }} busy={busyWith('same', 'Sending it again…')} why={hold('same')}>
                  Send the very same request again
                </Btn>
              )}
            </div>
            {trouble('use') && <p className="bk-bench-trouble" role="alert">{trouble('use')}</p>}
            {trouble('same') && <p className="bk-bench-trouble" role="alert">{trouble('same')}</p>}
            {sameBack && <p className="bk-bench-fine" role="status">The same request came back with the same receipt. Nothing was written twice. <small>idempotent retry</small></p>}
          </li>

          <li>
            <h3>Take it back</h3>
            <div className="bk-actions">
              <Btn quiet onClick={() => act('back', a.revoke, 'Slip taken back.')} busy={busyWith('back', 'Taking it back…')} why={whyBack}>Take it back</Btn>
            </div>
            {trouble('back') && <p className="bk-bench-trouble" role="alert">{trouble('back')}</p>}
          </li>

          <li>
            <h3>Replace the paper under it</h3>
            {a.boundSource ? (
              <details className="bk-bench-paper">
                <summary>{a.boundSource.title} <small>on file since entry {a.boundSource.revision}</small></summary>
                <Field label="A newer text for this paper" hint={practice ? 'Any change will do. The slip was signed for the old text.' : 'This replaces the paper in your team’s real book.'}>
                  <textarea value={paperText} onChange={e => setPaperText(e.target.value)} maxLength={250000} />
                </Field>
              </details>
            ) : null}
            <div className="bk-actions">
              <Btn quiet onClick={() => act('paper', () => a.changeSource(paperText), 'Paper replaced.')} busy={busyWith('paper', 'Filing it…')} why={whyPaper}>Replace the paper</Btn>
            </div>
            {trouble('paper') && <p className="bk-bench-trouble" role="alert">{trouble('paper')}</p>}
          </li>
        </ol>

        <div className="bk-bench-slipside">
          <Slip
            a={a} leaf={leaf} root={root} now={now}
            says={decision ? says(decision) : ''}
            whose={promise ? `${company(promise.vendorId)} · ${promise.reference}` : ''}
            moves={moves} used={used} takenBack={takenBack} ranOut={ranOut} stale={stale} dead={dead}
          />
          {a.receipt && <Receipt receipt={a.receipt} says={decision ? says(decision) : ''} promise={promise} />}
        </div>
      </div>

      <div className="bk-part bk-bench-record">
        <h2 className="bk-h2">The record <small>every slip, every use, signed · lifecycle + receipts</small></h2>
        <p className="bk-bench-signer">
          Signed by <b>{short(a.info.fingerprint || a.info.keyId, 16)}</b>
          {trusted ? <span className="bk-hand"> Trusted for this visit.</span> : <span className="bk-muted"> Nobody here has said they trust this key yet.</span>}
        </p>
        <div className="bk-actions">
          <Btn onClick={async () => { const packet = await act('record', a.exportEvidence, ''); if (packet) { setPasted(false); saveFile('truthful-authority-evidence.json', JSON.stringify(packet, null, 2), 'application/json'); say('Record downloaded.'); } }} busy={busyWith('record', 'Fetching it…')} why={hold('record')}>Download the record</Btn>
          <Btn quiet onClick={() => { a.pin(); say('Signer trusted for this visit.'); }} why={trusted ? 'Trusted.' : ''}>Trust this signer</Btn>
          <Btn quiet onClick={() => { setLast('check'); setQueue(['fetch', 'check']); }} busy={a.busy && last === 'check' ? 'Checking it…' : ''} why={hold('check')}>Check the record</Btn>
          <Btn quiet onClick={() => { setLast('check'); setQueue(['fetch', 'spoil', 'check']); }} why={!trusted ? 'Trust the signer first, so the spoiled signature is the only thing wrong.' : hold('check')}>Spoil a signature and check again</Btn>
          <Btn quiet onClick={() => { saveFile('truthful-pinned-issuer.json', JSON.stringify([{ issuer: a.info.issuer, keyId: a.info.keyId, publicKey: a.info.publicKey }], null, 2), 'application/json'); say('Public key downloaded.'); }}>Download the public key</Btn>
        </div>
        {(trouble('check') || trouble('record')) && <p className="bk-bench-trouble" role="alert">{trouble('check') || trouble('record')}</p>}
        {checked && (
          <div className="bk-bench-checked" role="status">
            {checked.valid
              ? <><Stamp small seed={`checks-${checked.generatedAt}`} land>Checks out</Stamp><p className="bk-bench-fine">{checked.lifecycleEntries} signed {checked.lifecycleEntries === 1 ? 'entry' : 'entries'} in order, {checked.executions} {checked.executions === 1 ? 'use' : 'uses'} replayed against the ledger. <small>as of {day(checked.generatedAt)}, {toTheSecond(checked.generatedAt)}</small></p></>
              : <p className="bk-bench-trouble">{recordTrouble(checked)} <small>{checked.code}</small></p>}
          </div>
        )}
        <details className="bk-bench-paper">
          <summary>The record, typed <small>JSON</small></summary>
          <Field label="Paste a record from somewhere else to check that one" hint="Checking tells you the slips, uses and receipts in this file were signed by the key you trust. It cannot know what happened after the file was made.">
            <textarea className="bk-bench-json" value={a.packetText} onChange={e => { setPasted(true); a.setPacketText(e.target.value); }} maxLength={1000000} spellCheck={false} placeholder="Download the record and it shows here." />
          </Field>
        </details>
        <p className="bk-bench-foot">
          <button type="button" className="bk-link" onClick={() => act('reread', a.refresh, '')} disabled={a.busy}>Read the book again</button>
          {' '}{practice ? 'The keys are made for this visit and are gone when you leave.' : `You are ${a.actor?.name || a.actor?.id}, holding the ${pen}’s pen.`}
        </p>
      </div>
    </>
  );
}

/** The slip itself: bond, perforated at the foot, with a stub. Blank until one is written. */
function Slip({ a, leaf, root, now, says, whose, moves, used, takenBack, ranOut, stale, dead }) {
  const hand = a.chain.length;
  const stamp = used ? { word: 'Used', sub: toTheSecond(a.grantStatus.consumedAt) }
    : takenBack ? { word: 'Taken back', sub: toTheSecond(a.grantStatus.revokedAt) }
    : ranOut ? { word: 'Run out', sub: toTheSecond(leaf.expiresAt) }
    : stale ? { word: 'Stale', sub: 'the paper changed' } : null;
  const also = [used && takenBack && `taken back ${toTheSecond(a.grantStatus.revokedAt)}`, (used || takenBack) && stale && 'the paper under it changed'].filter(Boolean);
  return (
    <Paper className={leaf ? 'bk-form bk-bench-slip' : 'bk-form bk-bench-slip is-blank'} w={118} rot={0.6} edge="perf-bottom" aria-label="The permission slip">
      <span className="bk-doc-kind">Permission slip <b>{root ? `No. ${short(root.grantId)}` : 'not written yet'}</b></span>
      <span className="bk-label">Good for</span>
      <p className="bk-bench-goodfor">{says || 'No decision chosen'}</p>
      <p className="bk-bench-whose">{whose}{says && ` · ${dollars(moves)} · this one decision, once`}</p>
      {stamp && <Stamp className="bk-bench-slipstamp" seed={`slip-${root.grantId}-${stamp.word}`} sub={stamp.sub} land>{stamp.word}</Stamp>}

      <div className="bk-boxes bk-bench-slipboxes">
        <div className="bk-box"><span>Up to</span><b>{leaf ? dollars(leaf.maxAmountCents) : ''}</b></div>
        <div className="bk-box"><span>Extra spending</span><b>{leaf ? dollars(leaf.maxObligationCents) : ''}</b></div>
        <div className="bk-box bk-bench-until">
          <span>Until</span>
          <b>{leaf ? toTheSecond(leaf.expiresAt) : ''}</b>
          {leaf && <em className={dead ? 'is-over' : undefined} aria-live="off">{used ? 'used' : takenBack ? 'taken back' : ranOut ? 'run out' : `${timeLeft(Date.parse(leaf.expiresAt) - now)} left`}</em>}
        </div>
        <div className="bk-box"><span>Signed by</span><b>{short(a.info.fingerprint || a.info.keyId, 10)}</b><small>the book’s key</small></div>
        <div className="bk-box"><span>Held by</span><b>{leaf ? short(leaf.agentPublicKey?.x, 10) : ''}</b>{leaf && <small>the {HANDS[hand - 1] || `${hand}th`} hand’s key</small>}</div>
      </div>
      {also.length > 0 && <p className="bk-bench-also">Also: {also.join(', ')}.</p>}

      <i className="perf-line" />
      <div className="bk-bench-stub">
        <span className="bk-label">Stub</span>
        {leaf ? (
          <ol>
            {a.chain.map((grant, i) => (
              <li key={grant.payload.grantId}>
                {capital(HANDS[i] || `${i + 1}th`)} hand: up to {dollars(grant.payload.maxAmountCents)}{grant.payload.maxObligationCents ? `, ${dollars(grant.payload.maxObligationCents)} extra` : ''}, until {toTheSecond(grant.payload.expiresAt)}
              </li>
            ))}
          </ol>
        ) : <p>Write a slip and its number, limits and hands are kept here.</p>}
        {root && <small>approval {short(root.approvalBasisDigest, 12)} · nonce {short(root.rootNonce)}</small>}
      </div>
    </Paper>
  );
}

/** What the ledger printed when the slip was used: a narrow strip of till paper. */
function Receipt({ receipt, says, promise }) {
  const r = receipt.payload || {};
  const owed = side => side?.commitments?.find(c => c.id === promise?.id)?.outstandingCents;
  const before = owed(r.beforeFinancial), after = owed(r.afterFinancial);
  return (
    <Paper as="div" className="bk-bench-receipt" w={74} rot={-1.4} aria-label="The receipt">
      <b className="bk-bench-rhead">Receipt</b>
      <p>{day(r.at)} · {r.at ? toTheSecond(r.at) : ''}</p>
      <p className="bk-bench-rsaid">Written in: {says || r.command?.actionId}</p>
      <dl>
        <div><dt>No.</dt><dd>{short(r.receiptId)}</dd></div>
        <div><dt>Book revision</dt><dd>{r.beforeRevision} → {r.afterRevision}</dd></div>
        {Number.isSafeInteger(before) && Number.isSafeInteger(after) && <div><dt>Still owed</dt><dd>{ledger(before)} → {ledger(after)}</dd></div>}
        <div><dt>Written by</dt><dd>{short(String(r.actor?.id || '').replace(/^agent:/, ''), 10)}</dd></div>
        <div><dt>Slip</dt><dd>{short(r.rootNonce)}</dd></div>
        <div><dt>Request</dt><dd>{short(r.requestDigest, 12)}</dd></div>
        <div><dt>Audit hash</dt><dd>{short(r.auditHash, 12)}</dd></div>
        <div><dt>Signature</dt><dd>{short(receipt.signature, 12)}</dd></div>
      </dl>
      <p className="bk-bench-rfoot">Good once. Used.</p>
    </Paper>
  );
}
