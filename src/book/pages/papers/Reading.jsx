// One paper at reading size. The headline is what the paper is ("A promise of $2,400,
// due Oct 1, 2026."). Under it the paper itself, word for word, in a white box named by
// its kind, with the figures Truthful read under the highlighter; beside it what it read
// there, as leader rows, then where the paper is used and its copies.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { reducedMotion } from '../../kit/paper.js';
import { Btn, Dater, Sheet, cx } from '../../shell/parts.jsx';
import { href, paperId } from '../../shell/route.mjs';
import { clock, day } from '../../shell/money.mjs';
import { findPassages, paperCopies, paperFacts, paperLook, paperUses, splitByPassages, whatItIs } from './kinds.mjs';

// The demo papers open with a line saying they are made up; the page says so already.
const DEMO_MARK = /^(?:SYNTHETIC ASSURANCE EXAMPLE|FICTIONAL EXAMPLE[^\n]*)\n+/;

/** The top of a paper's page: the way back, what it is and whose, the day. Then the headline. */
export function Head({ back, kicker, heading, children, lede }) {
  return (
    <header className="bk-head bk-pap-head">
      <div className="bk-kicker">
        <a className="bk-link" href={back}>← All papers</a>
        <span>{kicker}</span>
        <Dater style={{ marginLeft: 'auto' }} />
      </div>
      <h1 ref={heading} tabIndex={-1} className="bk-pap-h1">{children}</h1>
      {lede && <p className="bk-lede">{lede}</p>}
    </header>
  );
}

/** An address for something that is not in the book. */
export function Missing({ back, title, children }) {
  return (
    <Sheet>
      <header className="bk-head bk-pap-head">
        <div className="bk-kicker"><a className="bk-link" href={back}>← All papers</a></div>
        <h1 className="bk-pap-h1">{title}</h1>
      </header>
      <div className="bk-part bk-actions">
        <a className="bk-btn" href={back}>Back to every paper</a>
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
  const title = source.title || look.noun;

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
    <Sheet className="bk-pap-reading">
      <Head back={back} kicker={`${look.noun.toLowerCase()} · ${company}`} heading={heading}>{said || title}</Head>

      <div className="bk-part bk-pap-read">
        <article ref={sheet} className="t-box bk-pap-paper" aria-label={`${look.noun}: ${title}`}>
          <span className="t-box-name">{look.noun.toLowerCase()}</span>
          <header className="bk-pap-top">
            <h2 className="bk-pap-name">{title}</h2>
            <p className="bk-pap-from">
              <span>{company}</span>
              <span>{day(source.effectiveDate || source.observedAt)}</span>
              <span>received {day(source.observedAt)}</span>
              {!copy.current && <span>replaced {day(copy.replacedAt)}</span>}
            </p>
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
            ) : i === 0 ? part.text.replace(DEMO_MARK, '') : part.text))}
          </pre>
        </article>

        <aside className="bk-pap-side" aria-label="What Truthful read here">
          <h2 className="bk-pap-side-head">What Truthful read here</h2>
          {facts.length ? (
            <ul className="bk-pap-facts">
              {facts.map((fact, i) => {
                const printed = passages.some(passage => passage.facts.includes(i));
                const inside = (
                  <>
                    <span>{fact.label}</span>
                    <i className="t-dots" />
                    <b>{printed ? <em className={cx('bk-hl', litFacts.includes(i) && 'is-lit')}>{fact.value}</em> : fact.value}</b>
                  </>
                );
                return (
                  <li key={i}>
                    {printed ? (
                      <button
                        type="button"
                        className={cx('t-row bk-pap-fact', litFacts.includes(i) && 'is-lit')}
                        onMouseEnter={() => point(i)}
                        onMouseLeave={() => setLit(null)}
                        onFocus={() => point(i)}
                        onBlur={() => setLit(null)}
                        onClick={() => point(i)}
                      >{inside}</button>
                    ) : <div className={cx('t-row bk-pap-fact', fact.worked && 'is-worked')}>{inside}</div>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="bk-pap-said">
              {rests
                ? <>The book still reads <a className="bk-link" href={href('papers', paperId(source.id, rests.revision))}>the copy from {day(rests.receivedAt)}</a>.</>
                : uses.length ? 'No figure in the book comes from this paper.' : 'Nothing in the book rests on this paper yet.'}
            </p>
          )}

          {uses.length > 0 && (
            <>
              <h3 className="bk-label">it is used in</h3>
              <ul className="bk-pap-uses">
                {uses.map(use => <li key={JSON.stringify(use.to)}><a className="bk-pap-use" href={href(...use.to)}>{use.label}<span aria-hidden="true">→</span></a></li>)}
              </ul>
            </>
          )}
          {!uses.length && facts.length > 0 && (
            <>
              <h3 className="bk-label">it is used in</h3>
              <p className="bk-pap-said">Nothing in the book rests on this copy yet.</p>
            </>
          )}

          <h3 className="bk-label">{copies.length === 1 ? 'one copy on file' : `${copies.length} copies on file`}</h3>
          <ol className="bk-pap-copies">
            {copies.map(item => {
              const open = item.revision === source.revision;
              return (
                <li key={item.revision} className={cx('t-row', open && 'is-open')}>
                  <a className="bk-link" href={href('papers', paperId(source.id, item.revision))} aria-current={open ? 'true' : undefined}>
                    {day(item.receivedAt)}, {clock(item.receivedAt)}
                  </a>
                  <i className="t-dots" />
                  <small>{item.current ? 'the copy on file' : `replaced ${day(item.replacedAt)}`}{open && copies.length > 1 ? ' · this one' : ''}</small>
                </li>
              );
            })}
          </ol>

          <div className="bk-actions bk-pap-foot">
            <Btn onClick={download}>Download this text</Btn>
            <a className="bk-link" href={back}>← All papers</a>
          </div>
        </aside>
      </div>
    </Sheet>
  );
}
