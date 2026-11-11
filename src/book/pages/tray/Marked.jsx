// A paper out of the tray, at reading size, word for word as it went in. The
// passages Truthful used are under the highlighter: exactly the characters the
// reading cites. An invoice row it left out has a pen line through it and the
// reason written beside it.

import React, { useMemo } from 'react';
import { Paper, Stamp, cx } from '../../shell/parts.jsx';
import { stampDay } from '../../shell/money.mjs';
import { calendarDay, cutPaper } from './plain.mjs';

export default function Marked({ slot, text, marks, lit, onHover, company, readAt, i = 0 }) {
  const lines = useMemo(() => cutPaper(text, marks), [text, marks]);
  const isLit = part => part.marks.some(mark => lit.includes(mark.id));
  return (
    <Paper w={160} stock={slot.stock} rot={slot.rot * 0.45} className="bk-doc bk-tray-paper" data-paper={slot.source} data-arrives={i}>
      <header className="bk-tray-paper-top">
        <span className="bk-doc-kind">{slot.noun}</span>
        <h2 className="bk-tray-paper-title">{slot.title}</h2>
        <p className="bk-tray-from">{company}</p>
        <Stamp small seed={`read-${slot.source}-${readAt}`} sub={stampDay(calendarDay(new Date(readAt)))} className="bk-tray-read-stamp">Read</Stamp>
      </header>
      <div className={cx('bk-tray-text', slot.source === 'invoice' && 'is-rows')}>
        {lines.map((line, n) => (
          <div key={n} className="bk-tray-line">
            {line.parts.length === 0 && '​'}
            {line.parts.map(part => {
              const used = part.marks.filter(mark => !mark.out);
              const out = part.marks.filter(mark => mark.out);
              const names = part.marks.map(mark => mark.id);
              const hover = { onMouseEnter: () => onHover(names), onMouseLeave: () => onHover(null) };
              if (used.length) {
                return <mark key={part.start} className={cx('bk-hl', isLit(part) && 'is-lit')} data-marks={names.join(' ')} {...hover}>{part.text}</mark>;
              }
              if (out.length) {
                const ends = out.filter(mark => mark.end === part.end);
                return (
                  <React.Fragment key={part.start}>
                    <s className={cx('bk-tray-out', isLit(part) && 'is-lit')} data-marks={names.join(' ')} {...hover}>{part.text}</s>
                    {ends.map(mark => <i key={mark.id} className="bk-tray-why">{mark.out}</i>)}
                  </React.Fragment>
                );
              }
              return <React.Fragment key={part.start}>{part.text}</React.Fragment>;
            })}
          </div>
        ))}
      </div>
    </Paper>
  );
}
