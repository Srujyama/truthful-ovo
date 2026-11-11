// The letter asking for the rest: on bond, in the typed face, yours to change.
// Approving it brings a stamp down with the time on it, and only an approved
// letter can be downloaded as an email or copied. Change a word afterwards and it
// needs approving again.

import React, { useId, useLayoutEffect, useRef } from 'react';
import { emailFor, packetFor, summaryCsv } from '../../../recovery.mjs';
import { evidenceActions } from '../../../evidence-ui.mjs';
import { Btn, Paper, Stamp, Why, cx } from '../../shell/parts.jsx';
import { whyNot } from '../../shell/roles.mjs';
import { approvalOf, fileName, stampTime } from './plain.mjs';
import { copyText, saveFile } from './save.mjs';

/** The figures and the whole reading, as files. */
export function useDownloads(record, say) {
  const company = record.report.vendor;
  return {
    figures() {
      const name = fileName('figures', company, 'csv');
      saveFile(name, summaryCsv(record), 'text/csv;charset=utf-8');
      say(`Saved ${name}.`);
    },
    reading() {
      const name = fileName('reading', company, 'json');
      saveFile(name, JSON.stringify(packetFor(record), null, 2), 'application/json');
      say(`Saved ${name}.`);
    },
  };
}

export default function Letter({ record, draft, onDraft, onApprove, approving, landed, service, say }) {
  const id = useId();
  const box = useRef(null);
  const report = record.report;
  const approval = approvalOf(record);
  const changed = Boolean(approval) && draft !== approval.payload.draft;
  const good = Boolean(approval) && !changed;
  const save = useDownloads(record, say);

  // The sheet is as long as what is written on it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => {
      if (!el.offsetParent) return;                // in the drawer: measure when the page is turned back to
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    fit();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    watch?.observe(el.parentElement);
    return () => watch?.disconnect();
  }, [draft]);

  const mayAsk = evidenceActions(report, { approved: false, draft }).approval.allowed;
  const why = !draft.trim()
    ? 'The letter is blank. Write what you are asking for.'
    : !mayAsk ? 'There is nothing to ask for on this one.' : whyNot('APPROVE_ACTION', service);
  const waits = `${id}-waits`;

  function email() {
    const name = fileName('letter', report.vendor, 'eml');
    saveFile(name, emailFor(record), 'message/rfc822');
    say(`Saved ${name}. Open it in your mail to send it.`);
  }
  async function copy() {
    if (await copyText(approval.payload.draft)) say('Copied.');
    else say('Couldn’t copy it. Select the letter and copy it by hand.', { wrong: true });
  }

  return (
    <Paper w={160} rot={0.35} className="bk-doc bk-tray-paper bk-tray-letter" data-arrives="5" aria-label="The letter asking for the rest">
      <header className="bk-tray-paper-top">
        <span className="bk-doc-kind">Letter</span>
        <h2 className="bk-tray-paper-title">Asking {report.vendor} for the rest</h2>
        <p className="bk-tray-from">To their billing team</p>
        {!approval && <Stamp small seed={`draft-${record.id}`} className="bk-tray-read-stamp">Draft</Stamp>}
      </header>
      {report.replyCondition && <p className="bk-hand bk-tray-letter-note">It asks on the first promise. The strings in their later note aren’t taken up.</p>}

      <label className="sr-only" htmlFor={id}>The letter</label>
      <textarea
        id={id}
        ref={box}
        className="bk-tray-letter-text"
        value={draft}
        rows={8}
        maxLength={20000}
        onChange={event => onDraft(event.target.value)}
      />
      {changed && <p className="bk-hand bk-tray-letter-note">You changed it after it was approved.</p>}

      <footer className="bk-tray-letter-foot">
        {approval && (
          <span className={cx('bk-tray-letter-stamp', changed && 'is-void')}>
            <Stamp key={approval.hash} land={landed === approval.hash} sub={stampTime(approval.at)} seed={`approved-${approval.hash}`}>Approved</Stamp>
          </span>
        )}
        {!good && <Btn big onClick={onApprove} why={why} busy={approving ? 'Approving…' : ''}>Approve this letter</Btn>}
        <div className="bk-actions bk-tray-sends">
          <Btn onClick={email} disabled={!good} aria-describedby={good ? undefined : waits}>Download the email</Btn>
          <Btn quiet onClick={copy} disabled={!good} aria-describedby={good ? undefined : waits}>Copy the letter</Btn>
          <button type="button" className="bk-link" onClick={save.figures} disabled={!good} aria-describedby={good ? undefined : waits}>Download the figures (CSV)</button>
          <button type="button" className="bk-link" onClick={save.reading} disabled={!good} aria-describedby={good ? undefined : waits}>Download this reading (JSON)</button>
          {!good && <span id={waits}><Why>{changed ? 'Approve it again first.' : 'Approve the letter first.'}</Why></span>}
        </div>
      </footer>
    </Paper>
  );
}
