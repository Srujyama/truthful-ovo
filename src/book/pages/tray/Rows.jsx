// What was read, one row per paper: what kind of paper it is, the passages
// Truthful found in it with the figure highlighted, and what it took from it.
// A line it took can be pressed: the passages it rests on light up on the
// papers below, the same as on the slip.

import React from 'react';
import { cx } from '../../shell/parts.jsx';
import { reasons } from './plain.mjs';

/** "USD 2,400", "$900", "900.00": the money in a passage. */
const FIGURE = /(?:USD|\$)\s?\d[\d,]*(?:\.\d+)?|\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d+\.\d{2}\b/g;

/** A passage with its figure under the highlighter. */
function Passage({ text }) {
  const parts = [];
  let at = 0;
  for (const hit of String(text).matchAll(FIGURE)) {
    if (hit.index > at) parts.push(text.slice(at, hit.index));
    parts.push(<mark key={hit.index} className="bk-hl">{hit[0]}</mark>);
    at = hit.index + hit[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/** The passages one paper gave the reading: each once, in the order they sit on the paper. */
function passagesOf(paper) {
  const seen = new Set();
  return paper.marks
    .filter(mark => !mark.out)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter(mark => {
      // one passage inside another is said once, as the longer one
      for (const key of seen) {
        const [s, e] = key.split(':').map(Number);
        if (mark.start >= s && mark.end <= e) return false;
      }
      seen.add(`${mark.start}:${mark.end}`);
      return true;
    })
    .map(mark => ({ id: mark.id, text: paper.text.slice(mark.start, mark.end).trim() }))
    .filter(passage => passage.text);
}

export default function Rows({ papers, report, lit, pressed, onHover, onPress }) {
  const why = reasons(report).filter(reason => reason.key !== 'sum');
  return (
    <section className="bk-tray-rows" aria-labelledby="bk-tray-rows-h">
      <h2 className="bk-h2" id="bk-tray-rows-h">What was read <small>{papers.length === 1 ? 'one paper' : `${papers.length} papers`}</small></h2>
      <ol className="bk-tray-rowlist">
        {papers.map((paper, i) => {
          const ids = paper.marks.map(mark => mark.id);
          const passages = passagesOf(paper);
          const left = paper.marks.filter(mark => mark.out).length;
          const took = why.filter(reason => reason.marks.some(id => ids.includes(id)));
          return (
            <li key={paper.slot.key} className="bk-tray-row bk-arrive" style={{ '--i': i }}>
              <span className="bk-tray-row-kind">{paper.slot.noun.toLowerCase()}<b>{paper.slot.title}</b></span>
              <div className="bk-tray-row-found">
                {passages.length > 0
                  ? passages.map(passage => (
                    <p
                      key={passage.id}
                      className={cx(lit.includes(passage.id) && 'is-lit')}
                      onMouseEnter={() => onHover([passage.id])}
                      onMouseLeave={() => onHover(null)}
                    ><Passage text={passage.text} /></p>
                  ))
                  : <p className="is-none">{left ? 'Every row was left out.' : 'Nothing in it the reading could use.'}</p>}
              </div>
              <ul className="bk-tray-row-took">
                {took.map(reason => (
                  <li key={reason.key}>
                    <button
                      type="button"
                      className={cx('bk-tray-took', reason.marks.some(id => lit.includes(id)) && 'is-lit')}
                      aria-pressed={pressed === reason.key}
                      onClick={() => onPress(reason)}
                      onMouseEnter={() => onHover(reason.marks)}
                      onMouseLeave={() => onHover(null)}
                      onFocus={() => onHover(reason.marks)}
                      onBlur={() => onHover(null)}
                    >{reason.text}{reason.owed && <> <b className="bk-tray-owed">{reason.owed}</b></>}</button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
