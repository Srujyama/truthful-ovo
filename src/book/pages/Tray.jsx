// The in-tray: a set of papers from one vendor goes in, Truthful reads them, and
// they come back out onto the desk marked up.
//
//   #/tray
//
// In the tray lie three papers you type, paste or drop a file onto: the promise,
// the invoices, and what they said next. "Read them" runs the real reading
// (src/engine: analyzeEvidence) and keeps it in this browser's pile
// (src/recovery.mjs). The papers then lie on the desk at reading size with every
// passage the reading used under the highlighter, beside a slip that says what
// was found. From there: write it in the book (src/assuranceImport.mjs, through
// service.commands), and approve the letter asking for the rest.
//
// The words are in ./tray/plain.mjs; the parts are ./tray/Slot.jsx (a paper in the
// tray), Marked.jsx (a paper on the desk), Found.jsx (the slip), Letter.jsx and
// Pile.jsx (the earlier readings).

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyzeEvidence } from '../../engine/index.mjs';
import { STORAGE_KEY, approveCase, createCase, readCases, saveCase, verifyCase } from '../../recovery.mjs';
import { prepareEvidenceImport } from '../../assuranceImport.mjs';
import { previewEvidencePortfolio } from '../../evidence-ui.mjs';
import { reducedMotion, settle, sound } from '../kit/paper.js';
import { Btn, Dater, Field, Paper, Sheet } from '../shell/parts.jsx';
import { plainError, whyNot } from '../shell/roles.mjs';
import {
  EXAMPLES, SLOTS, approvalOf, blankTray, bookProblem, bookWaits, calendarDay, companyIn, couldRead, engineDay,
  fileProblem, letterFor, letterProblem, marksFor, slipTime, sortFiles, textProblem, trayIsEmpty,
} from './tray/plain.mjs';
import Slot from './tray/Slot.jsx';
import Marked from './tray/Marked.jsx';
import Found from './tray/Found.jsx';
import Letter, { useDownloads } from './tray/Letter.jsx';
import Pile from './tray/Pile.jsx';
import './tray.css';

const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');

function readPile() {
  try { return { pile: readCases(localStorage), torn: false }; } catch { return { pile: [], torn: true }; }
}

/** The top edge of the page, left showing above the desk: where you are, and the way back. */
function Strip({ heading, back, children }) {
  return (
    <Sheet holes={false} className={back ? 'is-strip bk-tray-strip has-back' : 'is-strip bk-tray-strip'}>
      <div className="bk-kicker">
        {back}
        <span className="bk-tray-kick">In-tray</span>
        <h1 ref={heading} tabIndex={-1} className="bk-tray-h1">{children}</h1>
        <Dater style={{ marginLeft: 'auto' }} />
      </div>
    </Sheet>
  );
}

/** A team's book keeps its readings on the server, and that path is still on the old screen. */
function TeamTray() {
  return (
    <>
      <Strip>Drop in what they sent you.</Strip>
      <div className="bk-on-desk bk-tray-desk">
        <div className="bk-tray is-team">
          <div className="bk-tray-box">
            <Paper w={104} rot={-1.2} className="bk-tray-note">
              <p>A team’s papers are filed on the old screen for now.</p>
              <a className="bk-link" href="?view=evidence">Open it</a>
            </Paper>
          </div>
        </div>
      </div>
    </>
  );
}

/** The two downloads, at the foot of the slip when there is no letter to approve first. */
function SlipDownloads({ record, say }) {
  const save = useDownloads(record, say);
  return (
    <>
      {couldRead(record.report) && <button type="button" className="bk-link" onClick={save.figures}>Download the figures (CSV)</button>}
      <button type="button" className="bk-link" onClick={save.reading}>Download this reading (JSON)</button>
    </>
  );
}

function OwnTray({ service, view, go, say }) {
  const [form, setForm] = useState(() => blankTray());
  const [ownCompany, setOwnCompany] = useState(false);   // true once the reader has typed the company themselves
  const [slotSays, setSlotSays] = useState({});          // what went wrong with a file, on the slot it was dropped on
  const [record, setRecord] = useState(null);            // the reading whose papers are out on the desk
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(readPile);
  const [working, setWorking] = useState('');            // 'reading' | 'approving' | 'writing' | 'fetching'
  const [landed, setLanded] = useState('');              // the approval given on this visit: only that stamp comes down with a thud
  const [out, setOut] = useState(0);                     // goes up each time papers come out of the tray
  const [hover, setHover] = useState(null);              // the passages under the hand
  const [pressed, setPressed] = useState(null);          // the reason that was pressed, and stays lit
  const [book, setBook] = useState({ checking: false });
  const [over, setOver] = useState(false);
  const ticket = useRef(0);
  const pile = useRef(saved.pile);
  const desk = useRef(null), heading = useRef(null), found = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ticket.current += 1; }; }, []);

  const report = record?.report || null;
  const today = calendarDay();

  // ——— the tray

  function put(key, value) {
    setForm(current => {
      const next = { ...current, [key]: value };
      if (key === 'promiseText' && !ownCompany) next.vendor = companyIn(value) || current.vendor;
      return next;
    });
    setSlotSays(current => (current[key] ? { ...current, [key]: '' } : current));
  }

  async function takeFiles(files, droppedOn) {
    const says = {};
    const got = {};
    for (const [slot, file] of sortFiles(files, droppedOn, form)) {
      const where = droppedOn || slot;
      const problem = fileProblem(file);
      if (problem) { says[where] = problem; continue; }
      try {
        const text = await file.text();
        const bad = textProblem(file.name, text);
        if (bad) says[where] = bad; else got[slot] = { text, name: file.name };
      } catch {
        says[where] = `Couldn’t open ${file.name}. Drop it in again.`;
      }
    }
    if (!alive.current) return;
    const keys = Object.keys(got);
    for (const key of keys) put(key, got[key].text);
    setSlotSays(current => ({ ...current, ...says }));
    if (keys.length) {
      sound.tap(0.4);
      say(keys.length === 1 ? `${got[keys[0]].name} is in the tray.` : `${keys.length} papers are in the tray.`);
    }
  }

  async function tryExample(example) {
    if (working) return;
    const mine = ++ticket.current;
    setWorking('fetching');
    try {
      const entries = await Promise.all(Object.entries(example.files).map(async ([key, file]) => {
        const reply = await fetch(`${import.meta.env.BASE_URL}examples/${file}`);
        if (!reply.ok || (reply.headers.get('content-type') || '').includes('text/html')) throw new Error(file);
        return [key, await reply.text()];
      }));
      if (mine !== ticket.current) return;
      const papers = Object.fromEntries(entries);
      if (example.swap) papers.invoiceCsv = papers.invoiceCsv.replaceAll(example.swap[0], example.swap[1]);
      setForm({ ...blankTray(calendarDay()), vendor: example.company, ...papers });
      setOwnCompany(false);
      setSlotSays({});
      sound.tap(0.4);
    } catch {
      if (mine === ticket.current) say('Couldn’t fetch that example. Is the site still running?', { wrong: true });
    } finally {
      if (mine === ticket.current) setWorking('');
    }
  }

  function emptyTray() {
    setForm(blankTray(calendarDay()));
    setOwnCompany(false);
    setSlotSays({});
  }

  // ——— reading

  function keep(next) {
    try {
      pile.current = saveCase(localStorage, pile.current, next);
      setSaved({ pile: pile.current, torn: false });
    } catch {
      say('This browser won’t keep the pile. The reading on the desk is still here.', { wrong: true });
    }
  }

  /** Put a reading's papers out on the desk. */
  function lay(next) {
    setRecord(next);
    setDraft(approvalOf(next)?.payload.draft ?? letterFor(next.report));
    setHover(null);
    setPressed(null);
    setOut(n => n + 1);
    scrollTo({ top: 0 });
  }

  async function readThem() {
    if (working) return;
    const mine = ++ticket.current;
    setWorking('reading');
    try {
      const began = performance.now();
      const result = analyzeEvidence({ ...form, vendor: form.vendor.trim(), asOf: engineDay(form.asOf) });
      // The same papers read the same way twice are one reading: the one in the pile comes back out.
      let next = pile.current.find(item => item.report?.id === result.id) || null;
      if (next && !(await verifyCase(next))) next = null;
      if (!next) next = await createCase(result);
      const rest = reducedMotion() ? 0 : 420 - (performance.now() - began);
      if (rest > 0) await new Promise(done => setTimeout(done, rest));
      if (mine !== ticket.current) return;
      keep(next);
      lay(next);
    } catch {
      if (mine === ticket.current) say('Couldn’t read those. Try again.', { wrong: true });
    } finally {
      if (mine === ticket.current) setWorking('');
    }
  }

  async function openSlip(slip) {
    if (working) return;
    const mine = ++ticket.current;
    const intact = await verifyCase(slip);
    if (mine !== ticket.current) return;
    if (!intact) { say('This reading was changed after it was saved. It won’t open.', { wrong: true }); return; }
    if (trayIsEmpty(form)) {
      setForm({ ...blankTray(slip.report.asOf), vendor: slip.report.vendor, ...slip.report.documents });
      setOwnCompany(true);
    }
    lay(slip);
  }

  function clearPile() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      pile.current = [];
      setSaved({ pile: [], torn: false });
      say('Pile cleared.');
    } catch {
      say('This browser won’t let the pile be cleared.', { wrong: true });
    }
  }

  function backToTray() {
    setRecord(null);
    scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  // The papers slide out of the tray one after another, and the slip lands last.
  useLayoutEffect(() => {
    if (!out || !desk.current) return;
    const sheets = [...desk.current.querySelectorAll('[data-arrives]')].sort((a, b) => Number(a.dataset.arrives) - Number(b.dataset.arrives));
    sound.slide(0.34);
    sheets.forEach((sheet, i) => { settle(sheet, { y: -70 - i * 14, rotate: i % 2 ? 3 : -3, opacity: 0 }, { duration: 480, delay: i * 85, lift: 0.5, quiet: i > 0 }); });
    found.current?.focus({ preventScroll: true });
  }, [out]);

  // ——— the book

  // Ask the book, without writing anything, whether these papers may go in and what that would add.
  useEffect(() => {
    if (!report) { setBook({ checking: false }); return undefined; }
    const waits = bookWaits(report);
    if (waits || !service.workspace) { setBook({ checking: false, waits: waits || 'The book is still opening.' }); return undefined; }
    let gone = false;
    setBook({ checking: true });
    previewEvidencePortfolio(service.workspace, report, { actorRole: 'admin' })
      .then(result => { if (!gone) setBook({ checking: false, plan: result.plan }); })
      .catch(error => { if (!gone) setBook({ checking: false, error }); });
    return () => { gone = true; };
  }, [report, service.workspace]);

  // When the book holds this promise on other terms, its page is the place to change it.
  const twin = useMemo(() => {
    if (!view || !report?.commitmentRef) return '';
    const name = String(report.vendor || '').trim().toLowerCase();
    const company = view.vendors.find(vendor => vendor.name.trim().toLowerCase() === name);
    return view.commitments.find(c => c.vendorId === company?.id && c.reference === report.commitmentRef)?.id || '';
  }, [view, report]);

  async function writeIn() {
    if (working || !report) return;
    setWorking('writing');
    try {
      const plan = await prepareEvidenceImport(service.workspace, report);
      if (plan.alreadyTracked) {
        go('iou', plan.commitmentId);
        say('That one is already in the book. Nothing was added twice.');
        return;
      }
      const why = whyNot(plan.commands.map(command => command.type), service);
      if (why) { say(why, { wrong: true }); return; }
      const reply = await service.commands(plan.commands);
      if (!reply) return;
      go('iou', plan.commitmentId);
      say('Written in.');
    } catch (e) {
      say(bookProblem(plainError(e)) || 'That didn’t go in. Try again.', { wrong: true });
    } finally {
      if (alive.current) setWorking('');
    }
  }

  // ——— the letter

  async function approve() {
    if (working || !record) return;
    const mine = ++ticket.current;
    setWorking('approving');
    try {
      // An approval covers the words that were approved. Changed words get a new one.
      const base = approvalOf(record) ? { ...record, audit: record.audit.slice(0, 1) } : record;
      const next = await approveCase(base, draft);
      if (mine !== ticket.current) return;
      setLanded(approvalOf(next)?.hash || '');
      setRecord(next);
      keep(next);
      say('Letter approved.');
    } catch (e) {
      if (mine === ticket.current) say(letterProblem(e), { wrong: true });
    } finally {
      if (mine === ticket.current) setWorking('');
    }
  }

  // ——— what is lit

  const lit = hover || (pressed && report ? pressed.marks : []);
  function press(reason) {
    if (pressed?.key === reason.key) { setPressed(null); return; }
    setPressed(reason);
    const first = desk.current?.querySelector(reason.marks.map(id => `[data-marks~="${id}"]`).join(','));
    first?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  const papers = useMemo(() => (report ? SLOTS
    .map(slot => ({ slot, text: report.documents?.[slot.key] || '', marks: marksFor(report, slot.source) }))
    .filter(paper => paper.text.trim()) : []), [report]);

  // ——— on the desk

  if (record && report) {
    const letter = report.requiresApproval && couldRead(report);
    return (
      <>
        <Strip heading={heading} back={<button type="button" className="bk-link" onClick={backToTray}>← Back to the tray</button>}>
          {report.vendor || 'Papers'} · read {slipTime(record.createdAt)}
        </Strip>
        <div ref={desk} className="bk-on-desk bk-tray-desk">
          <div className="bk-tray-read">
            <div className="bk-tray-left">
              {papers.map((paper, i) => (
                <Marked key={paper.slot.key} i={i} slot={paper.slot} text={paper.text} marks={paper.marks} lit={lit} onHover={setHover} company={report.vendor} readAt={record.createdAt} />
              ))}
              {letter && <Letter record={record} draft={draft} onDraft={setDraft} onApprove={approve} approving={working === 'approving'} landed={landed} service={service} say={say} />}
            </div>
            <Found
              report={report}
              lit={lit}
              pressed={pressed?.key}
              onHover={setHover}
              onPress={press}
              book={{ ...book, twin }}
              service={service}
              writing={working === 'writing'}
              onWrite={writeIn}
              onBack={backToTray}
              heading={found}
            >
              {!letter && <SlipDownloads record={record} say={say} />}
            </Found>
          </div>
          <Pile pile={saved.pile} torn={saved.torn} onDesk={record.id} onOpen={openSlip} onClear={clearPile} busy={Boolean(working)} />
        </div>
      </>
    );
  }

  // ——— in the tray

  const whyNotRead = !form.promiseText.trim() ? 'Put the promise in first.'
    : !form.vendor.trim() ? 'Say who it is from.'
      : !isDay(form.asOf) ? 'Pick the day to read it as of.' : '';

  return (
    <>
      <Strip heading={heading}>Drop in what they sent you.</Strip>
      <div className="bk-on-desk bk-tray-desk">
        <div className="bk-tray-top">
          <div
            className={over ? 'bk-tray is-over' : 'bk-tray'}
            onDragEnter={event => { if (hasFiles(event)) { event.preventDefault(); setOver(true); } }}
            onDragOver={event => { if (hasFiles(event)) event.preventDefault(); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOver(false); }}
            onDrop={event => {
              setOver(false);
              if (!hasFiles(event) || event.defaultPrevented) return;
              event.preventDefault();
              takeFiles([...event.dataTransfer.files], null);
            }}
          >
            <div className="bk-tray-box" role="group" aria-label="The tray">
              {SLOTS.map(slot => <Slot key={slot.key} slot={slot} value={form[slot.key]} says={slotSays[slot.key]} onChange={put} onFiles={takeFiles} />)}
              <p className="bk-tray-lip">type · paste · drop a .txt, .eml or .csv on a paper</p>
            </div>
          </div>

          <Paper as="form" w={66} rot={0.9} className="bk-form bk-tray-cover" onSubmit={event => { event.preventDefault(); if (!whyNotRead) readThem(); }}>
            <Field label="Who it is from">
              <input
                type="text"
                value={form.vendor}
                maxLength={120}
                autoComplete="off"
                placeholder="the company"
                onChange={event => { setOwnCompany(event.target.value !== ''); setForm(current => ({ ...current, vendor: event.target.value })); }}
              />
            </Field>
            <Field label="Read it as of">
              <input type="date" value={form.asOf} max={today} required onChange={event => setForm(current => ({ ...current, asOf: event.target.value }))} />
            </Field>
            <Btn big type="submit" why={whyNotRead} busy={working === 'reading' ? 'Reading…' : ''}>Read them</Btn>
          </Paper>
        </div>

        <div className="bk-tray-tries">
          {EXAMPLES.map(example => (
            <button key={example.id} type="button" className="bk-link" disabled={Boolean(working)} onClick={() => tryExample(example)}>{example.label}</button>
          ))}
          {!trayIsEmpty(form) && <button type="button" className="bk-link bk-tray-empty" onClick={emptyTray}>Empty the tray</button>}
        </div>

        <Pile pile={saved.pile} torn={saved.torn} onDesk="" onOpen={openSlip} onClear={clearPile} busy={Boolean(working)} />
      </div>
    </>
  );
}

export default function Tray(props) {
  return props.service.authMode === 'managed-password' ? <TeamTray /> : <OwnTray {...props} />;
}
