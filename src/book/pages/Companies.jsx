// Companies: the index of who owes what, and one company's page:
// its IOUs, its credit notes, and its papers laid out under the sheet.

import React, { useMemo } from 'react';
import { vendorSummaries } from '../../operations.mjs';
import { correspondenceStory } from '../../correspondence.mjs';
import { Cell, Empty, Find, Ledger, Paper, Row, Sheet, SheetHead, Stamp, cx } from '../shell/parts.jsx';
import { href, paperId } from '../shell/route.mjs';
import { day, dollars, ledger, shortDay } from '../shell/money.mjs';
import { creditNoun, openingLines, paperLook, paperTurn } from './papers/kinds.mjs';
import { standing, standingLine } from './records/plain.mjs';
import Totals from './records/Totals.jsx';
import './records.css';

const sum = (list, key) => list.reduce((n, item) => n + item[key], 0);
const sentence = words => `${words[0].toUpperCase()}${words.slice(1)}.`;

export default function Companies({ view, route, go }) {
  const all = useMemo(() => (view ? vendorSummaries(view, {}) : []), [view]);
  if (!view) return null;
  if (route.id) return <Company view={view} company={all.find(v => v.id === route.id)} />;
  return <Index view={view} all={all} query={route.query.q || ''} go={go} />;
}

// ————————————————————————————————————————————————— the index

const INDEX_COLS = 'var(--bk-lm) minmax(190px, 2.2fr) 84px minmax(108px, 0.9fr) minmax(108px, 0.9fr) minmax(116px, 1fr) 34px';
const INDEX_HEAD = [
  null,
  { label: 'Company', rule: 'red' },
  { label: 'IOUs', num: true },
  { label: 'They promised', num: true, rule: 'double' },
  { label: 'Credited so far', num: true, rule: 'red' },
  { label: 'Still owed', num: true, owed: true, rule: 'red' },
  { label: '', rule: 'double' },
];

function Index({ view, all, query, go }) {
  const rows = query.trim() ? vendorSummaries(view, { query }) : all;
  const totals = rows.map(v => v.totals);
  const owed = sum(totals, 'outstandingCents');
  return (
    <Sheet>
      <SheetHead kicker="Companies" title="Who owes you what.">
        {all.length > 0 && (
          <div className="bk-rec-findrow">
            <Find value={query} onChange={text => go('companies', '', text ? { q: text } : null, { replace: true })} placeholder="a company, or the reference on its promise" />
          </div>
        )}
      </SheetHead>
      {!all.length ? (
        <Empty then="Drop a vendor’s email in the in-tray.">Nobody owes you anything yet.</Empty>
      ) : !rows.length ? (
        <Empty then={<a className="bk-link" href={href('companies')}>Back to all {all.length}</a>}>No company by that name in the book.</Empty>
      ) : (
        <Ledger
          cols={INDEX_COLS}
          head={INDEX_HEAD}
          total={<Totals cells={[
            null,
            { title: 'Total', span: 2 },
            { label: 'They promised', value: ledger(sum(totals, 'promisedCents')), rule: 'double' },
            { label: 'Credited so far', value: ledger(sum(totals, 'verifiedCents')), rule: 'red' },
            { label: 'Still owed', value: ledger(owed), owed: owed > 0, rule: 'red' },
            null,
          ]} />}
        >
          {rows.map((company, i) => {
            const t = company.totals;
            return (
              <Row key={company.id} href={href('companies', company.id)} lines={2} aria-label={`${company.name}: ${dollars(t.outstandingCents)} still owed`}>
                <Cell no>{i + 1}</Cell>
                <Cell name rule="red">
                  {company.name}
                  <small>{standingLine(company.commitments, view.asOf)}</small>
                </Cell>
                <Cell num label="IOUs">{company.commitments.length}</Cell>
                <Cell num rule="double" label="They promised">{ledger(t.promisedCents)}</Cell>
                <Cell num rule="red" label="Credited so far">{ledger(t.verifiedCents)}</Cell>
                <Cell num rule="red" owed={t.outstandingCents > 0} label="Still owed">{ledger(t.outstandingCents)}</Cell>
                <Cell rule="double" />
              </Row>
            );
          })}
        </Ledger>
      )}
    </Sheet>
  );
}

// ————————————————————————————————————————————————— one company

const IOU_COLS = 'var(--bk-lm) minmax(230px, 2.4fr) 136px minmax(108px, 0.9fr) minmax(108px, 0.9fr) minmax(116px, 1fr) 34px';
const IOU_HEAD = [
  null,
  { label: 'The promise', rule: 'red' },
  { label: 'Due' },
  { label: 'They promised', num: true, rule: 'double' },
  { label: 'Credited so far', num: true, rule: 'red' },
  { label: 'Still owed', num: true, owed: true, rule: 'red' },
  { label: '', rule: 'double' },
];
const NOTE_COLS = 'var(--bk-lm) minmax(230px, 2.4fr) 136px minmax(150px, 1.1fr) minmax(108px, 0.9fr) minmax(116px, 1fr) 34px';
const NOTE_HEAD = [
  null,
  { label: 'Credit note', rule: 'red' },
  { label: 'Dated' },
  { label: 'Where it stands' },
  { label: 'Amount', num: true, rule: 'double' },
  { label: 'Matched to a promise', num: true, rule: 'red' },
  { label: '', rule: 'double' },
];

function Company({ view, company }) {
  const back = <a className="bk-link bk-rec-way" href={href('companies')}>← All companies</a>;
  if (!company) {
    return (
      <Sheet>
        <SheetHead back={back} title="That company isn’t in this book." date={false} />
      </Sheet>
    );
  }
  const t = company.totals;
  const none = t.outstandingCents === 0;
  const ious = [...company.commitments].sort((a, b) => b.outstandingCents - a.outstandingCents);
  const papers = [...company.sources].sort((a, b) => a.revision - b.revision);
  return (
    <>
      <Sheet>
        <SheetHead
          back={back}
          title={company.name}
          lede={sentence(standingLine(company.commitments, view.asOf))}
          side={(
            <>
              <span className={cx('bk-owed-label', none && 'is-none')}>{none ? 'Nothing owed' : 'Still owed'}</span>
              <b className={cx('bk-owed', none && 'is-none')}>{ledger(t.outstandingCents)}</b>
            </>
          )}
        />

        {ious.length ? (
          <Ledger
            cols={IOU_COLS}
            head={IOU_HEAD}
            total={ious.length > 1 ? <Totals cells={[
              null,
              { title: 'Total', span: 2 },
              { label: 'They promised', value: ledger(t.promisedCents), rule: 'double' },
              { label: 'Credited so far', value: ledger(t.verifiedCents), rule: 'red' },
              { label: 'Still owed', value: ledger(t.outstandingCents), owed: !none, rule: 'red' },
              null,
            ]} /> : null}
          >
            {ious.map((c, i) => {
              const state = standing(c, view.asOf);
              const late = state === 'overdue' || state === 'closed';
              return (
                <Row key={c.id} href={href('iou', c.id)} lines={2} aria-label={`${correspondenceStory(view, c, company.name).headline}. ${dollars(c.outstandingCents)} still owed.`}>
                  <Cell no>{i + 1}</Cell>
                  <Cell rule="red" className="bk-rec-co">{correspondenceStory(view, c, company.name).headline}</Cell>
                  <Cell date label="Due">
                    {day(c.dueDate)}
                    {late && <Stamp small ink="red" seed={`overdue-${c.id}`} style={{ marginTop: -2 }}>Overdue</Stamp>}
                  </Cell>
                  <Cell num rule="double" label={state === 'offer' ? 'On offer' : 'They promised'}>
                    {state === 'offer' ? <span className="bk-muted">({ledger(c.promisedCents)})</span> : ledger(c.promisedCents)}
                  </Cell>
                  <Cell num rule="red" label="Credited so far">{ledger(c.verifiedCents)}</Cell>
                  <Cell num rule="red" owed={state !== 'paid' && state !== 'offer'} label="Still owed">
                    {state === 'paid'
                      ? <Stamp small seed={`paid-${c.id}`}>Paid</Stamp>
                      : state === 'offer'
                        ? <small>strings attached</small>
                        : ledger(c.outstandingCents)}
                  </Cell>
                  <Cell rule="double" />
                </Row>
              );
            })}
          </Ledger>
        ) : (
          <Empty then="Their first promise goes here. Drop its email in the in-tray.">{company.name} has promised nothing yet.</Empty>
        )}

        {company.credits.length > 0 && (
          <>
            <div className="bk-part bk-rec-section"><h2 className="bk-h2">Credit notes</h2></div>
            <Ledger cols={NOTE_COLS} head={NOTE_HEAD}>
              {company.credits.map((credit, i) => (
                <Row key={credit.id} href={href('papers', `credit:${credit.id}`)} lines={credit.unallocatedCents > 0 || credit.reversedCents > 0 ? 2 : 1}>
                  <Cell no>{i + 1}</Cell>
                  <Cell rule="red">{creditNoun(view, credit)} {credit.invoiceId}</Cell>
                  <Cell date label="Dated">{day(credit.issuedDate)}</Cell>
                  <Cell label="Where it stands">
                    {credit.status === 'applied' ? 'on an invoice' : 'not on an invoice yet'}
                    {credit.reversedCents > 0 && <small>{dollars(credit.reversedCents)} taken back</small>}
                  </Cell>
                  <Cell num rule="double" label="Amount">{ledger(credit.amountCents)}</Cell>
                  <Cell num rule="red" label="Matched to a promise">
                    {ledger(credit.allocatedCents)}
                    {credit.unallocatedCents > 0 && <small>{ledger(credit.unallocatedCents)} not matched yet</small>}
                  </Cell>
                  <Cell rule="double" />
                </Row>
              ))}
            </Ledger>
          </>
        )}
      </Sheet>

      {papers.length > 0 && (
        <section className="bk-on-desk bk-rec-desk" aria-label={`${company.name}’s papers`}>
          <p className="bk-desk-said">{company.name}’s papers, oldest first</p>
          <ul className="bk-desk-row bk-rec-fan">
            {papers.map(source => {
              const look = paperLook(source.kind);
              return (
                <li key={source.id}>
                  <Paper
                    as="a"
                    w={62}
                    href={href('papers', paperId(source.id, source.revision))}
                    stock={look.stock}
                    rot={paperTurn(paperId(source.id, source.revision))}
                    className="bk-doc bk-thumb bk-rec-thumb"
                    aria-label={`${look.noun}: ${source.title}, ${day(source.effectiveDate || source.observedAt)}`}
                  >
                    <span className="bk-doc-kind">{look.noun}</span>
                    <h3 className="bk-doc-title">{source.title}</h3>
                    <p className="bk-rec-thumb-date">{shortDay(source.effectiveDate || source.observedAt)}</p>
                    <p className="bk-rec-thumb-lines">{openingLines(source.text)}</p>
                  </Paper>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
