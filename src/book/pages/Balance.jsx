// The balance: what every company still owes, added up, as of a date.
// Two daters turn the book back: what was in force that day, and what the book knew by then.

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { isDate } from '../../assurance/index.mjs';
import { financialReport, reportCsv } from '../../operations.mjs';
import { Btn, Cell, Empty, Ledger, Row, Sheet, cx } from '../shell/parts.jsx';
import { href } from '../shell/route.mjs';
import { plainError } from '../shell/roles.mjs';
import { dollars, ledger, shortDay, stampDay, today } from '../shell/money.mjs';
import { standingLine } from './records/plain.mjs';
import { saveFile } from './records/save.mjs';
import Totals from './records/Totals.jsx';
import './records.css';

const COLS = 'var(--bk-lm) minmax(150px, 2.1fr) minmax(104px, 0.9fr) minmax(104px, 0.9fr) minmax(112px, 1fr) minmax(104px, 1fr) minmax(104px, 1fr) 34px';
const HEAD = [
  null,
  { label: 'Company', rule: 'red' },
  { label: 'They promised', num: true, rule: 'double' },
  { label: 'Credited so far', num: true, rule: 'red' },
  { label: 'Still owed', num: true, owed: true, rule: 'red' },
  { label: 'Credit notes waiting', num: true, rule: 'double' },
  { label: 'Offers with strings', num: true },
  { label: '', rule: 'double' },
];

const endOf = date => `${date}T23:59:59.999Z`;
const pick = (value, latest) => (isDate(value) && value <= latest ? value : latest);

/**
 * A dater stamp you can turn. It is a real date input: press it for the calendar, or Tab to it
 * and type, and then it shows the date the way the keyboard edits it.
 */
function TurnDater({ label, hint, value, max, onTurn }) {
  const id = useId();
  const pressed = useRef(false);
  const [typing, setTyping] = useState(false);
  return (
    <div className="bk-rec-turn">
      <label className="bk-label" htmlFor={id}>{label}</label>
      <span className={cx('bk-rec-dater', typing && 'is-typing')}>
        <span aria-hidden="true">{stampDay(value)}</span>
        <input
          id={id}
          type="date"
          value={value}
          max={max}
          required
          aria-describedby={`${id}-hint`}
          onPointerDown={() => { pressed.current = true; }}
          onFocus={() => { setTyping(!pressed.current); pressed.current = false; }}
          onBlur={() => setTyping(false)}
          onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* the browser opens its own calendar */ } }}
          onChange={event => { const next = event.target.value; if (isDate(next)) onTurn(next > max ? max : next); }}
        />
      </span>
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
    try { return { report: financialReport(service.workspace, { asOf, knownAt: endOf(by) }) }; } catch (e) { return { error: e }; }
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
    <Sheet>
      <header className="bk-rec-bal">
        <div className="bk-rec-bal-top">
          <div className="bk-rec-bal-title">
            <span className="bk-label">Balance</span>
            <h1 className="bk-h1">Every company, added up.</h1>
          </div>
          <div className="bk-rec-daters">
            <TurnDater label="As of" hint="what was in force that day" value={asOf} max={now} onTurn={date => turn({ asOf: date, by })} />
            <TurnDater label="Counting papers received by" hint="what the book knew by then" value={by} max={now} onTurn={date => turn({ asOf, by: date })} />
          </div>
        </div>
        {turned && (
          <p className="bk-rec-back">
            <span className="bk-hand">{turnedTo}</span>
            <Btn quiet onClick={() => turn({ asOf: now, by: now })}>Back to today</Btn>
          </p>
        )}

        {totals && (
          <>
            <div className="bk-rec-sum" aria-label={`${dollars(totals.outstandingCents)} still owed: ${dollars(totals.promisedCents)} promised, less ${dollars(totals.verifiedCents)} credited so far`}>
              <p className="bk-rec-fig is-owed">
                <span className={cx('bk-owed-label', none && 'is-none')}>Still owed</span>
                <b className={cx('bk-owed', none && 'is-none')}>{ledger(totals.outstandingCents)}</b>
              </p>
              <i aria-hidden="true">=</i>
              <p className="bk-rec-fig"><span className="bk-label">They promised</span><b>{ledger(totals.promisedCents)}</b></p>
              <i aria-hidden="true">−</i>
              <p className="bk-rec-fig"><span className="bk-label">Credited so far</span><b>{ledger(totals.verifiedCents)}</b></p>
            </div>
            <dl className="bk-rec-apart">
              <div>
                <dt>Credit notes not on an invoice yet</dt>
                <dd><b>{ledger(totals.issuedCents)}</b> A note is not money until it shows on an invoice.</dd>
              </div>
              <div>
                <dt>Offers with strings attached</dt>
                <dd><b>{ledger(totals.conditionalCents)}</b> Yours only if you agree to more.</dd>
              </div>
            </dl>
          </>
        )}
      </header>

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
            { title: 'Total' },
            { label: 'They promised', value: ledger(totals.promisedCents), rule: 'double' },
            { label: 'Credited so far', value: ledger(totals.verifiedCents), rule: 'red' },
            { label: 'Still owed', value: ledger(totals.outstandingCents), owed: totals.outstandingCents > 0, rule: 'red' },
            { label: 'Credit notes waiting', value: ledger(totals.issuedCents), rule: 'double' },
            { label: 'Offers with strings', value: ledger(totals.conditionalCents) },
            null,
          ]} />}
        >
          {companies.map((company, i) => {
            const t = company.totals;
            const blank = !company.commitments.length && !company.credits.length;
            return (
              <Row key={company.id} href={href('companies', company.id)} lines={2} aria-label={`${company.name}: ${dollars(t.outstandingCents)} still owed`}>
                <Cell no>{i + 1}</Cell>
                <Cell name rule="red" quiet={blank}>
                  {company.name}
                  <small>{standingLine(company.commitments, report.asOf)}</small>
                </Cell>
                <Cell num rule="double" quiet={blank} label="They promised">{blank ? '' : ledger(t.promisedCents)}</Cell>
                <Cell num rule="red" quiet={blank} label="Credited so far">{blank ? '' : ledger(t.verifiedCents)}</Cell>
                <Cell num rule="red" owed={t.outstandingCents > 0} quiet={blank} label="Still owed">{blank ? '' : ledger(t.outstandingCents)}</Cell>
                <Cell num rule="double" quiet label="Credit notes waiting">{t.issuedCents ? ledger(t.issuedCents) : ''}</Cell>
                <Cell num quiet label="Offers with strings">{t.conditionalCents ? ledger(t.conditionalCents) : ''}</Cell>
                <Cell rule="double" />
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
