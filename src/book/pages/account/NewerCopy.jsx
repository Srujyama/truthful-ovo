// A paper was replaced: the company sent a newer copy of one of the papers this
// promise rests on. Choose which paper, paste the newer text, write it in.
// The copy on file is kept as an older copy; the Papers page shows both.
//
// This is the form itself. It is drawn by ./ChangedTerms.jsx, under the row of
// typed links at the foot of the account sheet, which passes onClose. Mounted
// anywhere else, without onClose, it draws nothing: the row already has it.

import React, { useMemo, useState } from 'react';
import { correspondenceDocuments } from '../../../correspondence.mjs';
import { Btn, Field } from '../../shell/parts.jsx';
import { shortDay, today } from '../../shell/money.mjs';
import { plainError, whyNot } from '../../shell/roles.mjs';
import { paperLook } from './acct-words.mjs';
import { FormSheet } from './af-Form.jsx';
import './forms.css';

export default function NewerCopy(props) {
  return props.onClose && props.view && props.commitment ? <CopyForm {...props} /> : null;
}

/** This promise's papers, each once, as the copy now on file: [{ id, name, title, text, date }]. */
export function papersOf(view, commitment) {
  const seen = new Set();
  const papers = [];
  for (const paper of correspondenceDocuments(view, commitment)) {
    if (!paper.available || seen.has(paper.sourceId)) continue;
    seen.add(paper.sourceId);
    const onFile = view.sources.find(source => source.id === paper.sourceId) || paper.source;
    papers.push({
      id: paper.sourceId,
      name: paperLook(paper, commitment).name,
      title: onFile.title,
      text: onFile.text,
      date: String(onFile.observedAt || onFile.effectiveDate || '').slice(0, 10),
    });
  }
  return papers;
}

function CopyForm({ view, commitment, service, say, past = false, onClose, w, rot }) {
  const papers = useMemo(() => papersOf(view, commitment), [view, commitment]);
  const [pick, setPick] = useState('');
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const [writing, setWriting] = useState(false);
  const paper = papers.find(item => item.id === pick) || papers[0] || null;
  const why = whyNot('REVISE_SOURCE', { actor: service.actor }, { past });
  const year = view.asOf.slice(0, 4);

  async function write(event) {
    event.preventDefault();
    if (!paper || writing) return;
    if (!text.trim()) { setProblem('Paste the newer copy first.'); return; }
    if (text.trim() === String(paper.text).trim()) { setProblem('That is the copy already on file.'); return; }
    setWriting(true);
    try {
      // Dated on the reader's own day; left unsaid, the engine dates it by its UTC day.
      const reply = await service.command({ type: 'REVISE_SOURCE', sourceId: paper.id, text, effectiveDate: today() });
      if (reply) { say('Newer copy on file.'); onClose(); }
    } catch (error) {
      say(plainError(error), { wrong: true });
      service.setError?.('');
    } finally {
      setWriting(false);
    }
  }

  return (
    <FormSheet title="A paper was replaced" kind="NEWER COPY" w={w} rot={rot} onClose={onClose}>
      <form noValidate onSubmit={write}>
        <div className="bk-fields bk-af-blanks">
          <Field label="Which paper" className="bk-af-wide" hint={paper ? `The copy on file came in ${shortDay(paper.date, year)}. It is kept as an older copy.` : undefined}>
            <select value={paper?.id || ''} onChange={event => { setPick(event.target.value); setProblem(''); }}>
              {papers.map(item => <option key={item.id} value={item.id}>{item.name}: {item.title}</option>)}
            </select>
          </Field>
          <Field label="The newer copy, in full" className="bk-af-wide">
            <textarea rows={7} maxLength={250000} value={text} onChange={event => { setText(event.target.value); setProblem(''); }} />
          </Field>
        </div>
        {paper && !text && (
          <p className="bk-af-start">
            <button type="button" className="bk-link" onClick={() => setText(paper.text)}>Start from the copy on file</button>
          </p>
        )}
        <p className="bk-typed bk-af-then">Every open decision on this promise will have to be prepared again.</p>
        {problem && <p className="bk-af-problem" role="alert">{problem}</p>}
        <div className="bk-actions bk-af-footline">
          <Btn as="button" type="submit" why={why} busy={writing ? 'Writing it in…' : ''}>Write it in</Btn>
          <button type="button" className="bk-link" onClick={() => onClose()}>Put it away <kbd>esc</kbd></button>
        </div>
      </form>
    </FormSheet>
  );
}
