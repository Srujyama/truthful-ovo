// Read before: the earlier readings, kept as a small pile of slips at the edge of
// the desk. Each says the company, the figure still owed, and when it was read.
// Press one and its papers go back on the desk.

import React, { useEffect, useRef, useState } from 'react';
import { Btn, Paper, cx } from '../../shell/parts.jsx';
import { pileSlip } from './plain.mjs';

const SHOWN = 6;

/** The same slip always lies at the same small turn. */
function turnOf(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 9) - 4) * 0.45;
}

export default function Pile({ pile, torn, onDesk, onOpen, onClear, busy }) {
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const keep = useRef(null);
  useEffect(() => { if (asking) keep.current?.focus(); }, [asking]);
  useEffect(() => { if (!pile.length) setAsking(false); }, [pile.length]);
  if (!pile.length && !torn) return null;

  const shown = all ? pile : pile.slice(0, SHOWN);
  const more = pile.length - shown.length;
  return (
    <section className="bk-tray-pile" aria-labelledby="bk-tray-pile-h">
      <header className="bk-tray-pile-top">
        <h2 id="bk-tray-pile-h">Read before</h2>
        {asking ? (
          <span className="bk-actions" role="group" aria-label="Clear the pile">
            <span className="bk-desk-said">{pile.length === 1 ? 'Throw this slip away?' : `Throw all ${pile.length} slips away?`} They can’t be brought back.</span>
            <Btn quiet className="on-desk" onClick={() => { setAsking(false); onClear(); }}>Throw them away</Btn>
            <button ref={keep} type="button" className="bk-link" onClick={() => setAsking(false)}>Keep them</button>
          </span>
        ) : (
          <button type="button" className="bk-link" onClick={() => (pile.length ? setAsking(true) : onClear())}>Clear the pile</button>
        )}
      </header>
      {torn && !pile.length && <p className="bk-desk-said">The slips from an earlier visit can’t be read any more. Clear the pile to start a new one.</p>}
      {pile.length > 0 && (
        <ul className="bk-tray-slips">
          {shown.map(record => {
            const slip = pileSlip(record);
            const here = record.id === onDesk;
            return (
              <li key={record.id}>
                <Paper
                  as="button"
                  type="button"
                  w={56}
                  rot={turnOf(record.id)}
                  className={cx('bk-tray-slip', here && 'is-here')}
                  onClick={() => onOpen(record)}
                  disabled={busy}
                  aria-current={here ? 'true' : undefined}
                  aria-label={`${slip.company}: ${slip.owed ? `${slip.owed} ` : ''}${slip.said}, read ${slip.when}${slip.approved ? ', letter approved' : ''}`}
                >
                  <b>{slip.company}</b>
                  <span>{slip.owed && <em className="bk-tray-owed">{slip.owed}</em>} {slip.said}</span>
                  <small>{slip.when}</small>
                  {(here || slip.approved) && <i>{[slip.approved && 'letter approved', here && 'on the desk'].filter(Boolean).join(' · ')}</i>}
                </Paper>
              </li>
            );
          })}
        </ul>
      )}
      {more > 0 && <button type="button" className="bk-link bk-tray-pile-more" onClick={() => setAll(true)}>{more === 1 ? 'One more underneath' : `${more} more underneath`}</button>}
    </section>
  );
}
