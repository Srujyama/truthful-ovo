// The balance: what every company still owes, added up, as of a date. The headline is
// the answer ("$3,850 still owed on Nov 10."), then how it adds up, as leader rows.
// Two quiet date fields turn the book back: what was in force that day, and what the
// book knew by then.

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { isDate } from '../../assurance/index.mjs';
import { financialReport, reportCsv } from '../../operations.mjs';
import { Btn, Cell, Empty, Ledger, Row, Sheet } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { plainError } from '../shell/roles.mjs';
import { dollars, ledger, shortDay, today } from '../shell/money.mjs';
import { standingLine } from './records/plain.mjs';
import { saveFile } from './records/save.mjs';
import Totals from './records/Totals.jsx';
import './records.css';

const COLS = 'var(--bk-lm) minmax(150px, 2fr) minmax(100px, 0.9fr) minmax(100px, 0.9fr) minmax(108px, 1fr) minmax(104px, 1fr) minmax(104px, 1fr)';
const HEAD = [
  null,
  { label: 'company' },
  { label: 'they promised', num: true },
  { label: 'credited so far', num: true },
  { label: 'still owed', num: true, owed: true },
  { label: 'credit notes waiting', num: true },
  { label: 'offers with strings', num: true },
];

const endOf = date => `${date}T23:59:59.999Z`;
// Today's balance counts everything written in so far: in the evening west of Greenwich a paper written in now carries a moment past midnight UTC.
const knownBy = (workspace, by, now) => (by !== now ? endOf(by) : [endOf(by), new Date().toISOString(), workspace.events.at(-1)?.observedAt ?? ''].sort().at(-1));
const pick = (value, latest) => (isDate(value) && value <= latest ? value : latest);

/** A date you can turn back: a real date input, in mono, with what it means under it. */
function DateField({ label, hint, value, max, onTurn }) {
  const id = useId();
  return (
    <div className="bk-rec-turn">
      <label className="bk-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="bk-rec-date"
        type="date"
        value={value}
        max={max}
        required
        aria-describedby={`${id}-hint`}
        onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* the browser opens its own calendar */ } }}
        onChange={event => { const next = event.target.value; if (isDate(next)) onTurn(next > max ? max : next); }}
      />
      <small id={`${id}-hint`}>{hint}</small>
    </div>
  );
}

export default function Balance({ service, route, go, say }) {
  const now = today();
  const asOf = pick(route.query.asof, now);
  const by = pick(route.query.by, now);
  const turned = asOf !== now || by !== now;
  const [packing, setPacking] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const { report, error } = useMemo(() => {
    if (!service.workspace) return {};
    try { return { report: financialReport(service.workspace, { asOf, knownAt: knownBy(service.workspace, by, now) }) }; } catch (e) { return { error: e }; }
  }, [service.workspace, asOf, by]);
  if (!service.workspace) return null;

  const turn = next => go('balance', '', { asof: next.asOf === now ? null : next.asOf, by: next.by === now ? null : next.by }, { replace: true });
  const turnedTo = asOf !== now
    ? `You have turned the book back to ${shortDay(asOf)}${by !== now && by !== asOf ? `, counting papers received by ${shortDay(by)}` : ''}.`
    : `You are counting only the papers received by ${shortDay(by)}.`;

  function csv() {
    const name = `truthful-balance-${report.asOf}.csv`;
    saveFile(name, reportCsv(report), 'text/csv;charset=utf-8');
    say(`Saved ${name}.`);
  }
  async function trail() {
    if (packing) return;
    setPacking(true);
    try {
      const packet = await service.exportPacket({ asOf: report.asOf, knownAt: report.knownAt });
      const name = `truthful-trail-${report.asOf}.json`;
      saveFile(name, JSON.stringify(packet, null, 2), 'application/json');
      say(`Saved ${name}.`);
    } catch (e) {
      say(plainError(e) || 'The trail would not pack. Try again.', { wrong: true });
    } finally {
      if (alive.current) setPacking(false);
    }
  }

  const totals = report?.totals;
  const companies = report?.vendors || [];
  const none = !totals || totals.outstandingCents === 0;

  return (
    <Sheet className="bk-rec-balance">
      <header className="bk-head bk-rec-bal">
        <div className="bk-kicker"><span>Balance</span></div>
        <h1>
          {!totals ? 'Every company, added up.'
            : none ? <>Nothing owed <i>on {shortDay(asOf)}.</i></>
              : <><em>{dollars(totals.outstandingCents)}</em> still owed on {shortDay(asOf)}.</>}
        </h1>
        <p className="bk-lede">{turned ? turnedTo : 'Every company, added up.'}</p>
      </header>

      <div className="bk-part bk-rec-top">
        {totals && (
          <div className="bk-rec-sums">
            <dl
              className="bk-rec-sum"
              aria-label={`${dollars(totals.outstandingCents)} still owed: ${dollars(totals.promisedCents)} promised, less ${dollars(totals.verifiedCents)} credited so far`}
            >
              <div className="t-row"><dt><i aria-hidden="true" />they promised</dt><span className="t-dots" /><dd>{dollars(totals.promisedCents)}</dd></div>
              <div className="t-row"><dt><i aria-hidden="true">−</i>credited so far</dt><span className="t-dots" /><dd>{dollars(totals.verifiedCents)}</dd></div>
              <div className={`t-row is-total${none ? '' : ' is-owed'}`}><dt><i aria-hidden="true">=</i>still owed</dt><span className="t-dots" /><dd>{dollars(totals.outstandingCents)}</dd></div>
            </dl>
            <dl className="bk-rec-apart">
              <div className="t-row">
                <dt>credit notes not on an invoice yet<small>A note is not money until it shows on an invoice.</small></dt>
                <span className="t-dots" />
                <dd>{dollars(totals.issuedCents)}</dd>
              </div>
              <div className="t-row">
                <dt>offers with strings attached<small>Yours only if you agree to more.</small></dt>
                <span className="t-dots" />
                <dd>{dollars(totals.conditionalCents)}</dd>
              </div>
            </dl>
          </div>
        )}
        <div className="bk-rec-daters">
          <DateField label="as of" hint="what was in force that day" value={asOf} max={now} onTurn={date => turn({ asOf: date, by })} />
          <DateField label="counting papers received by" hint="what the book knew by then" value={by} max={now} onTurn={date => turn({ asOf, by: date })} />
          {turned && <Btn quiet onClick={() => turn({ asOf: now, by: now })}>Back to today</Btn>}
        </div>
      </div>

      {error ? (
        <Empty then={<button type="button" className="bk-link" onClick={() => turn({ asOf: now, by: now })}>Back to today</button>}>The book won’t open at that date.</Empty>
      ) : !companies.length ? (
        <Empty then={turned ? 'Turn it forward to see the first entry.' : 'Drop a vendor’s email in the in-tray.'}>
          {turned ? `The book was empty on ${shortDay(by < asOf ? by : asOf)}.` : 'Nobody owes you anything yet.'}
        </Empty>
      ) : (
        <Ledger
          cols={COLS}
          head={HEAD}
          className="bk-rec-by"
          total={<Totals cells={[
            null,
            { title: 'total' },
            { label: 'They promised', value: ledger(totals.promisedCents) },
            { label: 'Credited so far', value: ledger(totals.verifiedCents) },
            { label: 'Still owed', value: ledger(totals.outstandingCents), owed: totals.outstandingCents > 0 },
            { label: 'Credit notes waiting', value: ledger(totals.issuedCents) },
            { label: 'Offers with strings', value: ledger(totals.conditionalCents) },
          ]} />}
        >
          {companies.map((company, i) => {
            const t = company.totals;
            const blank = !company.commitments.length && !company.credits.length;
            return (
              <Row key={company.id} href={href('companies', company.id)} aria-label={`${company.name}: ${dollars(t.outstandingCents)} still owed`}>
                <Cell no>{i + 1}</Cell>
                <Cell name quiet={blank}>
                  {company.name}
                  <small>{standingLine(company.commitments, report.asOf)}</small>
                </Cell>
                <Cell num quiet={blank} label="they promised">{blank ? '' : ledger(t.promisedCents)}</Cell>
                <Cell num quiet={blank} label="credited so far">{blank ? '' : ledger(t.verifiedCents)}</Cell>
                <Cell num owed={t.outstandingCents > 0} quiet={blank || !t.outstandingCents} label="still owed">{blank ? '' : ledger(t.outstandingCents)}</Cell>
                <Cell num quiet label="credit notes waiting">{t.issuedCents ? ledger(t.issuedCents) : ''}</Cell>
                <Cell num quiet label="offers with strings">{t.conditionalCents ? ledger(t.conditionalCents) : ''}</Cell>
              </Row>
            );
          })}
        </Ledger>
      )}

      {report && (
        <div className="bk-part bk-rec-take">
          <div className="bk-actions">
            <Btn onClick={csv}>Copy for the accountant (CSV)</Btn>
            <Btn quiet onClick={trail} busy={packing ? 'Packing it…' : ''}>Download the whole trail</Btn>
          </div>
          <p className="bk-why">The copy has one line per company, in cents. The trail is every entry and every paper, as the book stood on {shortDay(report.asOf)}.</p>
        </div>
      )}
    </Sheet>
  );
}
