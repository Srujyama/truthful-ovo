// A paper out of the tray, word for word as it went in, in a white box. The
// passages Truthful used are under the highlighter: exactly the characters the
// reading cites. An invoice row it left out is struck through, with the reason
// beside it.

import React, { useMemo } from 'react';
import { Paper, cx } from '../../shell/parts.jsx';
import { calendarDay, cutPaper } from './plain.mjs';
import { shortDay } from '../../shell/money.mjs';

export default function Marked({ slot, text, marks, lit, onHover, company, readAt, i = 0 }) {
  const lines = useMemo(() => cutPaper(text, marks), [text, marks]);
  const isLit = part => part.marks.some(mark => lit.includes(mark.id));
  return (
    <Paper className="bk-doc bk-tray-paper bk-arrive" style={{ '--i': i + 3 }} data-paper={slot.source} data-arrives={i}>
      <span className="bk-tray-name" aria-hidden="true">{slot.noun.toLowerCase()} · read {shortDay(calendarDay(new Date(readAt))).toLowerCase()}</span>
      <header className="bk-tray-paper-top">
        <h3 className="bk-tray-paper-title">{slot.title}</h3>
        <p className="bk-tray-from">{company}</p>
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
