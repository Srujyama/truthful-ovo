// Companies: who owes you, and one company's page. The headline is the answer
// ("3 of 4 companies owe you.", "Pipeline CRM owes you $1,500."); every promise is
// its coins, one per $100; then the promises, credit notes and papers as hairline lists.

import React, { useMemo } from 'react';
import { vendorSummaries } from '../../operations.mjs';
import { correspondenceStory } from '../../correspondence.mjs';
import { coinsFor } from '../ui/coins.js';
import { Coin, CoinStrip } from '../ui/Coins.jsx';
import { Cell, Empty, Find, Ledger, Row, Sheet, SheetHead, cx } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { day, dollars, ledger } from '../shell/money.mjs';
import { creditNoun, paperItem } from './papers/kinds.mjs';
import { PaperList } from './papers/Thumb.jsx';
import { standing, standingLine, standingWords } from './records/plain.mjs';
import Totals from './records/Totals.jsx';
import './records.css';

const sum = (list, key) => list.reduce((n, item) => n + item[key], 0);
const sentence = words => `${words[0].toUpperCase()}${words.slice(1)}.`;

/** A promise's coins: what came in, what a credit note covers, what is still owed; an offer is all offer. */
const promiseCoins = c => coinsFor({ promisedCents: c.promisedCents, creditedCents: c.verifiedCents, noteCents: c.issuedCents || 0, offer: Boolean(c.conditions?.length) });
const companyCoins = commitments => commitments.flatMap(promiseCoins);
const coinSaid = states => {
  const n = state => states.filter(s => s === state).length;
  const parts = [[n('in'), 'came in'], [n('note'), 'covered by a credit note'], [n('owed'), 'still owed'], [n('offer'), 'on offer']].filter(([count]) => count);
  return parts.length ? `${states.length} coins of $100: ${parts.map(([count, words]) => `${count} ${words}`).join(', ')}` : 'nothing promised';
};

/** What each coin means, said once above the coins. Only the faces that are on the page. */
function CoinKey({ states }) {
  const has = new Set(states);
  return (
    <p className="bk-rec-key">
      <span>one coin is $100</span>
      {has.has('in') && <span><Coin state="in" /> came in on an invoice</span>}
      {has.has('owed') && <span><Coin state="owed" /> still owed</span>}
      {has.has('note') && <span><Coin state="note" /> a credit note covers it, not on an invoice yet</span>}
      {has.has('offer') && <span><Coin state="offer" /> only if you agree</span>}
    </p>
  );
}

export default function Companies({ view, route, go }) {
  const all = useMemo(() => (view ? vendorSummaries(view, {}) : []), [view]);
  if (!view) return null;
  if (route.id) return <Company view={view} company={all.find(v => v.id === route.id)} />;
  return <Index view={view} all={all} query={route.query.q || ''} go={go} />;
}

// ————————————————————————————————————————————————— the index

const INDEX_COLS = 'var(--bk-lm) minmax(170px, 1.35fr) minmax(0, 2fr) minmax(100px, 0.75fr) minmax(100px, 0.75fr) minmax(112px, 0.8fr)';
const INDEX_HEAD = [
  null,
  { label: 'company' },
  { label: 'their promises' },
  { label: 'they promised', num: true },
  { label: 'credited so far', num: true },
  { label: 'still owed', num: true, owed: true },
];

/** "3 of 4 companies owe you." */
function whoOwes(all) {
  const owing = all.filter(v => v.totals.outstandingCents > 0);
  if (all.length === 1) return owing.length ? `${all[0].name} owes you.` : `${all[0].name} owes you nothing.`;
  if (!owing.length) return 'No company owes you anything.';
  if (owing.length === all.length) return `All ${all.length} companies owe you.`;
  return `${owing.length} of ${all.length} companies owe you.`;
}

function Index({ view, all, query, go }) {
  const rows = query.trim() ? vendorSummaries(view, { query }) : all;
  const totals = rows.map(v => v.totals);
  const owed = sum(totals, 'outstandingCents');
  const allOwed = sum(all.map(v => v.totals), 'outstandingCents');
  const states = all.flatMap(v => companyCoins(v.commitments));
  return (
    <Sheet className="bk-rec-companies">
      <SheetHead
        kicker="Companies"
        title={all.length ? whoOwes(all) : 'Nobody owes you anything yet.'}
        lede={allOwed > 0 ? `${dollars(allOwed)} still owed in all.` : null}
      >
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
        <>
          <div className="bk-part"><CoinKey states={states} /></div>
          <Ledger
            cols={INDEX_COLS}
            head={INDEX_HEAD}
            className="bk-rec-list"
            total={<Totals cells={[
              null,
              { title: 'total', span: 2 },
              { label: 'They promised', value: ledger(sum(totals, 'promisedCents')) },
              { label: 'Credited so far', value: ledger(sum(totals, 'verifiedCents')) },
              { label: 'Still owed', value: ledger(owed), owed: owed > 0 },
            ]} />}
          >
            {rows.map((company, i) => {
              const t = company.totals;
              const coins = companyCoins(company.commitments);
              const onOffer = !t.promisedCents && t.conditionalCents > 0;
              return (
                <Row key={company.id} href={href('companies', company.id)} className="bk-rec-co-row" aria-label={`${company.name}: ${dollars(t.outstandingCents)} still owed`}>
                  <Cell no>{i + 1}</Cell>
                  <Cell name>
                    {company.name}
                    <small>{standingLine(company.commitments, view.asOf)}</small>
                  </Cell>
                  <Cell label="their promises" className="bk-rec-coins">
                    {coins.length ? <CoinStrip states={coins} u={2} perRow={12} label={coinSaid(coins)} /> : <span className="bk-muted">nothing yet</span>}
                  </Cell>
                  <Cell num label={onOffer ? 'on offer' : 'they promised'} quiet={onOffer}>{onOffer ? `(${ledger(t.conditionalCents)})` : ledger(t.promisedCents)}</Cell>
                  <Cell num label="credited so far">{ledger(t.verifiedCents)}</Cell>
                  <Cell num label="still owed" owed={t.outstandingCents > 0} quiet={!t.outstandingCents}>{ledger(t.outstandingCents)}</Cell>
                </Row>
              );
            })}
          </Ledger>
        </>
      )}
    </Sheet>
  );
}

// ————————————————————————————————————————————————— one company

const IOU_COLS = 'var(--bk-lm) minmax(200px, 1.6fr) minmax(0, 1.5fr) 124px minmax(96px, 0.7fr) minmax(96px, 0.7fr) minmax(108px, 0.75fr)';
const IOU_HEAD = [
  null,
  { label: 'the promise' },
  { label: 'its coins' },
  { label: 'due' },
  { label: 'they promised', num: true },
  { label: 'credited so far', num: true },
  { label: 'still owed', num: true, owed: true },
];
const NOTE_COLS = 'var(--bk-lm) minmax(200px, 1.6fr) 124px minmax(0, 1.5fr) minmax(96px, 0.7fr) minmax(108px, 0.75fr)';
const NOTE_HEAD = [
  null,
  { label: 'credit note' },
  { label: 'dated' },
  { label: 'where it stands' },
  { label: 'amount', num: true },
  { label: 'matched to a promise', num: true },
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
  const papers = [...company.sources].sort((a, b) => b.revision - a.revision);
  const coins = companyCoins(ious);
  return (
    <Sheet className="bk-rec-company">
      <SheetHead
        back={back}
        kicker="Company"
        title={none ? <>{company.name} owes you <i>nothing.</i></> : <>{company.name} owes you <em>{dollars(t.outstandingCents)}</em>.</>}
        lede={sentence(standingLine(company.commitments, view.asOf))}
      />

      {coins.length > 0 && (
        <div className="bk-part bk-rec-figure">
          <CoinStrip states={coins} u={typeof innerWidth === 'number' && innerWidth < 560 ? 2 : 4} perRow={12} label={coinSaid(coins)} />
          <CoinKey states={coins} />
        </div>
      )}

      <section className="bk-rec-section" aria-label="Promises">
        <h2 className="bk-part bk-rec-h2">Promises <small>{ious.length}</small></h2>
        {ious.length ? (
          <Ledger
            cols={IOU_COLS}
            head={IOU_HEAD}
            className="bk-rec-list"
            total={ious.length > 1 ? <Totals cells={[
              null,
              { title: 'total', span: 3 },
              { label: 'They promised', value: ledger(t.promisedCents) },
              { label: 'Credited so far', value: ledger(t.verifiedCents) },
              { label: 'Still owed', value: ledger(t.outstandingCents), owed: !none },
            ]} /> : null}
          >
            {ious.map((c, i) => {
              const state = standing(c, view.asOf);
              const story = correspondenceStory(view, c, company.name).headline;
              const states = promiseCoins(c);
              return (
                <Row key={c.id} href={href('iou', c.id)} className="bk-rec-co-row" aria-label={`${story}. ${dollars(c.outstandingCents)} still owed.`}>
                  <Cell no>{i + 1}</Cell>
                  <Cell className="bk-rec-story">
                    {story}
                    <small>{standingWords(c, view.asOf)}</small>
                  </Cell>
                  <Cell label="its coins" className="bk-rec-coins"><CoinStrip states={states} u={2} perRow={12} label={coinSaid(states)} /></Cell>
                  <Cell date label="due">{day(c.dueDate)}</Cell>
                  <Cell num label={state === 'offer' ? 'on offer' : 'they promised'} quiet={state === 'offer'}>
                    {state === 'offer' ? `(${ledger(c.promisedCents)})` : ledger(c.promisedCents)}
                  </Cell>
                  <Cell num label="credited so far">{ledger(c.verifiedCents)}</Cell>
                  <Cell num label="still owed" owed={state !== 'paid' && state !== 'offer'} quiet={state === 'paid' || state === 'offer'}>
                    {state === 'paid' ? 'paid' : state === 'offer' ? 'strings attached' : ledger(c.outstandingCents)}
                  </Cell>
                </Row>
              );
            })}
          </Ledger>
        ) : (
          <Empty then="Their first promise goes here. Drop its email in the in-tray.">{company.name} has promised nothing yet.</Empty>
        )}
      </section>

      {company.credits.length > 0 && (
        <section className="bk-rec-section" aria-label="Credit notes">
          <h2 className="bk-part bk-rec-h2">Credit notes <small>{company.credits.length}</small></h2>
          <Ledger cols={NOTE_COLS} head={NOTE_HEAD} className="bk-rec-list">
            {company.credits.map((credit, i) => (
              <Row key={credit.id} href={href('papers', `credit:${credit.id}`)} className="bk-rec-co-row">
                <Cell no>{i + 1}</Cell>
                <Cell className="bk-rec-story">{creditNoun(view, credit)} {credit.invoiceId}</Cell>
                <Cell date label="dated">{day(credit.issuedDate)}</Cell>
                <Cell label="where it stands" className={cx('bk-rec-stands', credit.status !== 'applied' && 'is-waiting')}>
                  {credit.status === 'applied' ? 'on an invoice' : 'not on an invoice yet'}
                  {credit.reversedCents > 0 && <small>{dollars(credit.reversedCents)} taken back</small>}
                </Cell>
                <Cell num label="amount">{ledger(credit.amountCents)}</Cell>
                <Cell num label="matched to a promise">
                  {ledger(credit.allocatedCents)}
                  {credit.unallocatedCents > 0 && <small>{ledger(credit.unallocatedCents)} not matched yet</small>}
                </Cell>
              </Row>
            ))}
          </Ledger>
        </section>
      )}

      {papers.length > 0 && (
        <section className="bk-rec-section" aria-label={`${company.name}’s papers`}>
          <h2 className="bk-part bk-rec-h2">Papers <small>{papers.length}</small></h2>
          <PaperList view={view} items={papers.map(source => paperItem(view, source))} head={false} label={`${company.name}’s papers, newest first`} />
        </section>
      )}
    </Sheet>
  );
}
