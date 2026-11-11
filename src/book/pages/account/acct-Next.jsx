// What's next on one promise: the vendor's offers as manila tags, the decision
// slip with its three boxes for initials, and the house rules behind it.
//
// Three people, three commands: PROPOSE_ACTION (analyst or approver) prepares a
// decision, APPROVE_ACTION (approver) approves it, EXECUTE_ACTION (bookkeeper)
// writes it in. DISMISS_AMENDMENT (approver) declines an offer. Anything that
// changes the book's money or papers makes every open decision stale; a stale
// one is prepared again, never approved.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { originalReviewState } from '../../../assurance-ui.mjs';
import { reducedMotion, tagString } from '../../kit/paper.js';
import { Btn, Close, Field, Over, Paper, Stamp, Why, cx } from '../../shell/parts.jsx';
import { clock, day, dollars, shortDay, stampDay } from '../../shell/money.mjs';
import { plainError, roleName, waitsFor, whyNot } from '../../shell/roles.mjs';
import { localDay, offerKind, offerWords, whoWrote } from './entries.mjs';
import { centsFrom, isHouseRule, plainReason, plainReasons, typedDollars } from './acct-words.mjs';

const REASON_MAX = 200;                    // the book stops a reason for declining at 200 characters
const COUNT = ['no offers', 'one offer', 'two offers', 'three offers', 'four offers', 'five offers'];
const STRINGS = [{ dx: -5, dy: -15, sag: 4 }, { dx: 4, dy: -16, sag: -3 }, { dx: -3, dy: -16, sag: 3 }];
const TURNS = [-1.6, 1.3, -0.8, 1.8];
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : '');

export default function Next({ service, view, commitment, state, say, wanted, active }) {
  const [pick, setPick] = useState(null);          // which slip is out: { offer: id } | { original: true } | null (the usual one)
  const [doing, setDoing] = useState('');          // the write in flight, so its button can say so
  const [declining, setDeclining] = useState('');  // the offer whose reason is being written
  const [landed, setLanded] = useState('');        // the decision approved a moment ago: its stamp comes down
  const [rules, setRules] = useState(false);
  const slipRef = useRef(null);
  const bring = useRef(false);

  const year = view.asOf.slice(0, 4);
  const pen = { actor: service.actor };            // who is holding the pen, without the "one second" of a write in flight
  const role = roleName(service.actor?.role).toLowerCase();
  const busy = Boolean(service.busy);
  const actions = useMemo(() => view.actions.filter(a => a.commitmentId === commitment.id), [view, commitment.id]);
  const offers = useMemo(() => view.amendments.filter(m => m.commitmentId === commitment.id), [view, commitment.id]);
  const original = useMemo(() => originalReviewState(service.workspace, view, commitment), [service.workspace, view, commitment]);
  const pending = offers.filter(m => !m.accepted && !m.rejected && !m.superseded);
  const latestFor = id => actions.findLast(a => a.payload?.amendmentId === id) || null;

  // #/iou/<id>?a=<actionId> brings that decision's slip forward.
  useEffect(() => {
    const action = wanted && view.actions.find(a => a.id === wanted && a.commitmentId === commitment.id);
    if (!action) return;
    setPick(action.type === 'accept_amendment' ? { offer: action.payload.amendmentId } : { original: true });
    bring.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  // Which slip is on the page.
  const slipOfOffer = id => {
    const offer = offers.find(m => m.id === id);
    if (!offer || offer.rejected) return null;
    return { kind: 'offer', offer, action: latestFor(id), spec: { commitmentId: commitment.id, type: 'accept_amendment', payload: { amendmentId: id } } };
  };
  const slipOfOriginal = asked => {
    if (state === 'offer') return null;                                  // an offer with strings has no plain promise to keep
    const action = original.action;
    const whole = { kind: 'original', action, spec: original.specification };
    const live = action && (action.executed || !(action.proposalStale || action.approvalStale));
    if (live) return asked || state !== 'paid' ? whole : null;
    // Nothing live. A slip to prepare (or prepare again) is only worth putting out if it could then be approved.
    if (state === 'paid' || !original.simulation?.policyDecision.allowed) return asked && action ? whole : null;
    return whole;
  };
  const slip = (pick?.offer && slipOfOffer(pick.offer)) || slipOfOriginal(Boolean(pick?.original));

  useEffect(() => {
    if (!bring.current || !active || !slipRef.current) return;
    bring.current = false;
    slipRef.current.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    slipRef.current.querySelector('h3')?.focus({ preventScroll: true });
  });

  async function send(key, command, done, then) {
    setDoing(key);
    try {
      const reply = await service.command(command);
      if (reply) { say(done); then?.(reply); }
    } catch (error) {
      say(plainError(error), { wrong: true });
      service.setError?.('');
    } finally {
      setDoing('');
    }
  }
  const show = next => { setPick(next); setLanded(''); bring.current = true; };
  const prepare = (spec, key, done = 'Decision prepared.') => send(key, { type: 'PROPOSE_ACTION', action: spec }, done, () => show(spec.type === 'accept_amendment' ? { offer: spec.payload.amendmentId } : { original: true }));
  const take = offer => (latestFor(offer.id) ? show({ offer: offer.id }) : prepare({ commitmentId: commitment.id, type: 'accept_amendment', payload: { amendmentId: offer.id } }, `take:${offer.id}`));
  const keepOriginal = () => (original.action ? show({ original: true }) : prepare(original.specification, 'keep'));
  const decline = (offer, reason) => send(`decline:${offer.id}`, { type: 'DISMISS_AMENDMENT', amendmentId: offer.id, reason }, 'Offer declined.', () => setDeclining(''));

  const nothing = !slip && !pending.length;
  return (
    <section className="bk-part bk-acct-next" aria-labelledby="bk-acct-next-h">
      <h2 className="bk-h2" id="bk-acct-next-h">What’s next</h2>

      {(nothing || state === 'paid') && <p className="bk-hand bk-acct-rest">{restLine(state, original, offers, view)}</p>}

      {offers.length > 0 && (
        <>
          {pending.length > 0 && (
            <p className="bk-typed bk-acct-lead">
              {state === 'offer'
                ? 'Their offer has a string attached.'
                : state === 'paid'
                  ? `${cap(COUNT[pending.length] || `${pending.length} offers`)} from before ${pending.length === 1 ? 'is' : 'are'} still open.`
                  : `They answered with ${COUNT[pending.length] || `${pending.length} offers`}.`}
            </p>
          )}
          <div className="bk-acct-tags">
            {offers.map((offer, i) => (
              <Tag
                key={offer.id}
                offer={offer} index={i} commitment={commitment} view={view} year={year}
                action={latestFor(offer.id)}
                out={slip?.offer?.id === offer.id}
                pen={pen} role={role} busy={busy} doing={doing}
                declining={declining === offer.id}
                onTake={() => take(offer)}
                onDeclining={on => setDeclining(on ? offer.id : '')}
                onDecline={reason => decline(offer, reason)}
              />
            ))}
          </div>
        </>
      )}

      {slip && (
        <Slip
          slipRef={slipRef}
          key={`${slip.kind}:${slip.offer?.id || ''}`}
          slip={slip} commitment={commitment} view={view} year={year} state={state}
          pen={pen} busy={busy} doing={doing} landed={landed}
          canKeep={slip.kind === 'offer' && state !== 'offer' && !slip.action?.executed}
          keepWhy={original.action ? '' : whyNot('PROPOSE_ACTION', pen)}
          onPrepare={() => prepare(slip.spec, 'prepare', slip.action ? 'Prepared again.' : 'Decision prepared.')}
          onApprove={() => send('approve', { type: 'APPROVE_ACTION', actionId: slip.action.id }, 'Approved.', () => setLanded(slip.action.id))}
          onWrite={() => send('write', { type: 'EXECUTE_ACTION', actionId: slip.action.id }, 'Written in the book.')}
          onKeep={keepOriginal}
          onRules={() => setRules(true)}
        />
      )}

      {!slip && pending.length > 0 && (
        <p className="bk-acct-rules-line"><button type="button" className="bk-link" onClick={() => setRules(true)}>House rules</button></p>
      )}

      {rules && <HouseRules service={service} view={view} say={say} onClose={() => setRules(false)} />}
    </section>
  );
}

/** The one line in pen when there is nothing to decide. */
function restLine(state, original, offers, view) {
  if (state === 'paid') return 'Paid in full. Nothing left to do.';
  if (state === 'offer') return offers.some(m => m.rejected) ? 'You declined their offer. Nothing is owed.' : 'Nothing to decide until they make an offer you can take.';
  const stopped = original.simulation?.policyDecision;
  if (stopped && !stopped.allowed) return `Nothing to do yet. ${plainReason(stopped.reasons[0], { policy: view.policy, asOf: view.asOf })}`;
  return 'Nothing to do right now.';
}

/** A renewal's sums: the credit it buys, the extra spending it brings, and what that leaves you paying. */
function renewalSums(offer, action, commitment) {
  const economics = action?.executed ? action.execution?.economics : action?.economics;
  if (economics) {
    return {
      creditCents: economics.creditCents, extraCents: economics.incrementalRenewalCostCents,
      costCents: economics.incrementalRenewalCostCents - economics.creditCents,
      anywayCents: economics.baselineCostCents, renewalCents: economics.proposedRenewalCostCents,
    };
  }
  const words = offerWords(offer, commitment);
  return { creditCents: words.creditCents, extraCents: words.extraCents, costCents: words.costCents, anywayCents: offer.baselineCostCents || 0, renewalCents: (offer.baselineCostCents || 0) + words.extraCents };
}

// ---- an offer, on a manila tag ----

function Tag({ offer, index, commitment, view, year, action, out, pen, role, busy, doing, declining, onTake, onDeclining, onDecline }) {
  const [reason, setReason] = useState('');
  const [wrong, setWrong] = useState('');
  const declineLink = useRef(null);
  const before = { promisedCents: commitment.promisedCents, verifiedCents: commitment.verifiedCents, dueDate: offer.accepted ? commitment.originalDueDate : commitment.dueDate };
  const words = offerWords(offer, before, view.asOf);
  const sums = words.kind === 'renewal' ? renewalSums(offer, action, commitment) : null;
  const open = !offer.accepted && !offer.rejected && !offer.superseded;

  const takeRole = action ? '' : whyNot('PROPOSE_ACTION', pen);
  const declineRole = whyNot('DISMISS_AMENDMENT', pen);
  const waits = [];
  if (offer.basisStale) waits.push('The promise changed after they made this offer. Ask them to make it again.');
  else if (takeRole) waits.push(`Taking it waits for ${waitsFor('PROPOSE_ACTION')}.`);
  if (declineRole) waits.push(`Declining it waits for ${waitsFor('DISMISS_AMENDMENT')}.`);
  if ((takeRole && !offer.basisStale) || declineRole) waits.push(`You are signed in as ${role}.`);

  function stop() {
    setReason(''); setWrong('');
    onDeclining(false);
    requestAnimationFrame(() => declineLink.current?.focus());
  }
  function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) { setWrong('Say why, even in a few words.'); return; }
    onDecline(text);
  }

  return (
    <article
      className={cx('paper bk-tag bk-acct-tag', offer.rejected && 'is-torn', out && 'is-out')}
      style={{ '--W': 82, '--rot': `${TURNS[index % TURNS.length]}deg` }}
      aria-label={`Their offer: ${words.title}`}
    >
      <div className="paper-face stock-manila tag-face">
        <i className="tag-eye" aria-hidden="true" />
        <Stamp small seed={`only-if-${offer.id}`}>Only if</Stamp>
        <h3 className="bk-tag-title">{words.title}</h3>
        <p className="bk-tag-said">
          {sums ? `A ${dollars(sums.creditCents)} credit if you spend ${dollars(sums.extraCents)} more.` : words.said}
          {sums && <b className="bk-acct-cost"> {sums.costCents > 0 ? `That costs you ${dollars(sums.costCents)}.` : sums.costCents < 0 ? `That leaves you ${dollars(-sums.costCents)} ahead.` : 'The credit pays for the extra spending.'}</b>}
        </p>

        {offer.rejected && (
          <p className="bk-tag-said bk-acct-tag-end">
            Declined {shortDay(localDay(offer.dismissal?.observedAt), year)}: ‘{String(offer.dismissal?.reason || '').replace(/\.$/, '')}’
          </p>
        )}
        {offer.accepted && (
          <p className="bk-tag-said bk-acct-tag-end">
            <Stamp small seed={`taken-${offer.id}`}>Taken</Stamp>
            Taken {shortDay(localDay(offer.acceptedAt), year)}. It counts from {shortDay(offer.effectiveDate, year)}.
          </p>
        )}
        {offer.superseded && !offer.accepted && !offer.rejected && <p className="bk-tag-said bk-acct-tag-end">A newer offer took its place.</p>}

        {open && !declining && (
          <>
            <div className="bk-actions">
              <Btn onClick={onTake} disabled={busy || offer.basisStale || Boolean(takeRole)} busy={doing === `take:${offer.id}` ? 'Preparing…' : ''}>Take it</Btn>
              <button ref={declineLink} type="button" className="bk-link" disabled={busy || Boolean(declineRole)} onClick={() => onDeclining(true)}>Decline</button>
            </div>
            <Why>{waits.join(' ')}</Why>
          </>
        )}

        {open && declining && (
          <form className="bk-acct-decline" onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); stop(); } }}>
            <Field label="Why are you declining?" wrong={wrong} hint={`${REASON_MAX - reason.length} of ${REASON_MAX} characters left`}>
              <textarea rows={3} maxLength={REASON_MAX} value={reason} autoFocus onChange={event => { setReason(event.target.value); setWrong(''); }} />
            </Field>
            <div className="bk-actions">
              <Btn as="button" type="submit" disabled={busy} busy={doing === `decline:${offer.id}` ? 'Declining…' : ''}>Decline it</Btn>
              <button type="button" className="bk-link" onClick={stop}>Keep it open</button>
            </div>
          </form>
        )}
      </div>
      <span className="bk-acct-string" dangerouslySetInnerHTML={{ __html: tagString(STRINGS[index % STRINGS.length]) }} />
    </article>
  );
}

// ---- the decision slip ----

function slipTitle(slip, commitment, year, asOf) {
  if (slip.kind === 'original') {
    // A stale slip is headed with what preparing it again would decide, which may have changed with the book.
    const live = slip.action && (slip.action.executed || !(slip.action.proposalStale || slip.action.approvalStale));
    const type = live ? slip.action.type : slip.spec.type;
    const amount = dollars(live ? slip.action.amountCents : commitment.outstandingCents);
    const rest = commitment.verifiedCents > 0;
    if (type === 'preserve_original') return rest ? `Keep the original promise and ask for the rest: ${amount}` : `Keep the original promise and ask for the ${amount}`;
    return rest ? `Ask them for the rest: ${amount}` : `Ask them for the ${amount}`;
  }
  const kind = offerKind(slip.offer);
  const before = { promisedCents: commitment.promisedCents, verifiedCents: commitment.verifiedCents, dueDate: slip.offer.accepted ? commitment.originalDueDate : commitment.dueDate };
  const words = offerWords(slip.offer, before, asOf);
  if (kind === 'renewal') return 'Take the renewal';
  if (kind === 'date') return `Take the ${words.title === 'Pay sooner' ? 'earlier' : 'later'} date: ${words.said.replace(/\.$/, '')}`;
  if (kind === 'amount') return `Take the new amount: ${words.said.replace(/\.$/, '')}`;
  return 'Take their changed terms';
}

function Slip({ slipRef, slip, commitment, view, year, pen, busy, doing, landed, canKeep, keepWhy, onPrepare, onApprove, onWrite, onKeep, onRules }) {
  const { action, offer } = slip;
  const done = Boolean(action?.executed);
  const stale = Boolean(action && !done && (action.proposalStale || action.approvalStale));
  const approved = Boolean(action?.approval) && !stale;
  const next = !action || stale ? 'prepare' : done ? '' : approved ? 'write' : 'approve';
  const stopped = action && !done && !stale ? plainReasons(action, { policy: view.policy, asOf: view.asOf }) : [];
  const byRules = action?.policyDecision?.allowed === false && action.policyDecision.reasons.some(isHouseRule);
  const stoppedWhy = stopped.length ? (byRules ? 'The house rules stop this.' : stopped[0]) : '';
  const when = (actor, instant) => (actor?.id === 'seed-curator' ? shortDay(localDay(instant), year) : `${shortDay(localDay(instant), year)}, ${clock(instant)}`);
  const sums = offer && offerKind(offer) === 'renewal' ? renewalSums(offer, action, commitment) : null;
  // The shared Btn lets a `disabled` it is handed win over its `why`, so each is spelled out in full here.
  const prepareWhy = whyNot('PROPOSE_ACTION', pen);
  const approveWhy = stoppedWhy || whyNot('APPROVE_ACTION', pen);
  const writeWhy = stoppedWhy || whyNot('EXECUTE_ACTION', pen);

  return (
    <Paper ref={slipRef} as="article" w={236} rot={0.35} className="bk-form bk-acct-decision" aria-label="The decision">
      <h3 className="bk-form-title" tabIndex={-1}>{slipTitle(slip, commitment, year, view.asOf)}<small>DECISION</small></h3>

      {sums && (
        <div className="bk-boxes bk-acct-sums">
          {sums.anywayCents > 0 && <div className="bk-box"><span>The renewal</span><b>{dollars(sums.renewalCents)}</b></div>}
          {sums.anywayCents > 0 && <div className="bk-box"><span>You would spend anyway</span><b>{dollars(sums.anywayCents)}</b></div>}
          <div className="bk-box"><span>Extra spending</span><b>{dollars(sums.extraCents)}</b></div>
          <div className="bk-box"><span>Their credit</span><b>{dollars(sums.creditCents)}</b></div>
          <div className="bk-box"><span>{sums.costCents >= 0 ? 'It costs you' : 'It leaves you ahead'}</span><b className="bk-acct-strong">{dollars(Math.abs(sums.costCents))}</b></div>
        </div>
      )}
      {offer && offerKind(offer) === 'date' && (
        <div className="bk-boxes bk-acct-sums">
          <div className="bk-box"><span>{offer.accepted ? 'It was due' : 'Due now'}</span><b>{day(offer.accepted ? commitment.originalDueDate : commitment.dueDate)}</b></div>
          <div className="bk-box"><span>{offer.accepted ? 'Due now' : 'Due if you take it'}</span><b>{day(offer.patch.dueDate)}</b></div>
          <div className="bk-box"><span>Still owed either way</span><b>{dollars(commitment.outstandingCents)}</b></div>
        </div>
      )}

      <ol className="bk-route bk-acct-route">
        <li className={cx(next === 'prepare' ? 'is-now' : 'is-done')}>
          <span>Prepared by</span>
          {action && !stale && <><b>{cap(whoWrote(action.proposedBy))}</b><small>{when(action.proposedBy, action.proposedAt)}</small></>}
          {stale && <small className="bk-acct-stale">The book changed since {whoWrote(action.proposedBy)} prepared this on {shortDay(localDay(action.proposedAt), year)}.</small>}
          {next === 'prepare' && (
            <div className="bk-acct-act">
              <Btn onClick={onPrepare} why={prepareWhy} disabled={busy || Boolean(prepareWhy)} busy={doing === 'prepare' ? 'Preparing…' : ''}>{stale ? 'Prepare it again' : 'Prepare it'}</Btn>
            </div>
          )}
        </li>
        <li className={cx(approved || done ? 'is-done' : next === 'approve' && 'is-now')}>
          <span>Approved by</span>
          {(approved || done) && action.approval && (
            <>
              <b>{cap(whoWrote(action.approval.actor))}</b>
              <div className="bk-acct-approved">
                <Stamp seed={`approved-${action.id}`} sub={`${stampDay(localDay(action.approval.approvedAt))} · ${clock(action.approval.approvedAt)}`} land={landed === action.id}>Approved</Stamp>
              </div>
            </>
          )}
          {next === 'approve' && (
            <div className="bk-acct-act">
              <Btn onClick={onApprove} why={approveWhy} disabled={busy || Boolean(approveWhy)} busy={doing === 'approve' ? 'Approving…' : ''}>Approve it</Btn>
            </div>
          )}
          {next === 'prepare' && <b className="bk-muted">{stale ? 'waits for it to be prepared again' : 'waits for it to be prepared'}</b>}
        </li>
        <li className={cx(done ? 'is-done' : next === 'write' && 'is-now')}>
          <span>Written in by</span>
          {done && <><b>{cap(whoWrote(action.execution?.actor))}</b><small>{when(action.execution?.actor, action.execution?.executedAt)}</small></>}
          {next === 'write' && (
            <div className="bk-acct-act">
              <Btn onClick={onWrite} why={writeWhy} disabled={busy || Boolean(writeWhy)} busy={doing === 'write' ? 'Writing it in…' : ''}>Write it in the book</Btn>
            </div>
          )}
          {(next === 'prepare' || next === 'approve') && <b className="bk-muted">waits for an approval</b>}
        </li>
      </ol>

      {stopped.length > 0 && (byRules || stopped.length > 1) && (
        <div className="bk-acct-stopped">
          <p className="bk-label">Why it is stopped</p>
          <ul>{stopped.map(reason => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}

      <div className="bk-actions bk-acct-decision-foot">
        {canKeep && <Btn quiet onClick={onKeep} why={keepWhy} disabled={busy || Boolean(keepWhy)} busy={doing === 'keep' ? 'Preparing…' : ''}>Keep the original promise</Btn>}
        <button type="button" className="bk-link" onClick={onRules}>House rules</button>
      </div>
    </Paper>
  );
}

// ---- the house rules ----

function HouseRules({ service, view, say, onClose }) {
  const policy = view.policy;
  const [claim, setClaim] = useState(() => typedDollars(policy.claimLimitCents));
  const [extra, setExtra] = useState(() => typedDollars(policy.renewalLimitCents));
  const [allow, setAllow] = useState(Boolean(policy.allowNewCommitments));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const why = whyNot('SET_POLICY', { actor: service.actor });
  const claimCents = centsFrom(claim), extraCents = centsFrom(extra);
  const shape = 'Dollars, like 5,000 or 5,000.50.';

  async function save(event) {
    event.preventDefault();
    setTried(true);
    if (claimCents == null || extraCents == null) return;
    setSaving(true);
    try {
      const reply = await service.command({ type: 'SET_POLICY', policy: { claimLimitCents: claimCents, renewalLimitCents: extraCents, allowNewCommitments: allow } });
      if (reply) { say('House rules changed.'); onClose(); }
    } catch (error) {
      say(plainError(error), { wrong: true });
      service.setError?.('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Over onClose={onClose} label="House rules">
      <Paper w={128} rot={-0.5} className="bk-form bk-acct-rules">
        <Close onClose={onClose} />
        <h2 className="bk-form-title">House rules<small>THE OWNER SETS THESE</small></h2>
        <p className="bk-typed bk-acct-rules-said">A decision has to fit inside these before anyone can approve it.</p>
        <form onSubmit={save}>
          <div className="bk-fields">
            <Field label="The most a claim may be (USD)" wrong={tried && claimCents == null ? shape : ''}>
              <input inputMode="decimal" autoComplete="off" data-autofocus="" readOnly={Boolean(why)} value={claim} onChange={event => setClaim(event.target.value)} />
            </Field>
            <Field label="The most extra spending a renewal may bring (USD)" wrong={tried && extraCents == null ? shape : ''}>
              <input inputMode="decimal" autoComplete="off" readOnly={Boolean(why)} value={extra} onChange={event => setExtra(event.target.value)} />
            </Field>
          </div>
          <label className="bk-check bk-acct-rules-check">
            <input type="checkbox" checked={allow} disabled={Boolean(why)} onChange={event => setAllow(event.target.checked)} />
            An offer may add a new obligation
          </label>
          <p className="bk-why bk-acct-rules-note">Changing a rule makes every open decision stale. Each one gets prepared again.</p>
          <Btn as="button" type="submit" why={why} disabled={Boolean(service.busy) || Boolean(why)} busy={saving ? 'Saving…' : ''}>Save the rules</Btn>
        </form>
      </Paper>
    </Over>
  );
}
