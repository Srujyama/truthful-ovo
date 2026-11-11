// Credits on this promise. Every credit line the company sent under this
// promise's reference is a slip of pink carbon: its number, the amount, the date,
// a stamp saying whether an invoice shows it yet, and where its money went.
// It is the same object the Papers page draws large (papers/CreditNote.jsx), and
// its figures come from the same functions.
//
// A slip's typed links open the credit form beside it (af-CreditForm.jsx): add
// the invoice that shows it, match it to this promise, take it back. A note that
// could belong to more than one promise gets its two steps instead (af-Sorting.jsx).
//
// Mounted by ../Account.jsx as <CreditSlips view commitment service say past />.
// "Write in a credit" is not here: it is the first link in the row at the foot of
// the sheet (ChangedTerms.jsx), which opens the same CreditForm, exported below.
// Which form is out is kept in af-open.mjs, so only one is out across both.

import React, { useEffect, useState } from 'react';
import { Paper, Stamp, Why, cx } from '../../shell/parts.jsx';
import { href, paperId } from '../../shell/route.mjs';
import { day, dollars, ledger, shortDay, stampDay } from '../../shell/money.mjs';
import { may, roleName, whyNot } from '../../shell/roles.mjs';
import { creditMatches, creditMoney, noteItem } from '../papers/kinds.mjs';
import { useOpenForm } from './af-open.mjs';
import CreditForm from './af-CreditForm.jsx';
import Sorting, { settlingPapers } from './af-Sorting.jsx';
import './forms.css';

export { CreditForm };

const TURNS = [-1, 0.8, -0.6, 1.1];
const STAMP = { '--u': 'calc(var(--paper-mm) * 0.8)' };   // the stamp at four fifths, so ON INVOICE and the date share a line

/** The credit lines that belong to a promise: same company, same reference, same currency. */
export function creditsOf(view, commitment) {
  return view.credits.filter(credit => credit.vendorId === commitment.vendorId && credit.reference === commitment.reference && credit.currency === commitment.currency);
}

export default function CreditSlips({ view, commitment, service, say, past = false }) {
  const [open, show, close] = useOpenForm(commitment.id);
  const [landed, setLanded] = useState('');           // the note an invoice was just added for: its stamp comes down
  useEffect(() => {
    if (!landed) return undefined;
    const timer = setTimeout(() => setLanded(''), 1500);
    return () => clearTimeout(timer);
  }, [landed]);
  if (!view || !commitment) return null;
  const credits = creditsOf(view, commitment);
  if (!credits.length) return null;

  const out = open && open.creditId ? credits.find(credit => credit.id === open.creditId) : null;
  const year = view.asOf.slice(0, 4);
  // One slip keeps the form beside it; with more, the form takes the decision slip's width under them.
  const width = credits.length > 1 ? 236 : 196;

  return (
    <section className="bk-part bk-af-credits" aria-labelledby="bk-af-credits-h">
      <h2 className="bk-h2" id="bk-af-credits-h">Credits on this promise</h2>
      <div className="bk-af-desk">
        {credits.map((credit, index) => (
          <Slip
            key={credit.id}
            credit={credit} index={index} view={view} commitment={commitment} year={year}
            service={service} past={past}
            out={out?.id === credit.id ? open : null}
            landed={landed === credit.id}
            show={show}
          />
        ))}

        {out && open.kind === 'credit' && (
          <CreditForm
            key={`${out.id}:${open.job}`}
            view={view} commitment={commitment} service={service} say={say} past={past}
            job={open.job} credit={out} w={width} rot={0.3}
            onClose={() => close()}
            onDone={job => { if (job === 'apply') setLanded(out.id); }}
          />
        )}
        {out && open.kind === 'sort' && (
          <Sorting
            key={`${out.id}:${open.step}`}
            view={view} commitment={commitment} service={service} say={say} past={past}
            credit={out} step={open.step} paperId={open.paperId} w={width} rot={0.3}
            onClose={() => close()}
            onStep={(step, sourceId) => show({ kind: 'sort', creditId: out.id, step, paperId: sourceId })}
          />
        )}
      </div>
    </section>
  );
}

// ---- one credit, on pink carbon ----

function Slip({ credit, index, view, commitment, year, service, past, out, landed, show }) {
  const pen = { actor: service.actor };
  const item = noteItem(view, credit);
  const money = creditMoney(credit);
  const here = creditMatches(credit).filter(match => match.commitmentId === commitment.id).reduce((n, match) => n + match.amountCents, 0);
  const elsewhere = money.matchedCents - here;
  const onInvoice = credit.status === 'applied';
  const unsure = credit.quarantined || Boolean(credit.resolution);
  const jobOut = out?.kind === 'credit' ? out.job : '';
  const job = name => ({
    'aria-expanded': jobOut === name,
    onClick: () => show({ kind: 'credit', job: name, creditId: credit.id }),
  });
  const why = whyNot('REGISTER_CREDIT', pen, { past });   // the three links wait on the same pen
  const links = [
    !onInvoice && credit.availableCents > 0 && <button key="apply" type="button" className="bk-link" disabled={Boolean(why)} {...job('apply')}>Add the invoice that shows it</button>,
    money.unmatchedCents > 0 && !credit.quarantined && <button key="allocate" type="button" className="bk-link" disabled={Boolean(why)} {...job('allocate')}>Match it to this promise</button>,
    credit.availableCents > 0 && <button key="reverse" type="button" className="bk-link" disabled={Boolean(why)} {...job('reverse')}>Take it back</button>,
  ].filter(Boolean);

  return (
    <Paper
      stock="carbon" edge="perf-left" w={96} rot={TURNS[index % TURNS.length]}
      className={cx('bk-af-slip', out && 'is-out')}
      aria-label={`${item.noun} ${credit.invoiceId}`}
    >
      <div className="bk-af-slip-top">
        <span className="bk-label">{item.noun}</span>
        <a className="bk-link" href={href('papers', item.address)}>No. {credit.invoiceId}</a>
      </div>
      <p className="bk-af-slip-amt">${ledger(credit.amountCents)}</p>
      <div className="bk-af-slip-row">
        <p className="bk-typed">{day(credit.issuedDate)}</p>
        <Stamp
          key={credit.status}
          style={STAMP}
          seed={`note-${credit.id}-${credit.status}`}
          sub={stampDay(onInvoice ? credit.applicationDate || credit.issuedDate : credit.issuedDate)}
          land={landed && onInvoice}
        >{onInvoice ? 'On invoice' : 'Issued'}</Stamp>
      </div>

      <dl className="bk-af-lines">
        <div><dt>Matched to this promise</dt><dd>{ledger(here)}</dd></div>
        {elsewhere > 0 && <div><dt>Matched to another promise</dt><dd>{ledger(elsewhere)}</dd></div>}
        <div><dt>Not matched yet</dt><dd>{ledger(money.unmatchedCents)}</dd></div>
        <div><dt>Taken back</dt><dd>{ledger(money.takenBackCents)}</dd></div>
      </dl>

      {unsure && <Unsure credit={credit} view={view} commitment={commitment} year={year} pen={pen} past={past} out={out} show={show} />}

      {links.length > 0 && (
        <div className="bk-af-slip-links">
          {links}
          <Why>{why}</Why>
        </div>
      )}
    </Paper>
  );
}

// ---- a note that could belong to more than one promise: two steps, two pens ----

function Unsure({ credit, view, commitment, year, pen, past, out, show }) {
  const papers = settlingPapers(view, credit);
  const used = (credit.resolution?.sourceLinks || []).map(link => view.sourceVersions.find(source => source.id === link.sourceId && source.revision === link.revision)).filter(Boolean);
  const onFile = used.length ? used : papers.slice(0, 1);
  const limits = credit.resolution?.assignments || null;
  const mine = limits?.find(row => row.commitmentId === commitment.id)?.limitCents || 0;
  const role = pen.actor?.role;
  const stepOut = out?.kind === 'sort' ? out.step : '';
  const step = name => ({
    'aria-expanded': stepOut === name,
    onClick: () => show({ kind: 'sort', creditId: credit.id, step: name }),
  });
  const canAdd = !past && may('ADD_SOURCE', role);
  const canSet = !past && may('RESOLVE_CREDIT', role);

  return (
    <div className="bk-af-unsure">
      <p className="bk-af-unsure-said">This note could belong to more than one promise.</p>
      <ol className="bk-af-steps">
        <li>
          <span className="bk-label">First, an analyst</span>
          {onFile.map(source => (
            <p key={`${source.id}@${source.revision}`} className="bk-af-pen">
              On file {shortDay(String(source.observedAt).slice(0, 10), year)}: <a className="bk-link" href={href('papers', paperId(source.id, source.revision))}>{source.title}</a>
            </p>
          ))}
          <button type="button" className="bk-link" disabled={!canAdd} {...step('paper')}>{onFile.length ? 'Add another paper' : 'Add what settles it'}</button>
        </li>
        <li>
          <span className="bk-label">Then, an approver</span>
          {limits && <p className="bk-af-pen">{mine > 0 ? `This promise may take up to ${dollars(mine)}.` : 'This promise may take nothing from it.'}</p>}
          <button type="button" className="bk-link" disabled={!canSet || !papers.length} {...step('limits')}>{limits ? 'Change the amounts' : 'Say how much each may take'}</button>
          {!papers.length && <small>Waits for the paper.</small>}
        </li>
      </ol>
      {past
        ? <Why>{whyNot('ADD_SOURCE', pen, { past })}</Why>
        : (!canAdd || !canSet) && <Why>You are signed in as {roleName(role).toLowerCase()}.</Why>}
    </div>
  );
}
