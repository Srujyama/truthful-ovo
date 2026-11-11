// Find: one line, typed. It looks through the companies, the IOUs, the papers
// and the credit notes, and takes you to the one you pick.

import React, { useMemo, useState } from 'react';
import { Close, Over, Paper } from './parts.jsx';
import { paperId } from './route.mjs';
import { dollars } from './money.mjs';

const PLACES = [
  { kind: 'Page', title: 'The book of IOUs', said: 'every promise and what is still owed', to: ['ious'] },
  { kind: 'Page', title: 'To do', said: 'what needs a hand', to: ['todo'] },
  { kind: 'Page', title: 'Papers', said: 'every email, invoice and credit note', to: ['papers'] },
  { kind: 'Page', title: 'Companies', said: 'the index', to: ['companies'] },
  { kind: 'Page', title: 'Day book', said: 'everything that happened, in order', to: ['daybook'] },
  { kind: 'Page', title: 'Balance', said: 'the totals as of a date', to: ['balance'] },
  { kind: 'Page', title: 'In-tray', said: 'drop papers in to be read', to: ['tray'] },
  { kind: 'Page', title: 'Test bench', said: 'for engineers', to: ['bench'] },
];

function everything(view) {
  const company = id => view.vendors.find(v => v.id === id)?.name || id;
  return [
    ...view.commitments.map(c => ({ kind: 'IOU', title: company(c.vendorId), said: `${dollars(c.promisedCents)} promised, ${dollars(c.outstandingCents)} still owed · ${c.reference}`, to: ['iou', c.id] })),
    ...view.vendors.map(v => ({ kind: 'Company', title: v.name, said: '', to: ['companies', v.id] })),
    ...view.credits.map(c => ({ kind: 'Credit note', title: `${company(c.vendorId)} · ${c.invoiceId}`, said: `${dollars(c.amountCents)} ${c.status === 'applied' ? 'on an invoice' : 'issued, not on an invoice yet'}`, to: ['papers', `credit:${c.id}`] })),
    ...view.sources.map(s => ({ kind: 'Paper', title: s.title, said: company(s.vendorId), to: ['papers', paperId(s.id, s.revision)] })),
    ...PLACES,
  ];
}

export default function FindOver({ view, go, onClose }) {
  const [text, setText] = useState('');
  const all = useMemo(() => everything(view), [view]);
  const hits = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const rows = needle ? all.filter(r => `${r.title} ${r.said} ${r.kind}`.toLowerCase().includes(needle)) : all.filter(r => r.kind === 'IOU' || r.kind === 'Page');
    return rows.slice(0, 14);
  }, [all, text]);
  function open(row) { onClose(); go(...row.to); }
  return (
    <Over onClose={onClose} label="Find">
      <Paper w={150} rot={0.4} className="bk-form">
        <Close onClose={onClose} />
        <form className="bk-find" style={{ fontSize: 19, marginBottom: 14 }} onSubmit={e => { e.preventDefault(); if (hits[0]) open(hits[0]); }}>
          <label htmlFor="bk-find-input" className="bk-label">Find</label>
          <input id="bk-find-input" data-autofocus="" type="search" value={text} onChange={e => setText(e.target.value)} placeholder="a company, a paper, an amount" autoComplete="off" spellCheck={false} />
        </form>
        {hits.length ? (
          <ul>
            {hits.map((row, i) => (
              <li key={i} style={{ borderTop: '1px solid rgb(29 39 64 / 0.16)' }}>
                <button type="button" className="bk-link" style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, width: '100%', padding: '8px 0', textDecoration: 'none' }} onClick={() => open(row)}>
                  <span className="bk-label" style={{ paddingTop: 4 }}>{row.kind}</span>
                  <span><b style={{ font: '600 16.5px/1.25 var(--bk-display)' }}>{row.title}</b>{row.said && <span className="bk-muted" style={{ display: 'block', fontSize: 13.5 }}>{row.said}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="bk-hand">Nothing in the book by that name.</p>}
      </Paper>
    </Over>
  );
}
