// Read before: the earlier readings, one hairline row each: the company, the
// figure still owed, when it was read. Press one and its papers come back out.

import React, { useEffect, useRef, useState } from 'react';
import { Btn, cx } from '../../shell/parts.jsx';
import { pileSlip } from './plain.mjs';

const SHOWN = 6;

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
    <section className="bk-part bk-tray-pile" aria-labelledby="bk-tray-pile-h">
      <h2 className="bk-h2" id="bk-tray-pile-h">
        <span>Read before <small>{pile.length}</small></span>
        {asking ? (
          <span className="bk-actions bk-tray-pile-ask" role="group" aria-label="Clear the pile">
            <span className="bk-why">{pile.length === 1 ? 'Throw this reading away?' : `Throw all ${pile.length} readings away?`} They can’t be brought back.</span>
            <Btn quiet onClick={() => { setAsking(false); onClear(); }}>Throw them away</Btn>
            <button ref={keep} type="button" className="bk-link" onClick={() => setAsking(false)}>Keep them</button>
          </span>
        ) : (
          <button type="button" className="bk-link" onClick={() => (pile.length ? setAsking(true) : onClear())}>Clear the pile</button>
        )}
      </h2>
      {torn && !pile.length && <p className="bk-why">The readings from an earlier visit can’t be read any more. Clear the pile to start a new one.</p>}
      {pile.length > 0 && (
        <ul className="bk-tray-slips">
          {shown.map(record => {
            const slip = pileSlip(record);
            const here = record.id === onDesk;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  className={cx('bk-tray-slip', here && 'is-here')}
                  onClick={() => onOpen(record)}
                  disabled={busy}
                  aria-current={here ? 'true' : undefined}
                  aria-label={`${slip.company}: ${slip.owed ? `${slip.owed} ` : ''}${slip.said}, read ${slip.when}${slip.approved ? ', letter approved' : ''}`}
                >
                  <b>{slip.company}</b>
                  <span>{slip.owed && <em className="bk-tray-owed">{slip.owed}</em>} {slip.said}</span>
                  <small>{slip.when}</small>
                  <i>{[slip.approved && 'letter approved', here && 'out now'].filter(Boolean).join(' · ')}</i>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {more > 0 && <button type="button" className="bk-link bk-tray-pile-more" onClick={() => setAll(true)}>{more === 1 ? 'One more' : `${more} more`}</button>}
    </section>
  );
}
