// Truthful — the book of IOUs, drawn on the desk.
//
// One page: a ledger of what vendors promised, and under it the desk where an
// IOU is opened, chased and paid. What is on the page comes from the app: the
// book is handed a reading of the workspace (selectors.mjs) and draws it, and
// everything a visitor does that changes the records is asked of the app
// (`actions`), which answers with a new reading. The row, the slip and the
// totals are drawn from the same reading, so they always agree with each other
// and with every other screen.
//
// Paper behaviour (stamps, the tally strip, sliding, picking up, sound) comes
// from the kit. What is here is the book's own: the page, the slip and its
// papers, the letter, the offers, the next invoice, the in-tray.
//
// For a screenshot of a state: ?view=book&open=<promise id>  and  &letter=1

import { sound, stamp, makeStamp, tally, settle, depart, pickup, paperClip, tagString, tornEdge, reducedMotion } from "../kit/paper.js";
import { money, figure, price, dateShort, dateDay, dateLong } from "./selectors.mjs";

// ————————————————————————————————————————————————————————— the page

const PAGE = `
<div class="desk" id="desk">

  <header class="top">
    <p class="mark">Truthful</p>
    <div class="top-tools">
      <button type="button" class="sound" id="sound" aria-pressed="true">Paper sounds: <span id="sound-state">on</span></button>
      <button type="button" class="rest-tab" id="rest-tab" aria-expanded="false" aria-controls="rest" hidden><span class="rest-long">The rest of the book</span><span class="rest-short">The rest</span></button>
      <button type="button" class="howto-tab" id="howto-tab" aria-expanded="false" aria-controls="howto">How it works</button>
      <div class="tools-slot"><slot name="tools"></slot></div>
    </div>
  </header>

  <aside class="paper rest-note" id="rest" hidden>
    <div class="paper-face stock-bond">
      <ul>
        <li><button type="button" class="link" data-go="todo">To do</button><span>what needs you next</span></li>
        <li><button type="button" class="link" data-go="papers">Papers</button><span>every email and invoice</span></li>
        <li><button type="button" class="link" data-go="companies">Companies</button><span>who promised what</span></li>
        <li><button type="button" class="link" data-go="daybook">Day book</button><span>what happened, in order</span></li>
        <li><button type="button" class="link" data-go="balance">Balance</button><span>the totals</span></li>
        <li><button type="button" class="link" data-go="bench">Workbench</button><span>tools for developers</span></li>
      </ul>
    </div>
  </aside>

  <aside class="paper howto" id="howto" hidden>
    <div class="paper-face stock-bond">
      <ol>
        <li>A vendor writes that they will credit you. Drop that email in.</li>
        <li>Truthful reads every invoice after it and punches out what was actually credited.</li>
        <li>If boxes are still empty past the date, it writes the letter. You approve it.</li>
      </ol>
    </div>
  </aside>

  <section class="tray" id="tray" aria-label="In-tray">
    <div class="tray-box">
      <div class="tray-floor" id="tray-floor">
        <div class="paper tray-note" id="tray-note">
          <div class="paper-face stock-bond">
            <button type="button" class="tray-ask" id="tray-ask">Drop an email or an invoice here</button>
            <p class="tray-or">or <button type="button" class="tray-paste" id="tray-paste">paste the text</button></p>
          </div>
        </div>
      </div>
      <p class="tray-line" id="tray-line" role="status" aria-live="polite"></p>
    </div>
    <input type="file" id="tray-file" accept=".txt,.eml,.csv,.md,text/plain,text/csv,message/rfc822" hidden>
  </section>

  <div class="tabs-slot"><slot name="tabs"></slot></div>

  <main class="paper sheet" id="sheet">
    <div class="paper-face stock-ledger">
      <i class="sheet-hole" aria-hidden="true"></i>
      <i class="sheet-hole" aria-hidden="true"></i>
      <i class="sheet-hole" aria-hidden="true"></i>

      <header class="head">
        <h1>Vendors promise.<br>Invoices forget.</h1>
        <p class="lede">Truthful writes down what each vendor promised, then checks every invoice until you have been paid.</p>
        <span class="stamp is-small is-plain dater" id="dater" aria-hidden="true"></span>
      </header>

      <section class="ledger" id="ledger" aria-label="Promises">
        <div class="l-head" aria-hidden="true">
          <span></span>
          <span>Vendor</span>
          <span>They said</span>
          <span>Due</span>
          <span class="is-num">They promised</span>
          <span class="is-num">Credited so far</span>
          <span class="is-num is-owed">Still owed</span>
          <span></span>
        </div>
        <div class="l-rows" id="rows"></div>
        <div class="l-total" id="total" hidden>
          <span></span>
          <span class="t-label">Total</span>
          <span class="t-num"><small>They promised</small><b id="t-promised"></b></span>
          <span class="t-num"><small>Credited so far</small><b id="t-invoice"></b></span>
          <span class="t-num is-owed"><small>Still owed</small><b id="t-owed"></b></span>
          <span></span>
        </div>
      </section>

      <p class="notice" id="notice"></p>
    </div>
  </main>

  <section class="below" id="below">
    <div class="scene-slot" id="scene-slot"></div>
    <div class="spike" id="spike">
      <p class="spike-label">Paid in full</p>
      <i class="spike-base" aria-hidden="true"></i>
      <div class="spike-slips" id="spike-slips"></div>
      <i class="spike-pin" aria-hidden="true"></i>
    </div>
  </section>

</div>`;

// ————————————————————————————————————————————————————————— small things

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** h("p", { class: "x" }, "text", node) — a DOM element. Null attributes and children are skipped. */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** NOV 10 2026: the way a dater stamp prints a moment, on the visitor's own calendar. */
const stampMoment = (date) => `${MONTHS[date.getMonth()].toUpperCase()} ${date.getDate()} ${date.getFullYear()}`;
const dayOf = (date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`;
/** 9:41 AM */
const clock = (date) => { const hr = date.getHours(); return `${hr % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hr < 12 ? "AM" : "PM"}`; };

// What a visitor left on the desk, kept while they look at a full case and
// come back. A reload opens the book fresh.
const kept = { open: null, letters: new Set(), drafts: new Map() };

/**
 * Draw the book inside `root` and keep it in step with the app.
 * @param {HTMLElement} root   the .book-front element
 * @param {object} actions     what the book asks of the app. Each one that changes the
 *                             records resolves with the new reading (selectors.mjs bookFor):
 *                               approve(id)  accept(id, offerId)  decline(id, offerId, reason)
 *                               nextInvoice(id)  read(text) → { outcome, book }
 *                             and the two ways off the book:  openCase(id)  go(page)
 * @returns {{ update(book): void, rest(shown): void, destroy(): void }}
 *   rest(shown)   show or hide "The rest of the book", the front's own way round the app
 */
export function createBook(root, actions) {
  root.innerHTML = PAGE;
  const $ = (id) => root.querySelector(`#${id}`);
  const stop = new AbortController();
  const listen = (target, type, fn, options) => target.addEventListener(type, fn, { ...options, signal: stop.signal });
  const query = new URLSearchParams(location.search);
  // where an event really happened, even when the book is drawn inside a shadow tree
  const origin = (event) => event.composedPath?.()[0] ?? event.target;
  const focused = () => root.getRootNode().activeElement ?? document.activeElement;

  // ——————————————————————————————————————————————————————— the book

  const book = { stamp: null, today: "", demo: false, promises: [], totals: null, open: null };
  let busy = false;        // a paper is on the move, or the app is writing something down
  let waiting = null;      // a reading that arrived meanwhile
  let spikeCount = 0;

  const find = (id) => book.promises.find((p) => p.id === id);
  const boxesOf = (p) => p.promisedCents / p.boxCents;
  const punchedOf = (p) => (p.owedCents === 0 && !p.offer ? Math.ceil(boxesOf(p) - 1e-9) : Math.floor(p.creditedCents / p.boxCents));
  const isPaid = (p) => !p.offer && p.owedCents === 0;
  const askWords = (p) => (p.creditedCents > 0 ? "Ask for the rest" : "Ask for it");
  const toTheSpike = (p) => { p.ui.spiked = true; spikeCount += 1; p.ui.spikedAt = spikeCount; };
  const letterOut = (p) => Boolean(p.letter) && kept.letters.has(p.id);
  // the papers on the right of a slip, in the order they lie: credit notes, then invoices
  const pile = (p) => [...p.papers.notes.map((paper) => ({ paper, note: true })), ...p.papers.invoices.map((paper) => ({ paper, note: false }))];
  const pileKey = (item) => `${item.note ? "note" : "invoice"}:${item.paper.id}`;

  // Take in a new reading. Promises keep their identity, so a paper on the desk
  // goes on talking to the same promise.
  function adopt(next) {
    const old = new Map(book.promises.map((p) => [p.id, p]));
    Object.assign(book, { stamp: next.stamp, today: next.today, demo: next.demo, totals: next.totals });
    book.promises = next.promises.map((fresh) => {
      const p = old.get(fresh.id) ?? {};
      const ui = p.ui ?? { spiked: false, spikedAt: 0 };
      for (const key of Object.keys(p)) delete p[key];
      Object.assign(p, fresh, { ui });
      if (p.letter) Object.assign(p.letter, kept.drafts.get(p.letter.key));
      else kept.letters.delete(p.id);
      return p;
    });
    if (book.open && !find(book.open)) book.open = null;
  }

  // ——————————————————————————————————————————————————————— the ledger page

  const rowsEl = $("rows");
  const slot = $("scene-slot");
  const below = $("below");
  const sheet = $("sheet");
  const spike = $("spike");
  const spikeSlips = $("spike-slips");
  const rowOf = (id) => rowsEl.querySelector(`.l-row[data-id="${CSS.escape(id)}"]`);

  function dueNode(p) {
    if (!p.due) return h("span", { class: "l-due" }, "—");
    return h("span", { class: "l-due" }, p.due !== p.firstDue && [h("s", null, dateDay(p.firstDue)), h("br")], dateShort(p.due));
  }

  // "25% of the $8,000 month = $2,000": where the figure comes from, when the
  // sentence they wrote gives a percentage. The reason leads when there is room.
  function workingFor(p, cls) {
    const w = p.working;
    if (!w) return null;
    return h("span", { class: cls },
      w.why && h("i", { class: "w-why" }, `${w.why}: `),
      `${w.percent}% of `, w.per && h("i", { class: "w-more" }, "the "), money(w.ofCents), w.per && h("i", { class: "w-more" }, ` ${w.per}`), ` = ${money(p.promisedCents)}`);
  }

  function rowFor(p, number) {
    const left = p.owedCents;
    const open = book.open === p.id;
    const row = h("article", { class: `l-row${open ? " is-open" : ""}${p.due !== p.firstDue ? " has-moved" : ""}${p.offer ? " is-offer" : ""}`, "data-id": p.id },
      h("span", { class: "l-no" }, h("span", null, number)),
      h("div", { class: "l-cell is-vendor" }, h("button", { class: "l-open", type: "button", "aria-expanded": open ? "true" : "false" }, p.vendor)),
      h("div", { class: "l-cell is-said" },
        h("span", { class: "l-said typed" }, `“${p.quote}”`),
        workingFor(p, "l-working typed"),
        p.asides.map((line) => h("span", { class: "l-aside typed" }, line)),
      ),
      h("div", { class: "l-cell is-due" }, dueNode(p)),
      h("div", { class: "l-cell is-num is-promised" }, h("span", null, p.offer ? "" : figure(p.promisedCents))),
      h("div", { class: "l-cell is-num is-invoice" }, h("span", null, p.offer ? "" : figure(p.creditedCents))),
      h("div", { class: "l-cell is-num is-owed" }, h("b", { class: left ? null : "is-none" }, left ? figure(left) : "")),
      h("div", { class: "l-cell is-margin" }),
    );
    if (p.overdue) row.append(makeStamp("Overdue", { seed: `${p.id}-overdue`, tilt: -4.5, className: "is-overdue" }));
    if (p.offer) row.append(makeStamp("Only if", { seed: `${p.id}-only-if`, tilt: -4, className: "is-onlyif" }));
    else if (left === 0) row.append(makeStamp("Paid", { seed: `${p.id}-paid`, tilt: 5.5, className: "is-paid" }));
    row.append(left > 0
      ? h("button", { class: "btn l-act", type: "button", "data-act": "ask" }, askWords(p))
      : h("button", { class: "link is-typed l-act", type: "button", "data-act": "see" }, p.offer ? "See the offer" : "See how it was paid"));
    return h("div", { class: "l-row-wrap" }, row);
  }

  // An empty line. The first one says what goes on it.
  function blankRow(number, hint = false) {
    return h("div", { class: "l-row-wrap" }, h("div", { class: "l-row is-blank", "aria-hidden": hint ? null : "true" },
      h("span", { class: "l-no" }, h("span", null, number)),
      h("div", { class: "l-cell is-vendor" }),
      h("div", { class: "l-cell is-said" }, hint && h("p", { class: "l-hint" }, h("span", null, "The next promise goes here."), h("span", null, "Drop its email in the tray."))),
      h("div", { class: "l-cell is-due" }),
      h("div", { class: "l-cell is-promised" }), h("div", { class: "l-cell is-invoice" }), h("div", { class: "l-cell is-owed" }), h("div", { class: "l-cell is-margin" }),
    ));
  }

  function drawLedger({ fresh = null } = {}) {
    rowsEl.replaceChildren();
    let line = 1;
    if (book.stamp && !book.promises.length) {
      rowsEl.append(h("div", { class: "l-row-wrap" }, h("div", { class: "l-row is-empty" },
        h("span", { class: "l-no" }, h("span", null, 1)),
        h("p", { class: "l-empty" }, h("span", null, "Nothing owed. When a vendor promises you money, drop the email in the tray.")),
        h("div", { class: "l-cell is-vendor" }), h("div", { class: "l-cell is-said" }), h("div", { class: "l-cell is-due" }),
        h("div", { class: "l-cell is-promised" }), h("div", { class: "l-cell is-invoice" }), h("div", { class: "l-cell is-owed" }), h("div", { class: "l-cell is-margin" }),
      )));
      line = 2;
    }
    for (const p of book.promises) {
      const wrap = rowFor(p, line);
      if (fresh === p.id) wrap.firstElementChild.classList.add("is-new");
      rowsEl.append(wrap);
      line += 1;
    }
    const blanks = Math.max(1, 3 - book.promises.length);
    for (let i = 0; i < blanks; i += 1) rowsEl.append(blankRow(line + i, i === 0 && book.promises.length > 0));
    drawTotals();
    placeSpike();
  }

  function drawRow(p, { land = null } = {}) {
    const old = rowOf(p.id)?.parentElement;
    if (!old) return drawLedger();
    const number = old.querySelector(".l-no span").textContent;
    const next = rowFor(p, number);
    old.replaceWith(next);
    if (land) { const mark = next.querySelector(`.stamp.${land}`); if (mark) stamp(mark); }
    drawTotals();
    return next;
  }

  function drawTotals() {
    const totals = book.totals;
    $("total").hidden = !book.promises.length || !totals;
    if (!totals) return;
    $("t-promised").textContent = figure(totals.promisedCents);
    $("t-invoice").textContent = figure(totals.creditedCents);
    $("t-owed").textContent = totals.owedCents ? figure(totals.owedCents) : "—";
    $("t-owed").classList.toggle("is-none", !totals.owedCents);
  }

  listen(rowsEl, "click", (event) => {
    const row = event.target.closest(".l-row[data-id]");
    if (!row) return;
    sound.unlock();
    const act = event.target.closest("[data-act]")?.dataset.act;
    openSlip(row.dataset.id, { letter: act === "ask" });
  });

  // ——————————————————————————————————————————————————————— the IOU slip

  function sumLine(p, creditedCents = p.creditedCents) {
    if (p.offer) return ["Not owed to you unless you agree."];
    const left = p.promisedCents - creditedCents;
    const papers = p.papers.invoices.length;
    const where = papers === 0 || creditedCents === 0 ? "nothing on an invoice yet" : `${money(creditedCents)} on the ${papers > 1 ? "invoices" : "invoice"}`;
    return [
      h("span", { "data-says": "said" }, `${money(p.promisedCents)} promised`), " − ",
      h("span", { "data-says": "credit" }, where), " = ",
      h("b", null, left ? `${money(left)} still owed` : "paid in full"),
    ];
  }

  function slipSide(p, { live }) {
    const left = p.owedCents;
    const kids = [h("p", { class: "iou-amount" }, price(left || p.promisedCents))];
    if (p.overdue) kids.push(makeStamp("Overdue", { seed: `${p.id}-slip-overdue`, tilt: -7.5, className: "is-overdue" }));
    if (p.offer) kids.push(makeStamp("Only if", { seed: `${p.id}-slip-only-if`, tilt: -6, className: "is-onlyif" }));
    else if (left === 0) kids.push(makeStamp("Paid", { seed: `${p.id}-slip-paid`, tilt: -9, className: "is-paid" }));
    if (live && left > 0 && !letterOut(p)) kids.push(h("button", { class: "btn iou-ask", type: "button", onclick: () => openLetter(p) }, askWords(p)));
    return kids;
  }

  function slipDue(p) {
    if (p.offer) return [h("span", { class: "iou-only" }, "only if you"), h("b", { class: "typed is-wide" }, p.conditions.join(" ").replace(/^[A-Z]/, (letter) => letter.toLowerCase()))];
    if (!p.due) return [h("b", { class: "typed" }, "no date given")];
    return ["due ", h("b", { class: "typed" }, p.due !== p.firstDue && h("s", null, dateDay(p.firstDue)), dateShort(p.due))];
  }

  /** An IOU slip for a promise. live: it is the one on the desk (it can be picked up and acted on). */
  function slipFor(p, { live = true } = {}) {
    const strip = h("div", { class: "iou-tally", "data-says": live ? "credit" : null });
    const el = h("article", { class: `paper iou${isPaid(p) ? " is-paid" : ""}${p.offer ? " is-offer" : ""}`, style: "--W: 160", "data-pick": live ? true : null },
      h("div", { class: "paper-face edge-perf-left" },
        h("div", { class: "iou-body paper-part" },
          h("div", { class: "iou-top" },
            h("span", { class: "iou-title" }, p.offer ? "O F F E R" : "I O U"),
            p.reference && h("span", { class: "iou-no" }, `No. ${p.reference}`),
          ),
          h("div", { class: "iou-lines" },
            h("p", { class: "iou-line" }, h("b", { class: "typed" }, p.vendor), p.offer ? " would credit you" : " owes you"),
            h("p", { class: "iou-line iou-due" }, slipDue(p)),
            h("p", { class: "iou-line" }, p.offer ? "they wrote:" : "because they wrote:"),
            h("p", { class: "iou-quote typed" }, h("span", { "data-says": "said", tabindex: live ? 0 : null }, `“${p.quote}”`)),
            p.working && h("p", { class: "iou-working typed" }, workingFor(p, null)),
            p.asides.map((line) => h("p", { class: "iou-working iou-aside typed" }, line)),
          ),
          h("div", { class: "iou-side" }, slipSide(p, { live })),
          h("p", { class: "iou-sum" }, sumLine(p)),
        ),
        strip,
        h("div", { class: "iou-foot paper-part" }),
      ),
    );
    const total = Math.ceil(boxesOf(p) - 1e-9);
    el.strip = tally(strip, {
      boxes: boxesOf(p),
      punched: punchedOf(p),
      seed: p.id,
      mark: (i) => (i === total || (i % 5 === 0 && total - i > 2) ? money(Math.min(i * p.boxCents, p.promisedCents)) : null),
    });
    if (live) {
      for (const [holds, at, tilt] of [["promise", "left: calc(var(--u) * 1.9)", "-3deg"], ["invoice", "right: calc(var(--u) * 0.7)", "2.5deg"]]) {
        el.append(h("span", { class: "paper-clip is-small", "data-holds": holds, style: `${at}; --clip-tilt: ${tilt}` }));
        el.lastElementChild.innerHTML = paperClip();
      }
    }
    return el;
  }

  function redrawSlip(el, p, { creditedCents } = {}) {
    el.classList.toggle("is-paid", isPaid(p));
    el.querySelector(".iou-due").replaceChildren(...slipDue(p).flat());
    el.querySelector(".iou-side").replaceChildren(...slipSide(p, { live: true }));
    el.querySelector(".iou-sum").replaceChildren(...sumLine(p, creditedCents));
  }

  // ——————————————————————————————————————————————————————— the clipped papers

  // A paper's words, a paragraph at a time, with the sentence they are held to
  // marked. A long document is cut to the part around that sentence, so the
  // paper stays a page.
  function wordsOf(paper) {
    const paras = [];
    let at = 0;
    for (const chunk of paper.text.split(/\n{2,}/)) {
      const start = paper.text.indexOf(chunk, at);
      paras.push({ text: chunk, start, end: start + chunk.length });
      at = start + chunk.length;
    }
    const q = paper.quote;
    const home = q ? paras.findIndex((para) => para.start <= q.start && q.start < para.end) : -1;
    const long = paper.text.length > 1100;
    const shown = long ? paras.filter((_, i) => (home < 0 ? i < 3 : Math.abs(i - home) <= 1)) : paras;
    const nodes = shown.map((para) => {
      if (!q || q.start < para.start || q.start >= para.end) return h("p", null, para.text);
      const from = q.start - para.start, to = Math.min(q.end, para.end) - para.start;
      return h("p", null, para.text.slice(0, from), h("span", { class: "highlighter", "data-says": "said", tabindex: 0 }, para.text.slice(from, to)), para.text.slice(to));
    });
    if (long && shown[0] !== paras[0]) nodes.unshift(h("p", null, "…"));
    if (long && shown.at(-1) !== paras.at(-1)) nodes.push(h("p", null, "…"));
    return nodes;
  }

  /** Where they promised it: the email, the agreement, the report, or whatever was dropped in the tray. */
  function promiseDoc(p, paper, extra = false) {
    const more = extra ? " doc-more" : "";
    if (paper.kind === "email") {
      return h("article", { class: `paper doc doc-promise doc-email${more}`, style: "--W: 112", "data-pick": true },
        h("div", { class: "paper-face stock-bond" },
          h("dl", { class: "mail-head" },
            h("dt", null, "From"), h("dd", null, paper.from),
            paper.date && [h("dt", null, "Dated"), h("dd", null, dateLong(paper.date))],
            h("dt", null, "Filed as"), h("dd", null, paper.title),
          ),
          wordsOf(paper),
        ),
      );
    }
    if (paper.kind === "agreement" || paper.kind === "report") {
      return h("article", { class: `paper doc doc-promise doc-agreement${more}`, style: "--W: 112", "data-pick": true },
        h("div", { class: `paper-face ${paper.kind === "agreement" ? "stock-laid" : "stock-bond"}` },
          h("p", { class: "agr-title" }, paper.title),
          h("p", { class: "agr-section" }, paper.kind === "agreement" ? `${paper.from} · No. ${p.reference}` : paper.from),
          paper.date && h("p", { class: "agr-date" }, `Dated ${dateLong(paper.date)}`),
          h("div", { class: "agr-body" }, wordsOf(paper)),
        ),
      );
    }
    return h("article", { class: `paper doc doc-promise doc-pasted${more}`, style: "--W: 112", "data-pick": true },
      h("div", { class: "paper-face stock-bond" }, wordsOf(paper)),
    );
  }

  /** Where it showed up: one invoice. */
  function invoiceDoc(p, invoice) {
    return h("article", { class: "paper doc doc-invoice", style: "--W: 112", "data-pick": true, "data-paper": `invoice:${invoice.id}` },
      h("div", { class: "paper-face stock-cool" },
        h("div", { class: "inv-head" },
          h("p", { class: "inv-vendor" }, p.vendor),
          h("p", { class: "inv-word" }, "Invoice", h("b", null, invoice.id)),
        ),
        h("dl", { class: "inv-meta" },
          invoice.billedTo && [h("dt", null, "Billed to"), h("dd", null, invoice.billedTo)],
          invoice.date && [h("dt", null, "Date"), h("dd", null, dateShort(invoice.date))],
          invoice.period && [h("dt", null, "Service period"), h("dd", null, invoice.period)],
        ),
        h("div", { class: "inv-lines" },
          invoice.lines.map((line) => h("div", { class: `inv-line${line.credit ? " is-credit highlighter" : ""}`, "data-says": line.credit ? "credit" : null, tabindex: line.credit ? 0 : null },
            h("span", null, line.label), h("span", null, price(line.cents)),
          )),
        ),
        Number.isFinite(invoice.totalCents) && [
          h("div", { class: "inv-total" }, h("span", null, "Invoice total"), h("span", null, price(invoice.totalCents))),
          h("i", { class: "perf-line", "aria-hidden": "true" }),
          h("div", { class: "inv-stub" }, h("span", null, invoice.id), h("span", null, price(invoice.totalCents))),
        ],
        invoice.said && h("p", { class: "inv-said" }, invoice.said),
      ),
    );
  }

  /** A credit note: a credit on paper. It punches nothing until an invoice shows it. */
  function noteDoc(p, note) {
    return h("article", { class: "paper doc doc-invoice doc-note", style: "--W: 112", "data-pick": true, "data-paper": `note:${note.id}` },
      h("div", { class: "paper-face stock-carbon" },
        h("div", { class: "inv-head" },
          h("p", { class: "inv-vendor" }, p.vendor),
          h("p", { class: "inv-word" }, "Credit note", h("b", null, note.id)),
        ),
        h("dl", { class: "inv-meta" }, note.date && [h("dt", null, "Date"), h("dd", null, dateShort(note.date))]),
        h("div", { class: "inv-lines" }, h("div", { class: "inv-line" }, h("span", null, `Credit for ${p.reference}`), h("span", null, price(note.cents)))),
        h("p", { class: "note-where" }, note.onInvoice ? "It has come off an invoice." : "Not on an invoice yet."),
        note.text && h("p", { class: "inv-said" }, note.text),
      ),
    );
  }

  const pileDoc = (p, item) => (item.note ? noteDoc(p, item.paper) : invoiceDoc(p, item.paper));

  // ——————————————————————————————————————————————————————— offers

  const COUNT = ["no offers", "one offer", "two offers", "three offers", "four offers"];

  function offerWords(p, offer) {
    if (offer.kind === "later") return { title: "Pay later", text: `${dateDay(offer.due)} instead of ${dateDay(offer.firstDue)}.` };
    if (offer.kind === "renew") {
      return { title: "Only if you renew", text: `a ${money(offer.creditCents)} credit if you spend ${money(offer.extraCents)} more. ${offer.costCents > 0 ? `That costs you ${money(offer.costCents)}.` : ""}` };
    }
    return { title: "Different terms", text: Number.isSafeInteger(offer.promisedCents) ? `${money(offer.promisedCents)} instead of ${money(p.promisedCents)}.` : "They want to change what was agreed." };
  }

  function tagFor(p, offer, index) {
    const words = offerWords(p, offer);
    const face = h("div", { class: "paper-face stock-manila tag-face" },
      h("i", { class: "tag-eye", "aria-hidden": "true" }),
      makeStamp("Only if", { seed: `${offer.id}-only-if`, small: true, tilt: index ? 3.5 : -4 }),
      h("p", { class: "tag-title" }, words.title),
      h("p", { class: "tag-text" }, words.text),
    );
    const tag = h("article", { class: "paper tag", "data-pick": true }, face);
    tag.insertAdjacentHTML("beforeend", tagString(index ? { dx: -7, dy: -20, sag: 3 } : { dx: 3, dy: -21, sag: -3 }));
    const wrap = h("div", { class: "offer", "data-offer": offer.id }, tag);
    dressOffer(p, offer, wrap);
    return wrap;
  }

  // Put an offer's tag in the state its decision says: open, accepted or declined.
  function dressOffer(p, offer, wrap, { fresh = false, said = "" } = {}) {
    const tag = wrap.querySelector(".tag");
    const face = tag.querySelector(".paper-face");
    for (const old of face.querySelectorAll(".tag-acts, .tag-note, .tag-why, .tag-reason, .stamp.is-accepted")) old.remove();
    wrap.querySelector(".offer-after")?.remove();
    const decision = offer.decision;
    if (!decision) {
      // the engine says whether this one can be taken; when it cannot, the tag says why
      if (!offer.canAccept && offer.why) face.append(h("p", { class: "tag-why" }, offer.why));
      face.append(h("div", { class: "tag-acts" },
        offer.canAccept && h("button", { class: "btn", type: "button", onclick: () => decide(p.id, offer.id, "accepted") }, "Accept"),
        h("button", { class: "link", type: "button", onclick: () => askWhy(p.id, offer.id) }, "Decline"),
      ));
      if (said) face.append(h("p", { class: "tag-why" }, said));
      return;
    }
    const when = new Date(decision.at);
    if (decision.type === "accepted") {
      face.append(h("p", { class: "tag-note" }, `You accepted this on ${dayOf(when)}.`));
      const mark = makeStamp("Accepted", { sub: stampMoment(when), seed: `${offer.id}-accepted`, small: true, tilt: -8, className: "is-accepted" });
      face.append(mark);
      if (fresh) stamp(mark);
      return;
    }
    // declined: the tag comes off. The eyelet end stays on its string.
    if (fresh && !reducedMotion()) {
      const scrap = tag.cloneNode(true);
      scrap.classList.add("tag-scrap");
      scrap.removeAttribute("data-pick");
      scrap.querySelector(".tag-string")?.remove();
      scrap.querySelector(".tag-eye")?.remove();
      scrap.style.width = `${tag.offsetWidth}px`;
      wrap.append(scrap);
      requestAnimationFrame(() => scrap.classList.add("is-falling"));
      setTimeout(() => scrap.remove(), 600);
      sound.rip();
    }
    wrap.classList.add("is-declined");
    face.style.clipPath = tornEdge({ side: "right", depth: 9, steps: 12, seed: offer.id })
      .replace("polygon(0 0,", "polygon(var(--snip) 0,")
      .replace(/, 0 100%\)$/, ", var(--snip) 100%, 0 calc(100% - var(--snip)), 0 var(--snip))");
    const reason = decision.reason && decision.reason !== "No reason given" ? decision.reason : "";
    wrap.append(h("div", { class: "offer-after" }, h("p", null, `You declined this on ${dayOf(when)}.`), reason && h("p", { class: "offer-why" }, `“${reason}”`)));
  }

  // The app keeps a reason with every refusal, so the tag asks for one before it comes off.
  function askWhy(id, offerId) {
    const wrap = slot.querySelector(`.offer[data-offer="${CSS.escape(offerId)}"]`);
    const face = wrap?.querySelector(".paper-face");
    if (!face || busy) return;
    for (const old of face.querySelectorAll(".tag-acts, .tag-why")) old.remove();
    const reason = h("input", { type: "text", placeholder: "Why? (you can leave this empty)", "aria-label": "Why you are declining", maxlength: 200 });
    const go = () => decide(id, offerId, "declined", reason.value);
    reason.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); go(); }
      if (event.key === "Escape") { event.stopPropagation(); back(); }
    });
    const back = () => { const p = find(id), offer = p?.offers.find((item) => item.id === offerId); if (offer) dressOffer(p, offer, wrap); };
    face.append(h("div", { class: "tag-reason" },
      reason,
      h("div", { class: "tag-acts" },
        h("button", { class: "btn", type: "button", onclick: go }, "Decline it"),
        h("button", { class: "link", type: "button", onclick: back }, "Keep it"),
      ),
    ));
    reason.focus({ preventScroll: true });
  }

  async function decide(id, offerId, type, reason = "") {
    const p = find(id);
    if (!p || busy) return;
    sound.unlock();
    busy = true;
    const scene = slot.querySelector(".scene");
    try {
      adopt(await (type === "accepted" ? actions.accept(id, offerId) : actions.decline(id, offerId, reason)));
    } catch (error) {
      const offer = p.offers.find((item) => item.id === offerId);
      const wrap = scene?.querySelector(`.offer[data-offer="${CSS.escape(offerId)}"]`);
      if (offer && wrap) dressOffer(p, offer, wrap, { said: error.message });
      settled();
      return;
    }
    // every tag is dressed again: taking or refusing one changes what can be done with the others
    for (const offer of p.offers) {
      const wrap = scene?.querySelector(`.offer[data-offer="${CSS.escape(offer.id)}"]`);
      if (wrap) dressOffer(p, offer, wrap, { fresh: offer.id === offerId });
    }
    // an accepted later date moves the due date everywhere it is written
    const slip = scene?.querySelector(".iou");
    if (slip) redrawSlip(slip, p);
    refreshLetter(p, scene);
    drawRow(p);
    settled();
  }

  // Once the IOU is paid, an offer nobody answered is no longer on the table.
  const offersShown = (p) => p.offers.filter((offer) => p.offer || p.owedCents > 0 || offer.decision);

  function offersFor(p) {
    const shown = offersShown(p);
    return h("div", { class: "offers" },
      h("p", { class: "offer-said" }, p.offer ? "What saying yes would cost:" : `They answered with ${COUNT[p.offers.length] ?? `${p.offers.length} offers`}.`),
      h("div", { class: "offer-row" }, shown.map((offer) => tagFor(p, offer, p.offers.indexOf(offer)))),
    );
  }

  function clearOffers(p, scene) {
    for (const wrap of scene.querySelectorAll(".offer")) {
      if (p.offers.find((offer) => offer.id === wrap.dataset.offer)?.decision) continue;
      const tag = wrap.querySelector(".tag");
      depart(tag, { y: 26, rotate: 0, opacity: 0 }, { duration: 320, lift: 0.3 }).then(() => {
        wrap.remove();
        if (!scene.querySelector(".offer")) scene.querySelector(".offers")?.remove();
      });
    }
  }

  // ——————————————————————————————————————————————————————— the letter

  function fit(area) {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight + 2}px`;
  }

  const approvedLine = (L) => { const at = new Date(L.approvedAt); return `Approved${L.approvedByYou ? " by you" : ""}, ${dayOf(at)}, ${clock(at)}`; };
  const approvedStamp = (L) => { const at = new Date(L.approvedAt); return makeStamp("Approved", { sub: `${stampMoment(at)} · ${clock(at)}`, seed: "approved", tilt: -5.5 }); };

  function letterFor(p) {
    const L = p.letter;
    const locked = Boolean(L.approvedAt);
    const to = h("input", { type: "text", value: L.to, readonly: locked });
    const subject = h("input", { type: "text", value: L.subject, readonly: locked });
    const body = h("textarea", { class: "letter-body", rows: 12, spellcheck: "true", "aria-label": "Your letter", readonly: locked });
    body.value = L.body;
    // what is typed stays with this letter for as long as the amounts it speaks of stand
    const keep = () => kept.drafts.set(L.key, { to: L.to, subject: L.subject, body: L.body });
    to.addEventListener("input", () => { L.to = to.value; keep(); });
    subject.addEventListener("input", () => { L.subject = subject.value; keep(); });
    body.addEventListener("input", () => { L.body = body.value; keep(); fit(body); });

    const standing = locked ? approvedLine(L)
      : !L.canApprove ? L.why
        : L.lapsed ? "The book changed after this was approved. Read it again, then approve it." : "";
    const by = h("span", { class: "sign-by" }, standing);
    const approve = h("button", { class: "btn", type: "button" }, "Approve this letter");
    const copy = h("button", { class: "link", type: "button", disabled: !locked }, "Copy the letter");
    const download = h("button", { class: "link", type: "button", disabled: !locked }, "Download the email");
    const foot = h("div", { class: "letter-foot" }, h("div", { class: "sign" }, h("span", { class: "sign-line" }), by), locked || !L.canApprove ? null : approve);
    if (locked) foot.append(approvedStamp(L));

    approve.addEventListener("click", async () => {
      if (busy) return;
      sound.unlock();
      busy = true;
      approve.disabled = true;
      try {
        adopt(await actions.approve(p.id));
      } catch (error) {
        approve.disabled = false;
        by.textContent = error.message;
        settled();
        return;
      }
      if (!p.letter?.approvedAt) { refreshLetter(p, slot.querySelector(".scene")); settled(); return; }
      for (const field of [to, subject, body]) field.readOnly = true;
      approve.remove();
      const mark = approvedStamp(p.letter);
      foot.append(mark);
      await stamp(mark);
      by.textContent = approvedLine(p.letter);
      copy.disabled = false;
      download.disabled = false;
      copy.focus({ preventScroll: true });
      settled();
    });
    copy.addEventListener("click", async () => {
      const text = `To: ${L.to}\nSubject: ${L.subject}\n\n${L.body}`;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = copyByHand(text); }
      copy.textContent = ok ? "Copied" : "Select the letter and copy it";
      setTimeout(() => { copy.textContent = "Copy the letter"; }, 1800);
    });
    download.addEventListener("click", () => {
      const blob = new Blob([emailFile(p)], { type: "message/rfc822" });
      const link = h("a", { href: URL.createObjectURL(blob), download: `${p.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(p.owedCents || p.promisedCents) / 100}-credit.eml` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    });

    const el = h("article", { class: "paper letter", style: "--W: 152", "data-pick": true },
      h("div", { class: "paper-face stock-bond" },
        h("label", { class: "letter-field" }, h("span", null, "To"), to),
        h("label", { class: "letter-field" }, h("span", null, "Subject"), subject),
        body,
        foot,
        h("div", { class: "letter-send" }, copy, download),
      ),
    );
    el.fit = () => fit(body);
    return el;
  }

  function copyByHand(text) {
    const area = h("textarea", { style: "position: fixed; opacity: 0; top: 0; left: 0" });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }

  /** The approved letter as an .eml file a mail program opens as a draft, with the papers attached as the app has them. */
  function emailFile(p) {
    const L = p.letter;
    const ascii = (text) => /^[\x20-\x7e]*$/.test(text);
    const b64 = (text) => {
      let bytes = "";
      for (const byte of new TextEncoder().encode(text)) bytes += String.fromCharCode(byte);
      return btoa(bytes);
    };
    const header = (text) => (ascii(text) ? text : `=?UTF-8?B?${b64(text)}?=`);
    const wrap = (encoded) => encoded.match(/.{1,76}/g)?.join("\r\n") ?? "";
    const crlf = (text) => text.replace(/\r?\n/g, "\r\n");
    const recipient = /@/.test(L.to) ? L.to : header(L.to.replace(/[<>]/g, ""));
    let boundary = `truthful-${Date.now().toString(36)}`;
    while (L.body.includes(boundary)) boundary += "x";
    const name = (text) => text.replace(/[^A-Za-z0-9._-]+/g, "-");
    const files = [
      ...p.papers.promise.map((paper, i) => [`${paper.kind === "agreement" ? "the-agreement" : paper.kind === "report" ? "the-report" : "the-original-email"}${i ? `-${i + 1}` : ""}.txt`, `${paper.title}\n${paper.from}${paper.date ? `, ${dateLong(paper.date)}` : ""}\n\n${paper.text}\n`]),
      ...p.papers.notes.map((note) => [`credit-note-${name(note.id)}.txt`, `${note.text}\n`]),
      ...p.papers.invoices.map((invoice) => [`invoice-${name(invoice.id)}.txt`, `${invoice.text}\n`]),
    ];
    const parts = [
      `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(crlf(L.body)))}`,
      ...files.map(([file, text]) => `Content-Type: text/plain; charset=UTF-8; name="${file}"\r\nContent-Disposition: attachment; filename="${file}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(crlf(text)))}`),
    ];
    return [
      `To: ${recipient}`,
      `Subject: ${header(L.subject)}`,
      `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
      "X-Unsent: 1",
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      ...parts.map((part) => `--${boundary}\r\n${part}`),
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  function openLetter(p, { instant = false } = {}) {
    const scene = slot.querySelector(".scene");
    if (!scene || !p.letter) return;
    let el = scene.querySelector(".letter");
    if (!el) {
      kept.letters.add(p.id);
      el = letterFor(p);
      scene.append(el);
      el.fit();
      redrawSlip(scene.querySelector(".iou"), p);
      if (!instant && !reducedMotion()) {
        el.classList.add("is-unfolding");
        settle(el, { y: -70, rotate: -2 }, { duration: 520, lift: 0.5 });
        sound.unfold();
        setTimeout(() => el.classList.remove("is-unfolding"), 600);
      }
    }
    if (!instant) {
      reveal(el, scene.querySelector(".iou"));
      const first = el.querySelector(p.letter.approvedAt ? ".letter-send .link" : ".letter-body");
      setTimeout(() => first?.focus({ preventScroll: true }), reducedMotion() ? 0 : 420);
    }
  }

  // The letter on the desk, written again from the promise as it now stands.
  function refreshLetter(p, scene) {
    const old = scene?.querySelector(".letter");
    if (!old) return;
    if (!p.letter) { kept.letters.delete(p.id); old.remove(); return; }
    const next = letterFor(p);
    old.replaceWith(next);
    next.fit();
  }

  // ——————————————————————————————————————————————————————— opening and putting back

  const pageY = (el) => el.getBoundingClientRect().top + window.scrollY;

  // Scroll just far enough that `el` is on screen, without losing `keep` off the top.
  function reveal(el, keep) {
    const vh = window.innerHeight;
    const bottom = pageY(el) + el.offsetHeight + 28;
    const want = bottom - vh;
    const cap = keep ? pageY(keep) - 14 : pageY(el) - 14;
    const y = Math.max(window.scrollY, Math.min(want, cap));
    if (y > window.scrollY + 2) window.scrollTo({ top: y, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function sceneFor(p) {
    const tools = h("div", { class: "scene-tools" });
    const right = pile(p);
    const scene = h("section", { class: "scene", "data-id": p.id, "aria-label": p.vendor, tabindex: -1 },
      tools,
      h("div", { class: `scene-papers${right.length > 1 || p.papers.promise.length > 1 ? " has-pile" : ""}` },
        p.papers.promise.map((paper, i) => promiseDoc(p, paper, i > 0)),
        right.map((item) => pileDoc(p, item)),
        slipFor(p),
        offersShown(p).length > 0 && offersFor(p),
      ),
    );
    drawTools(p, tools);
    // a hover or focus on one paper lights its match on the others
    const light = (event) => { const says = event.target.closest?.("[data-says]")?.dataset.says; if (says) scene.dataset.lit = says; };
    const dark = () => { delete scene.dataset.lit; };
    scene.addEventListener("pointerover", light);
    scene.addEventListener("pointerout", (event) => { if (event.target.closest?.("[data-says]")) dark(); });
    scene.addEventListener("focusin", light);
    scene.addEventListener("focusout", dark);
    return scene;
  }

  function drawTools(p, tools, said = "") {
    tools.replaceChildren(
      h("div", { class: "scene-ways" },
        h("button", { class: "link", type: "button", onclick: () => closeSlip() }, "Put it back"),
        h("button", { class: "link", type: "button", onclick: () => actions.openCase(p.id) }, "Open the full case"),
      ),
      said ? h("p", { class: "lever-said" }, said)
        : p.nextInvoice && p.owedCents > 0
          ? h("button", { class: "lever", type: "button", onclick: () => nextInvoice(p.id) }, "The next invoice arrives")
          : p.paidNote && h("p", { class: "lever-said" }, p.paidNote),
    );
  }

  const spikeSlipOf = (id) => spikeSlips.querySelector(`.spike-slip[data-id="${CSS.escape(id)}"]`);

  // How far the spike is pushed aside right now, so a slip can be aimed at where it will be.
  function spikeShift() {
    const t = getComputedStyle(spike).translate;
    return t && t !== "none" ? parseFloat(t) || 0 : 0;
  }

  async function openSlip(id, { letter = false, instant = false } = {}) {
    const p = find(id);
    if (!p) return;
    if (busy) return;
    if (book.open === id) {
      if (letter && p.owedCents > 0) openLetter(p);
      else reveal(slot.querySelector(".scene"), rowOf(id));
      return;
    }
    if (book.open) await closeSlip({ instant: true, refocus: false });
    book.open = id;
    kept.open = id;
    const onSpike = p.ui.spiked ? spikeSlipOf(id) : null;
    const from = onSpike?.querySelector(".iou").getBoundingClientRect();
    const scene = sceneFor(p);
    slot.replaceChildren(scene);
    if (letterOut(p)) { scene.append(letterFor(p)); scene.querySelector(".letter").fit(); }
    below.classList.add("has-scene");
    for (const row of rowsEl.querySelectorAll(".l-row[data-id]")) {
      const mine = row.dataset.id === id;
      row.classList.toggle("is-open", mine);
      row.querySelector(".l-open").setAttribute("aria-expanded", mine ? "true" : "false");
    }
    if (onSpike) onSpike.style.visibility = "hidden";

    const slip = scene.querySelector(".iou");
    const others = [...scene.querySelectorAll(".doc, .tag, .letter")];
    if (!instant && !reducedMotion()) {
      const to = slip.getBoundingClientRect();
      const edge = sheet.getBoundingClientRect().bottom;
      scene.classList.add("is-arriving");
      setTimeout(() => scene.classList.remove("is-arriving"), 1000);
      sound.slide(0.36);
      if (from) {
        // off the spike
        settle(slip, { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 2 - (to.top + to.height / 2), rotate: -7 }, { duration: 640, lift: 0.9 });
      } else {
        // out from under the book
        settle(slip, { x: -70, y: -(to.bottom - edge + 24), rotate: -3.5 }, { duration: 620, lift: 0.5 });
      }
      const cx = to.left + to.width / 2, cy = to.top + to.height / 2;
      others.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const isDoc = el.classList.contains("doc");
        settle(el, isDoc
          ? { x: cx - (r.left + r.width / 2), y: from ? cy - (r.top + r.height / 2) : -(r.bottom - edge + 30), rotate: 0, opacity: from ? 0 : undefined }
          : { y: -46, opacity: 0 },
        { duration: isDoc ? 660 : 420, delay: isDoc ? 150 + i * 70 : 520 + i * 60, lift: 0.4, quiet: true });
      });
    }
    if (!instant) {
      reveal(scene, rowOf(id));
      scene.focus({ preventScroll: true });
    }
    if (letter && p.owedCents > 0) {
      if (instant) openLetter(p, { instant: true });
      else setTimeout(() => { if (book.open === id) openLetter(p); }, reducedMotion() ? 0 : 520);
    }
  }

  async function closeSlip({ instant = false, refocus = true } = {}) {
    const id = book.open;
    const scene = slot.querySelector(".scene");
    if (!id || !scene) return;
    const p = find(id);
    book.open = null;
    kept.open = null;
    const row = rowOf(id);
    row?.classList.remove("is-open");
    row?.querySelector(".l-open").setAttribute("aria-expanded", "false");
    const onSpike = p?.ui.spiked ? spikeSlipOf(id) : null;
    if (!instant && !reducedMotion()) {
      busy = true;
      const slip = scene.querySelector(".iou");
      const at = slip.getBoundingClientRect();
      const edge = sheet.getBoundingClientRect().bottom;
      const cx = at.left + at.width / 2, cy = at.top + at.height / 2;
      const moves = [];
      sound.slide(0.3);
      for (const el of scene.querySelectorAll(".doc, .tag, .letter, .tag-string")) {
        if (!el.classList.contains("paper")) continue;
        const r = el.getBoundingClientRect();
        moves.push(depart(el, { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2), rotate: 0, opacity: 0 }, { duration: 300, lift: 0.2 }));
      }
      scene.querySelector(".scene-tools").style.visibility = "hidden";
      scene.querySelector(".offer-said")?.style.setProperty("visibility", "hidden");
      for (const el of scene.querySelectorAll(".offer-after")) el.style.visibility = "hidden";
      if (onSpike) {
        const home = onSpike.querySelector(".iou").getBoundingClientRect();
        const shift = spikeShift();
        below.classList.remove("has-scene");
        moves.push(depart(slip, { x: home.left - shift + home.width / 2 - cx, y: home.top + home.height / 2 - cy, rotate: -7 }, { duration: 560, delay: 160, lift: 0.8, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }));
        await Promise.all(moves);
        sound.pierce();
      } else {
        moves.push(depart(slip, { x: -60, y: -(at.bottom - edge + 30), rotate: -3 }, { duration: 420, delay: 140, lift: 0.3 }));
        await Promise.all(moves);
      }
      busy = false;
    }
    if (onSpike) onSpike.style.visibility = "";
    below.classList.remove("has-scene");
    lifted.reset();
    scene.remove();
    if (refocus) row?.querySelector(".l-open").focus({ preventScroll: true });
    settled();
  }

  // The desk is still again: take in anything the app sent while papers were moving.
  function settled() {
    busy = false;
    if (waiting) { const next = waiting; waiting = null; update(next); }
  }

  // ——————————————————————————————————————————————————————— the next invoice

  // The app records a new invoice; it lands on the pile, the boxes it covers
  // are punched out one by one, and if that settles the IOU it is stamped PAID
  // and goes on the spike.
  async function nextInvoice(id) {
    const p = find(id);
    if (busy || !p?.nextInvoice) return;
    sound.unlock();
    busy = true;
    const scene = slot.querySelector(".scene");
    const tools = scene.querySelector(".scene-tools");
    tools.querySelector(".lever")?.setAttribute("disabled", "");
    const before = { credited: p.creditedCents, pile: new Set(pile(p).map(pileKey)) };
    try {
      adopt(await actions.nextInvoice(id));
    } catch (error) {
      drawTools(p, tools, error.message);
      settled();
      return;
    }
    await arrive(p, scene, before);
    settled();
  }

  // Show what just reached a promise whose slip is on the desk.
  async function arrive(p, scene, before) {
    const slip = scene.querySelector(".iou");
    drawTools(p, scene.querySelector(".scene-tools"));
    for (const item of pile(p)) {
      const key = pileKey(item);
      const there = scene.querySelector(`.doc[data-paper="${CSS.escape(key)}"]`);
      // a credit note that has now come off an invoice says so
      if (there) { if (item.note) there.replaceWith(noteDoc(p, item.paper)); continue; }
      if (before.pile.has(key)) continue;
      const doc = pileDoc(p, item);
      const beside = [...scene.querySelectorAll(".doc-invoice")].at(-1) ?? [...scene.querySelectorAll(".doc-promise")].at(-1);
      if (beside) beside.after(doc); else scene.querySelector(".scene-papers").prepend(doc);
      if (scene.querySelectorAll(".doc-invoice").length > 1) scene.querySelector(".scene-papers").classList.add("has-pile");
      await settle(doc, { x: 90, y: -300, rotate: 11, opacity: 0 }, { duration: 560, lift: 1 });
    }
    await punchUp(p, slip, before.credited);
    redrawSlip(slip, p);
    refreshLetter(p, scene);
    await settleUp(p, slip);
  }

  // Punch the slip's boxes up to what the invoices now show, counting the row's
  // figures along with them.
  async function punchUp(p, slip, before) {
    const row = rowOf(p.id);
    const start = slip.strip.punched;
    await slip.strip.punchTo(punchedOf(p), {
      onPunch(n) {
        const seen = Math.min(p.creditedCents, before + (n - start) * p.boxCents);
        const left = p.promisedCents - seen;
        slip.querySelector(".iou-amount").textContent = price(left || p.promisedCents);
        slip.querySelector(".iou-sum").replaceChildren(...sumLine(p, seen));
        if (row) {
          row.querySelector(".is-invoice span").textContent = figure(seen);
          row.querySelector(".is-owed b").textContent = left ? figure(left) : "";
        }
      },
    });
  }

  // If nothing is owed any more: PAID on the slip, PAID in the book, onto the spike.
  async function settleUp(p, slip) {
    if (!isPaid(p)) { drawRow(p); return; }
    clearOffers(p, slip.closest(".scene"));
    const mark = slip.querySelector(".stamp.is-paid");
    if (mark) await stamp(mark);
    drawRow(p, { land: "is-paid" });
    await wait(reducedMotion() ? 0 : 1250);
    if (book.open === p.id) await toSpike(p, slip);
  }

  async function toSpike(p, slip) {
    const scene = slot.querySelector(".scene");
    toTheSpike(p);
    drawSpike();
    const mine = spikeSlipOf(p.id);
    if (!reducedMotion()) {
      mine.style.visibility = "hidden";
      const home = mine.querySelector(".iou").getBoundingClientRect();
      const shift = spikeShift();
      below.classList.remove("has-scene");
      const at = slip.getBoundingClientRect();
      const cx = at.left + at.width / 2, cy = at.top + at.height / 2;
      const moves = [];
      sound.slide(0.5);
      for (const el of scene.querySelectorAll(".doc, .tag, .letter")) {
        const r = el.getBoundingClientRect();
        moves.push(depart(el, { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2), rotate: 0, opacity: 0 }, { duration: 340, lift: 0.2 }));
      }
      scene.querySelector(".scene-tools").style.visibility = "hidden";
      scene.querySelector(".offer-said")?.style.setProperty("visibility", "hidden");
      for (const el of scene.querySelectorAll(".offer-after")) el.style.visibility = "hidden";
      moves.push(depart(slip, { x: home.left - shift + home.width / 2 - cx, y: home.top + home.height / 2 - cy, rotate: getComputedStyle(mine.querySelector(".iou")).getPropertyValue("--rot").trim().replace("deg", "") || 5 }, { duration: 760, delay: 200, lift: 0.9, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }));
      await Promise.all(moves);
      sound.pierce();
      mine.style.visibility = "";
    }
    below.classList.remove("has-scene");
    book.open = null;
    kept.open = null;
    lifted.reset();
    scene.remove();
    const row = drawRow(p);
    row?.querySelector(".l-open")?.focus({ preventScroll: true });
  }

  // The spike is either wholly on the first screen or wholly below it, never cut
  // by the bottom of the window. Its slips are turned, so they reach a little
  // above and below the spike's own box.
  function placeSpike() {
    if (!spike || matchMedia("(max-width: 820px)").matches) { below.style.removeProperty("--bf-spike-top"); return; }
    const reach = spike.offsetWidth * 0.062;                       // half the slip's width times sin 7°
    const label = (spike.querySelector(".spike-label")?.offsetHeight ?? 14) + spike.offsetHeight * 0.06;
    const near = reach + label + 8;                                 // as close under the page as it can stand
    const room = window.innerHeight - (sheet.offsetTop + sheet.offsetHeight);
    const fits = near + spike.offsetHeight + reach + 10 <= room;
    below.style.setProperty("--bf-spike-top", `${Math.round(fits ? near : Math.max(near, room + reach + label + 16))}px`);
  }

  function drawSpike() {
    spikeSlips.replaceChildren();
    // the one paid last is on top
    for (const p of book.promises.filter((item) => item.ui.spiked).sort((a, b) => a.ui.spikedAt - b.ui.spikedAt)) {
      const slip = slipFor(p, { live: false });
      slip.querySelector(".paper-face").append(h("i", { class: "iou-pierce", "aria-hidden": "true" }));
      const holder = h("div", { class: "spike-slip", "data-id": p.id, role: "button", tabindex: 0, "aria-label": `${p.vendor}. See how it was paid` }, slip);
      holder.addEventListener("click", () => { sound.unlock(); openSlip(p.id); });
      holder.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSlip(p.id); } });
      spikeSlips.append(holder);
    }
    spike.classList.toggle("is-bare", !spikeSlips.children.length);
  }

  // ——————————————————————————————————————————————————————— the in-tray

  const tray = $("tray");
  const trayFloor = $("tray-floor");
  const trayNote = $("tray-note");
  const trayLine = $("tray-line");
  let trayTimer = 0;

  function traySay(text) { trayLine.textContent = text; }

  function trayPaper(el) {
    trayFloor.querySelector(".tray-doc")?.remove();
    trayNote.hidden = Boolean(el);
    if (el) trayFloor.append(el);
  }

  function trayRest(after = 0) {
    clearTimeout(trayTimer);
    trayTimer = setTimeout(() => { trayPaper(null); traySay(""); tray.classList.remove("is-missed"); }, after);
  }

  // The sheet you paste or type onto.
  function trayAsk(prefill = "") {
    clearTimeout(trayTimer);
    const area = h("textarea", { "aria-label": "Paste the text here", placeholder: "Paste it here", spellcheck: "false" });
    area.value = prefill;
    const go = () => { if (area.value.trim()) trayRead(area.value); };
    area.addEventListener("paste", () => setTimeout(go, 30));
    area.addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) go(); });
    const sheetEl = h("div", { class: "paper tray-doc is-paste" },
      h("div", { class: "paper-face stock-bond" },
        area,
        h("div", { class: "paste-foot" },
          h("button", { class: "link", type: "button", onclick: () => trayRest() }, "Never mind"),
          h("button", { class: "link", type: "button", onclick: go }, "Read it"),
        ),
      ),
    );
    trayPaper(sheetEl);
    if (!reducedMotion()) settle(sheetEl, { y: -80, rotate: -5 }, { duration: 380, lift: 0.8 });
    area.focus({ preventScroll: true });
  }

  // What the tray says when the app's reader could not make a promise of a paper.
  function missedLine(outcome) {
    const found = Number.isSafeInteger(outcome.cents) ? `Found ${money(outcome.cents)} promised, but ` : "Found a promise, but ";
    switch (outcome.why) {
      case "vendor": return `${found}not who by. Add a line like “Vendor: Parcel” and drop it in again.`;
      case "reference": return `${found}nothing to match invoices to. Add a line like “Reference: PL-SETUP-2026”.`;
      case "date": return `${found}not when. Add a line like “Due date: 2026-12-01”.`;
      case "differs": return "That vendor already has a promise under this reference, for a different amount or date. Open the full case to change it.";
      case "sheet": return "One line of that spreadsheet can’t be read. Each line needs an invoice number, vendor, date, amount and reference.";
      default: return "Couldn’t find a promise in that. Paste the sentence where they said it.";
    }
  }

  // A paper goes in the tray and the app's own reader says what it is.
  async function trayRead(raw) {
    clearTimeout(trayTimer);
    sound.unlock();
    const text = raw.replace(/\r\n?/g, "\n").trim();
    if (!text || busy) return;
    busy = true;
    tray.classList.remove("is-missed");
    const paper = h("div", { class: "paper tray-doc" }, h("div", { class: "paper-face stock-bond" }, text.slice(0, 700)));
    trayPaper(paper);
    traySay("Reading it…");
    if (!reducedMotion()) settle(paper, { x: 30, y: -150, rotate: 9 }, { duration: 420, lift: 1 });
    const open = find(book.open);
    const before = open ? { credited: open.creditedCents, pile: new Set(pile(open).map(pileKey)) } : null;
    let outcome, next;
    try {
      [{ outcome, book: next }] = await Promise.all([actions.read(text), wait(reducedMotion() ? 200 : 1000)]);
    } catch (error) {
      traySay(error.message);
      trayRest(7000);
      settled();
      return;
    }
    const leave = async () => {
      await wait(reducedMotion() ? 0 : 650);
      if (!reducedMotion()) await depart(paper, { x: -260, y: 190, rotate: -8, opacity: 0 }, { duration: 420, lift: 0.9 });
      trayPaper(null);
      trayRest(6000);
    };
    if (outcome.kind === "promise") {
      traySay(`Found a promise: ${money(outcome.cents)} from ${outcome.vendor}.`);
      await leave();
      adopt(next);
      drawLedger({ fresh: outcome.commitmentId });
    } else if (outcome.kind === "credit") {
      traySay(`Found a credit: ${money(outcome.cents)} from ${outcome.vendors.join(" and ")}.`);
      await leave();
      adopt(next);
      for (const id of outcome.commitmentIds) {
        const p = find(id);
        if (!p) continue;
        const scene = book.open === id ? slot.querySelector(".scene") : null;
        if (scene && before) await arrive(p, scene, before);   // the slip is on the desk: show it happen
        else {
          if (isPaid(p) && !p.ui.spiked) { toTheSpike(p); drawSpike(); }
          drawRow(p, { land: isPaid(p) ? "is-paid" : null });
        }
      }
    } else if (outcome.kind === "missed") {
      // could not read it: the paper stays, with a box to paste the sentence into
      tray.classList.add("is-missed");
      trayAsk(outcome.why && outcome.why !== "sentence" && outcome.why !== "sheet" ? text : "");
      traySay(missedLine(outcome));
    } else {
      traySay({
        known: "That promise is already in the book.",
        "known-invoice": "That invoice is already in the book.",
        "no-match": "Found an invoice, but nothing in the book matches it.",
        offer: "That offer has strings attached. It isn’t owed to you unless you agree.",
      }[outcome.kind] ?? "Couldn’t find a promise in that. Paste the sentence where they said it.");
      trayRest(7000);
    }
    settled();
  }

  function trayFile(file) {
    if (!file) return;
    if (file.size > 400000 || (file.type && !/^text\/|rfc822|csv|json/.test(file.type))) {
      trayAsk();
      tray.classList.add("is-missed");
      traySay("That file isn’t text. Paste the sentence where they said it.");
      return;
    }
    file.text().then(trayRead, () => { traySay("That file wouldn’t open. Paste the text instead."); trayAsk(); });
  }

  listen($("tray-ask"), "click", () => $("tray-file").click());
  listen($("tray-paste"), "click", () => trayAsk());
  listen($("tray-file"), "change", (event) => { trayFile(event.target.files[0]); event.target.value = ""; });

  // A document dropped anywhere on the desk lands in the tray.
  let dragDepth = 0;
  listen(window, "dragenter", (event) => { if (event.dataTransfer?.types?.includes("Files") || event.dataTransfer?.types?.includes("text/plain")) { dragDepth += 1; tray.classList.add("is-over"); } });
  listen(window, "dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) tray.classList.remove("is-over"); });
  listen(window, "dragover", (event) => { event.preventDefault(); });
  listen(window, "drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    tray.classList.remove("is-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) return trayFile(file);
    const text = event.dataTransfer?.getData("text/plain");
    if (text) trayRead(text);
  });
  // So does anything pasted while no field has the cursor.
  listen(document, "paste", (event) => {
    if (origin(event).closest?.("input, textarea, [contenteditable]")) return;
    const text = event.clipboardData?.getData("text/plain");
    if (text?.trim()) { event.preventDefault(); trayRead(text); }
  });

  // ——————————————————————————————————————————————————————— the top of the desk

  // Two folded notes are tucked at the top of the desk: how the book works, and
  // the way to the rest of it. One is open at a time.
  const howto = $("howto");
  const howtoTab = $("howto-tab");
  const rest = $("rest");
  const restTab = $("rest-tab");
  function setNote(note, tab, open) {
    note.hidden = !open;
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && !reducedMotion()) {
      note.classList.add("is-unfolding");
      sound.unfold();
      setTimeout(() => note.classList.remove("is-unfolding"), 480);
    }
  }
  const setHowto = (open) => { if (open) setNote(rest, restTab, false); setNote(howto, howtoTab, open); };
  const setRest = (open) => { if (open) setNote(howto, howtoTab, false); setNote(rest, restTab, open); };
  listen(howtoTab, "click", (event) => { sound.unlock(); event.stopPropagation(); setHowto(howto.hidden); });
  listen(restTab, "click", (event) => { sound.unlock(); event.stopPropagation(); setRest(rest.hidden); });
  listen(document, "click", (event) => {
    if (!howto.hidden && !howto.contains(origin(event))) setHowto(false);
    if (!rest.hidden && !rest.contains(origin(event))) setRest(false);
  });
  // each line of the note is a page behind the book; where it goes is the app's business
  listen(rest, "click", (event) => {
    const page = event.target.closest("[data-go]")?.dataset.go;
    if (page) { setRest(false); actions.go(page); }
  });

  const soundButton = $("sound");
  function setSound(on) {
    sound.setEnabled(on);
    soundButton.setAttribute("aria-pressed", on ? "true" : "false");
    $("sound-state").textContent = on ? "on" : "off";
    try { localStorage.setItem("truthful.sound", on ? "on" : "off"); } catch { /* private window: it just will not be remembered */ }
  }
  listen(soundButton, "click", () => { setSound(!sound.enabled); if (sound.enabled) { sound.unlock(); sound.tick(); } });
  try { setSound(localStorage.getItem("truthful.sound") !== "off"); } catch { /* no storage: sound stays on */ }

  listen(document, "keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!howto.hidden) { setHowto(false); howtoTab.focus(); return; }
    if (!rest.hidden) { setRest(false); restTab.focus(); return; }
    if (trayFloor.querySelector(".tray-doc.is-paste") && tray.contains(focused())) { trayRest(); $("tray-paste").focus(); return; }
    if (book.open && !busy) closeSlip();
  });
  listen(window, "pointerdown", () => sound.unlock(), { once: true });
  listen(window, "resize", () => { slot.querySelector(".letter")?.fit?.(); placeSpike(); });

  // ——————————————————————————————————————————————————————— open the book

  const lifted = pickup(below, { keepIn: below });
  drawLedger();

  /** The app has a new reading of the records: draw it. */
  function update(next) {
    if (!next || next.stamp === book.stamp) return;
    if (busy) { waiting = next; return; }
    const first = !book.stamp;
    adopt(next);
    $("dater").textContent = stampMoment(new Date());
    $("notice").textContent = book.demo
      ? "This is a demo. The vendors are made up and nothing gets emailed."
      : "Nothing is emailed from here. You copy the letter or download it, and send it yourself.";
    // anything already paid is on the spike
    for (const p of book.promises) if (isPaid(p) && !p.ui.spiked) toTheSpike(p);
    drawLedger();
    drawSpike();
    if (!first) {
      // the records changed somewhere else: the slip on the desk is laid out again as it now stands
      const p = find(book.open);
      lifted.reset();
      slot.replaceChildren();
      below.classList.toggle("has-scene", Boolean(p));
      if (p) {
        const scene = sceneFor(p);
        slot.append(scene);
        if (letterOut(p)) { scene.append(letterFor(p)); scene.querySelector(".letter").fit(); }
        if (p.ui.spiked) spikeSlipOf(p.id)?.style.setProperty("visibility", "hidden");
      }
      return;
    }
    const wanted = find(query.get("open")) ? query.get("open") : find(kept.open) ? kept.open : null;
    if (wanted) {
      openSlip(wanted, { instant: true, letter: query.has("letter") });
    } else if (!reducedMotion()) {
      // the page is there first; then the stamps come down on it
      rowsEl.querySelectorAll(".stamp").forEach((mark, i) => { mark.hidden = true; stamp(mark, { quiet: true, delay: 420 + i * 260 }); });
    }
    document.fonts?.ready?.then(() => { if (!stop.signal.aborted) { slot.querySelector(".letter")?.fit?.(); placeSpike(); } });
  }

  function destroy() {
    stop.abort();
    lifted.release();
    clearTimeout(trayTimer);
    root.replaceChildren();
  }

  return {
    update,
    rest(shown) { restTab.hidden = !shown; if (!shown) setRest(false); },
    destroy,
  };
}
