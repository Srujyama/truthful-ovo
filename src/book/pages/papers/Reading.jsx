// One paper at reading size: the paper itself on the left, word for word, with the
// passages Truthful took a figure or a date from under the highlighter; on the right
// a slip saying what it read there, where the paper is used, and its copies.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { reducedMotion } from '../../kit/paper.js';
import { Btn, Dater, Paper, Sheet, SheetHead, Stamp, cx } from '../../shell/parts.jsx';
import { href, paperId } from '../../shell/route.mjs';
import { clock, day, stampDay } from '../../shell/money.mjs';
import { findPassages, paperCopies, paperFacts, paperLook, paperUses, splitByPassages, whatItIs } from './kinds.mjs';

/** The top edge of the Papers page, left showing above the desk: the way back, and what is lying here. */
export function Strip({ back, children }) {
  return (
    <Sheet holes={false} className="bk-pap-strip">
      <div className="bk-kicker">
        <a className="bk-link" href={back}>← All papers</a>
        <span>{children}</span>
        <Dater style={{ marginLeft: 'auto' }} />
      </div>
    </Sheet>
  );
}

/** An address for something that is not in the book. */
export function Missing({ back, title, children }) {
  return (
    <Sheet>
      <SheetHead kicker="Papers" title={title} date={false} />
      <div className="bk-part bk-actions">
        <a className="bk-btn" href={back}>← All papers</a>
        {children}
      </div>
    </Sheet>
  );
}

export default function Reading({ view, target, back, say }) {
  const copies = useMemo(() => paperCopies(view, target.sourceId), [view, target.sourceId]);
  const revision = target.revision ?? copies[0]?.revision;
  const source = view.sourceVersions.find(item => item.id === target.sourceId && item.revision === revision);
  const read = useMemo(() => {
    if (!source) return null;
    const facts = paperFacts(view, source);
    const passages = findPassages(source.text, facts);
    return { facts, passages, parts: splitByPassages(source.text, passages), uses: paperUses(view, source.id, source.revision), said: whatItIs(view, source) };
  }, [view, source]);

  const [lit, setLit] = useState(null);          // { fact: 2 } or { passage: 0 }: what the hand is on
  const sheet = useRef(null), heading = useRef(null);
  useEffect(() => { setLit(null); heading.current?.focus({ preventScroll: true }); }, [target.sourceId, revision]);

  if (!source) {
    return (
      <Missing back={back} title="That paper isn’t on file.">
        {copies.length > 0 && <a className="bk-link" href={href('papers', paperId(target.sourceId, copies[0].revision))}>Open the copy that is</a>}
      </Missing>
    );
  }

  const look = paperLook(source.kind);
  const company = view.vendors.find(vendor => vendor.id === source.vendorId)?.name || '';
  const copy = copies.find(item => item.revision === source.revision);
  const { facts, passages, parts, uses, said } = read;
  // A newer copy can come in while a promise still rests on the one before it. Say which copy the book reads.
  const rests = !facts.length && !uses.length ? copies.find(item => item.revision !== source.revision && paperUses(view, source.id, item.revision).length > 0) : null;
  const litFacts = lit?.passage != null ? passages[lit.passage]?.facts || [] : lit?.fact != null ? [lit.fact] : [];
  const isLit = passage => (lit?.passage != null ? passages[lit.passage] === passage : lit?.fact != null && passage.facts.includes(lit.fact));

  function point(index) {
    setLit({ fact: index });
    const mark = sheet.current?.querySelector(`mark[data-facts~="${index}"]`);
    mark?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function download() {
    const url = URL.createObjectURL(new Blob([source.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `truthful-${source.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-copy-${source.revision}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    say('Saved to your downloads.');
  }

  return (
    <>
      <Strip back={back}>{look.noun} · {company}</Strip>
      <div className="bk-on-desk bk-pap-desk">
        <div className="bk-pap-read">
          <div ref={sheet} className="bk-pap-left">
            <Paper w={154} stock={look.stock} rot={-0.5} className="bk-doc bk-pap-sheet">
              <header className="bk-pap-top">
                <span className="bk-doc-kind">{look.noun}</span>
                <h1 ref={heading} tabIndex={-1} className="bk-pap-title">{source.title || look.noun}</h1>
                <p className="bk-pap-from">{company} · {day(source.effectiveDate || source.observedAt)}</p>
                <span className="bk-pap-stamps">
                  <Stamp small seed={`received-${source.id}-${source.revision}`} sub={stampDay(source.observedAt)}>Received</Stamp>
                  {!copy.current && <Stamp small seed={`replaced-${source.id}-${source.revision}`} sub={stampDay(copy.replacedAt)}>Replaced</Stamp>}
                </span>
              </header>
              <pre className="bk-pap-text">
                {parts.map((part, i) => (part.passage ? (
                  <mark
                    key={i}
                    className={cx('bk-hl', isLit(part.passage) && 'is-lit')}
                    data-facts={part.passage.facts.join(' ')}
                    onMouseEnter={() => setLit({ passage: passages.indexOf(part.passage) })}
                    onMouseLeave={() => setLit(null)}
                  >{part.text}</mark>
                ) : part.text))}
              </pre>
            </Paper>
          </div>

          <Paper as="aside" w={118} rot={0.7} className="bk-form bk-pap-slip" aria-label="What Truthful read here">
            <h2 className="bk-form-title">What Truthful read here</h2>
            {said && <p className="bk-hand bk-pap-said">{said}</p>}
            {facts.length ? (
              <ul className="bk-pap-facts">
                {facts.map((fact, i) => {
                  const printed = passages.some(passage => passage.facts.includes(i));
                  const inside = <><span>{fact.label}</span><b>{printed ? <em className={cx('bk-hl', litFacts.includes(i) && 'is-lit')}>{fact.value}</em> : fact.value}</b></>;
                  return (
                    <li key={i}>
                      {printed ? (
                        <button
                          type="button"
                          className={cx('bk-pap-fact', litFacts.includes(i) && 'is-lit')}
                          onMouseEnter={() => point(i)}
                          onMouseLeave={() => setLit(null)}
                          onFocus={() => point(i)}
                          onBlur={() => setLit(null)}
                          onClick={() => point(i)}
                        >{inside}</button>
                      ) : <div className="bk-pap-fact">{inside}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="bk-hand bk-pap-said">
                {rests
                  ? <>The book still reads <a className="bk-link" href={href('papers', paperId(source.id, rests.revision))}>the copy from {day(rests.receivedAt)}</a>.</>
                  : uses.length ? 'No figure in the book comes from this paper.' : 'Nothing in the book rests on this paper yet.'}
              </p>
            )}

            {uses.length > 0 && (
              <>
                <h3 className="bk-label">It is used in</h3>
                <ul className="bk-pap-uses">
                  {uses.map(use => <li key={JSON.stringify(use.to)}><a className="bk-link" href={href(...use.to)}>{use.label}</a></li>)}
                </ul>
              </>
            )}
            {!uses.length && facts.length > 0 && (
              <>
                <h3 className="bk-label">It is used in</h3>
                <p className="bk-typed bk-muted">Nothing in the book rests on this copy yet.</p>
              </>
            )}

            <h3 className="bk-label">{copies.length === 1 ? 'One copy on file' : `${copies.length} copies on file`}</h3>
            <ol className="bk-pap-copies">
              {copies.map(item => {
                const open = item.revision === source.revision;
                return (
                  <li key={item.revision} className={cx(open && 'is-open')}>
                    <a className="bk-link" href={href('papers', paperId(source.id, item.revision))} aria-current={open ? 'true' : undefined}>
                      {day(item.receivedAt)}, {clock(item.receivedAt)}
                    </a>
                    <small>{item.current ? 'the copy on file' : `replaced ${day(item.replacedAt)}`}{open && copies.length > 1 && <i>this one</i>}</small>
                  </li>
                );
              })}
            </ol>

            <div className="bk-actions bk-pap-foot">
              <Btn onClick={download}>Download this text</Btn>
              <a className="bk-link" href={back}>← All papers</a>
            </div>
          </Paper>
        </div>
      </div>
    </>
  );
}
