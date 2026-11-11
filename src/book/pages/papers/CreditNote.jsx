// One credit note: the note itself on pink carbon, a stamp saying whether it has
// reached an invoice, where its money went, the promises it is matched to and the
// papers behind it. Nothing is changed here; its forms are on the account page.

import React, { useEffect, useRef } from 'react';
import { Paper, Stamp, cx } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { day, dollars, ledger, stampDay } from '../../shell/money.mjs';
import { creditMatches, creditMoney, creditNoun, creditPapers, paperItem } from './kinds.mjs';
import { Missing, Strip } from './Reading.jsx';
import { PaperThumb } from './Thumb.jsx';

export default function CreditNote({ view, creditId, back }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [creditId]);

  const credit = view.credits.find(item => item.id === creditId);
  if (!credit) return <Missing back={back} title="That credit note isn’t on file." />;

  const company = view.vendors.find(vendor => vendor.id === credit.vendorId)?.name || 'A company not in the book';
  const noun = creditNoun(view, credit);
  const onInvoice = credit.status === 'applied';
  const money = creditMoney(credit);
  const promise = id => view.commitments.find(item => item.id === id);
  const nameOf = id => {
    const found = promise(id);
    if (!found) return 'A promise that is no longer in the book';
    return `${view.vendors.find(vendor => vendor.id === found.vendorId)?.name || company}’s ${found.conditions?.length ? 'offer' : 'promise'} of ${dollars(found.promisedCents)}`;
  };
  const matches = creditMatches(credit);
  const could = credit.quarantined ? credit.candidateCommitmentIds.filter(promise) : [];
  const limits = credit.resolution?.assignments || [];
  const papers = creditPapers(view, credit);
  const home = [...matches.map(match => match.commitmentId), ...credit.candidateCommitmentIds].find(promise);
  const todo = money.unmatchedCents > 0 || credit.quarantined ? 'Match it' : onInvoice ? 'See it' : 'Add its invoice';
  const share = cents => (money.noteCents > 0 ? { flexGrow: cents } : null);
  const amount = `$${ledger(credit.amountCents)}`;
  const matchRow = match => {
    const found = promise(match.commitmentId);
    const inside = (
      <>
        <span>
          <b>{nameOf(match.commitmentId)}</b>
          {found && <small>{found.reference} · due {day(found.dueDate)}</small>}
        </span>
        <em>{ledger(match.amountCents)}</em>
      </>
    );
    return found ? <a className="bk-pap-match" href={href('iou', found.id)}>{inside}</a> : <div className="bk-pap-match">{inside}</div>;
  };

  return (
    <>
      <Strip back={back}>{noun} · {company}</Strip>
      <div className="bk-on-desk bk-pap-desk">
        <div className="bk-pap-read">
          <Paper w={132} stock="carbon" edge="perf-left" rot={-0.7} className="bk-form bk-pap-note">
            <div className="bk-pap-note-top">
              <span className="bk-label">{noun}</span>
              <span className="bk-typed">No. {credit.invoiceId}</span>
            </div>
            <h1 ref={heading} tabIndex={-1} className="bk-pap-note-co">{company}</h1>
            <p className={cx('bk-pap-note-amt', amount.length > 12 ? 'is-longer' : amount.length > 9 && 'is-long')}>{amount}</p>
            <div className="bk-pap-note-row">
              <p className="bk-typed">{day(credit.issuedDate)}<br />for {credit.reference}</p>
              <Stamp
                seed={`note-${credit.id}-${credit.status}`}
                sub={stampDay(onInvoice ? credit.applicationDate || credit.issuedDate : credit.issuedDate)}
              >{onInvoice ? 'On invoice' : 'Issued'}</Stamp>
            </div>
            <p className="bk-pap-warn">
              {onInvoice
                ? `It showed up on an invoice on ${day(credit.applicationDate || credit.issuedDate)}.`
                : 'A credit note is not money until it shows up on an invoice.'}
            </p>

            <div className="bk-pap-went">
              <span className="bk-label">Where its money went</span>
              <div
                className="bk-pap-bar"
                role="img"
                aria-label={`${dollars(money.matchedCents)} matched to a promise, ${dollars(money.takenBackCents)} taken back, ${dollars(money.unmatchedCents)} not matched yet`}
              >
                {money.matchedCents > 0 && <i className="is-matched" style={share(money.matchedCents)} />}
                {money.takenBackCents > 0 && <i className="is-back" style={share(money.takenBackCents)} />}
                {money.unmatchedCents > 0 && <i className="is-loose" style={share(money.unmatchedCents)} />}
              </div>
              <dl className="bk-pap-sums">
                <div><dt><i className="is-matched" />Matched to a promise</dt><dd>{ledger(money.matchedCents)}</dd></div>
                <div><dt><i className="is-back" />Taken back</dt><dd>{ledger(money.takenBackCents)}</dd></div>
                <div><dt><i className="is-loose" />Not matched yet</dt><dd>{ledger(money.unmatchedCents)}</dd></div>
                <div className="is-total"><dt>The note</dt><dd>{ledger(money.noteCents)}</dd></div>
              </dl>
            </div>
          </Paper>

          <Paper as="aside" w={112} rot={0.8} className="bk-form bk-pap-slip" aria-label="Where this note is matched">
            <h2 className="bk-form-title">Which promise it covers</h2>
            {matches.length > 0 && (
              <>
                <h3 className="bk-label bk-pap-first">Matched to</h3>
                <ul className="bk-pap-facts">
                  {matches.map(match => <li key={match.commitmentId}>{matchRow(match)}</li>)}
                </ul>
              </>
            )}
            {!matches.length && !could.length && (
              <p className="bk-hand bk-pap-said">
                {credit.candidateCommitmentIds.length ? 'Not matched to a promise yet.' : `No promise in the book has the reference ${credit.reference}.`}
              </p>
            )}

            {could.length > 0 && (
              <>
                <p className="bk-hand bk-pap-said">{could.length} promises fit this note. Waiting for an approver to say which.</p>
                <h3 className="bk-label">It could belong to</h3>
                <ul className="bk-pap-uses">
                  {could.map(id => <li key={id}><a className="bk-link" href={href('iou', id)}>{nameOf(id)}</a><small>{promise(id).reference} · {dollars(promise(id).outstandingCents)} still owed</small></li>)}
                </ul>
              </>
            )}
            {limits.length > 0 && (
              <>
                <h3 className="bk-label">An approver said it may cover</h3>
                <ul className="bk-pap-uses">
                  {limits.map(limit => (
                    <li key={limit.commitmentId}>
                      {promise(limit.commitmentId) ? <a className="bk-link" href={href('iou', limit.commitmentId)}>{nameOf(limit.commitmentId)}</a> : nameOf(limit.commitmentId)}, up to {dollars(limit.limitCents)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className={cx('bk-actions bk-pap-foot')}>
              {home
                ? <a className="bk-btn" href={href('iou', home)}>{todo} on {company}’s page</a>
                : <a className="bk-btn" href={href('companies', credit.vendorId)}>Open {company}’s page</a>}
              <a className="bk-link" href={back}>← All papers</a>
            </div>
          </Paper>
        </div>

        {papers.length > 0 && (
          <section className="bk-pap-behind" aria-label="The papers behind this note">
            <p className="bk-desk-said">{papers.length === 1 ? 'The paper behind it' : 'The papers behind it'}</p>
            <ul className="bk-pap-rows">
              {papers.map(source => <li key={`${source.id}@${source.revision}`}><PaperThumb item={paperItem(view, source)} /></li>)}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
