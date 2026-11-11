// One credit note. The headline is its amount and where it stands ("$2,000 credit note.
// Not on an invoice yet."); under it its coins, one per $100; then the note itself as
// leader rows, where its money went, the promises it is matched to and the papers behind it.
// Nothing is changed here; its forms are on the account page.

import React, { useEffect, useRef } from 'react';
import { CoinStrip, Coin } from '../../ui/Coins.jsx';
import { Sheet, cx } from '../../shell/parts.jsx';
import { href } from '../../shell/route.mjs';
import { day, dollars, ledger, shortDay } from '../../shell/money.mjs';
import { creditMatches, creditMoney, creditNoun, creditPapers, paperItem } from './kinds.mjs';
import { Head, Missing } from './Reading.jsx';
import { PaperList } from './Thumb.jsx';

/** One coin per $100 of the note: on an invoice they came in; not yet, a credit note covers them; taken back, owed again. */
function noteCoins(credit, onInvoice) {
  const money = creditMoney(credit);
  const total = Math.ceil(money.noteCents / 10000);
  const back = Math.min(total, Math.round(money.takenBackCents / 10000));
  return Array.from({ length: total }, (_, i) => (i >= total - back ? 'owed' : onInvoice ? 'in' : 'note'));
}

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
  const coins = noteCoins(credit, onInvoice);
  const small = typeof innerWidth === 'number' && innerWidth < 560;
  const applied = credit.applicationDate || credit.issuedDate;

  // the headline: the amount, then where it stands or where its money went
  const stands = !onInvoice ? <i>Not on an invoice yet.</i>
    : money.takenBackCents > 0 ? <i>{dollars(money.takenBackCents)} taken back.</i>
      : money.unmatchedCents > 0 ? <i>{dollars(money.unmatchedCents)} not matched yet.</i>
        : <i>On an invoice since {shortDay(applied)}.</i>;

  return (
    <Sheet className="bk-pap-reading bk-pap-credit">
      <Head
        back={back}
        kicker={`${noun.toLowerCase()} · ${company}`}
        heading={heading}
        lede={onInvoice ? `It showed up on an invoice on ${day(applied)}.` : 'A credit note is not money until it shows up on an invoice.'}
      >
        {dollars(credit.amountCents)} {noun.toLowerCase()}. {stands}
      </Head>

      {coins.length > 0 && (
        <div className="bk-part bk-pap-coins">
          <CoinStrip
            states={coins}
            u={small ? 3 : 4}
            perRow={10}
            label={`${dollars(credit.amountCents)} in coins of $100: ${onInvoice ? 'on an invoice' : 'not on an invoice yet'}`}
          />
          <p className="bk-pap-key">
            <span>one coin is $100</span>
            <span><Coin state={onInvoice ? 'in' : 'note'} /> {onInvoice ? 'it came in on an invoice' : 'a credit note covers it, not on an invoice yet'}</span>
            {money.takenBackCents > 0 && <span><Coin state="owed" /> taken back, owed again</span>}
          </p>
        </div>
      )}

      <div className="bk-part bk-pap-read">
        <article className="t-box bk-pap-paper bk-pap-note" aria-label={`${noun} ${credit.invoiceId}`}>
          <span className="t-box-name">{noun.toLowerCase()}</span>
          <h2 className="bk-pap-name">{company}</h2>
          <dl className="bk-pap-rows">
            <div className="t-row"><dt>number</dt><i className="t-dots" /><dd>{credit.invoiceId}</dd></div>
            <div className="t-row"><dt>dated</dt><i className="t-dots" /><dd>{day(credit.issuedDate)}</dd></div>
            <div className="t-row"><dt>for</dt><i className="t-dots" /><dd>{credit.reference}</dd></div>
            <div className="t-row"><dt>on an invoice</dt><i className="t-dots" /><dd>{onInvoice ? day(applied) : 'not yet'}</dd></div>
          </dl>

          <h3 className="bk-label bk-pap-went">where its money went</h3>
          <dl
            className="bk-pap-rows"
            aria-label={`${dollars(money.matchedCents)} matched to a promise, ${dollars(money.takenBackCents)} taken back, ${dollars(money.unmatchedCents)} not matched yet`}
          >
            <div className="t-row"><dt>matched to a promise</dt><i className="t-dots" /><dd>{ledger(money.matchedCents)}</dd></div>
            <div className="t-row"><dt>taken back</dt><i className="t-dots" /><dd>{ledger(money.takenBackCents)}</dd></div>
            <div className="t-row"><dt>not matched yet</dt><i className="t-dots" /><dd>{ledger(money.unmatchedCents)}</dd></div>
            <div className="t-row is-total"><dt>the note</dt><i className="t-dots" /><dd>{ledger(money.noteCents)}</dd></div>
          </dl>
        </article>

        <aside className="bk-pap-side" aria-label="Which promise it covers">
          <h2 className="bk-pap-side-head">Which promise it covers</h2>
          {matches.length > 0 && (
            <ul className="bk-pap-facts">
              {matches.map(match => {
                const found = promise(match.commitmentId);
                const inside = (
                  <>
                    <span>{nameOf(match.commitmentId)}{found && <small>{found.reference} · due {day(found.dueDate)}</small>}</span>
                    <i className="t-dots" />
                    <b>{ledger(match.amountCents)}</b>
                  </>
                );
                return <li key={match.commitmentId}>{found ? <a className="t-row bk-pap-fact is-link" href={href('iou', found.id)}>{inside}</a> : <div className="t-row bk-pap-fact">{inside}</div>}</li>;
              })}
            </ul>
          )}
          {!matches.length && !could.length && (
            <p className="bk-pap-said">
              {credit.candidateCommitmentIds.length ? 'Not matched to a promise yet.' : `No promise in the book has the reference ${credit.reference}.`}
            </p>
          )}

          {could.length > 0 && (
            <>
              <p className="bk-pap-said">{could.length} promises fit this note. Waiting for an approver to say which.</p>
              <h3 className="bk-label">it could belong to</h3>
              <ul className="bk-pap-uses">
                {could.map(id => <li key={id}><a className="bk-pap-use" href={href('iou', id)}>{nameOf(id)}<small>{promise(id).reference} · {dollars(promise(id).outstandingCents)} still owed</small></a></li>)}
              </ul>
            </>
          )}
          {limits.length > 0 && (
            <>
              <h3 className="bk-label">an approver said it may cover</h3>
              <ul className="bk-pap-uses">
                {limits.map(limit => (
                  <li key={limit.commitmentId}>
                    {promise(limit.commitmentId)
                      ? <a className="bk-pap-use" href={href('iou', limit.commitmentId)}>{nameOf(limit.commitmentId)}, up to {dollars(limit.limitCents)}</a>
                      : <span className="bk-pap-use">{nameOf(limit.commitmentId)}, up to {dollars(limit.limitCents)}</span>}
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
        </aside>
      </div>

      {papers.length > 0 && (
        <section className="bk-pap-behind" aria-label="The papers behind this note">
          <h2 className="bk-part bk-pap-section">{papers.length === 1 ? 'The paper behind it' : 'The papers behind it'}</h2>
          <PaperList view={view} items={papers.map(source => paperItem(view, source))} head={false} label="The papers behind this note" />
        </section>
      )}
    </Sheet>
  );
}
