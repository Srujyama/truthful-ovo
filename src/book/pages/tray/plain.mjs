// The pure parts of the in-tray: which paper goes in which slot, where the
// highlighter goes on a paper that has been read, and what Truthful found, said
// the way a bookkeeper would say it. Nothing here touches the DOM or React.
//
// The reading itself is src/engine/index.mjs (analyzeEvidence). Its report speaks
// in the engine's words; everything a visitor reads comes through this file.

import { clock, day, dollars, shortDay, stampDay } from '../../shell/money.mjs';

// ————————————————————————————————————————————————— the three slots

/** The papers a reading is made from, in the order they lie in the tray. `source` is the engine's name for each. */
export const SLOTS = [
  {
    key: 'promiseText', source: 'promise', title: 'The promise', said: 'their email, as text', noun: 'Letter', stock: 'bond', rot: -1.3,
    blank: 'Paste their email. It needs the amount, the date it is due, and a line like\nReference: PC-SEATS-2026',
  },
  {
    key: 'invoiceCsv', source: 'invoice', title: 'The invoices', said: 'one row for each credit', noun: 'Invoices', stock: 'cool', rot: 0.8,
    blank: 'invoice_id,vendor,date,description,amount,currency,commitment_ref\nINV-1026,Pipeline CRM,2026-10-01,Seat credit,900.00,USD,PC-SEATS-2026',
  },
  {
    key: 'replyText', source: 'reply', title: 'What they said next', said: 'if they wrote again', noun: 'Letter', stock: 'bond', rot: -0.6,
    blank: 'If they wrote back, paste that here.',
  },
];

/** The three sets of papers a visitor can try. `swap` is the one change the third makes to the invoices. */
export const EXAMPLES = [
  { id: 'half', label: 'Try: Pipeline CRM, half paid', company: 'Pipeline CRM', files: { promiseText: 'pipeline-promise.txt', invoiceCsv: 'pipeline-invoices.csv' } },
  { id: 'strings', label: 'Try: an offer with strings', company: 'Pipeline CRM', files: { promiseText: 'pipeline-promise.txt', invoiceCsv: 'pipeline-invoices.csv', replyText: 'pipeline-reply.txt' } },
  { id: 'other', label: 'Try: an invoice that doesn’t match', company: 'Pipeline CRM', files: { promiseText: 'pipeline-promise.txt', invoiceCsv: 'pipeline-invoices.csv' }, swap: ['PC-SEATS-2026', 'UNRELATED-CREDIT'] },
];

export const blankTray = (asOf = calendarDay()) => ({ vendor: '', asOf, promiseText: '', invoiceCsv: '', replyText: '' });
export const trayIsEmpty = form => !form.promiseText.trim() && !form.invoiceCsv.trim() && !form.replyText.trim();

/** The company a promise names in its own "Vendor:" line, or ''. */
export function companyIn(promiseText) {
  const lines = [...String(promiseText || '').matchAll(/(?:^|\n)[ \t]*Vendor:[ \t]*([^\r\n]+)/gi)];
  const names = [...new Set(lines.map(line => line[1].trim()).filter(Boolean))];
  return names.length === 1 ? names[0].slice(0, 120) : '';
}

// ————————————————————————————————————————————————— days

const two = n => String(n).padStart(2, '0');

/** Today on the reader's own calendar: the day they would write at the top of a letter. */
export function calendarDay(at = new Date()) {
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

/** The engine counts days in UTC. East of Greenwich the reader's today can be its tomorrow, which it refuses. */
export function engineDay(asOf, now = new Date()) {
  const utc = now.toISOString().slice(0, 10);
  return asOf > utc ? utc : asOf;
}

/** What an APPROVED stamp prints under the word: "NOV 10 2026 · 4:41 PM", on the reader's clock. */
export function stampTime(instant) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  return `${stampDay(calendarDay(at))} · ${clock(at)}`;
}

/** "Nov 10, 4:41 PM" for a slip in the pile. */
export function slipTime(instant) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  return `${shortDay(calendarDay(at), String(new Date().getFullYear()))}, ${clock(at)}`;
}

// ————————————————————————————————————————————————— files dropped on a slot

export const MAX_BYTES = 250000;
const READABLE = ['txt', 'csv', 'eml'];
const kind = name => String(name || '').split('.').pop().toLowerCase();

/** Why a dropped file will not go in the tray, in a sentence, or '' when it will. */
export function fileProblem(file) {
  const name = file?.name || 'That file';
  const ext = kind(file?.name);
  if (!READABLE.includes(ext) || !String(file?.name || '').includes('.')) {
    if (ext === 'pdf') return `${name} is a PDF. Save its text as a .txt file and drop that in.`;
    return `${name} isn’t plain text. The tray reads .txt, .eml and .csv files.`;
  }
  if (file.size > MAX_BYTES) return `${name} is ${Math.round(file.size / 1000).toLocaleString('en-US')} KB. The tray takes files under 250 KB.`;
  return '';
}

/** A file can carry a text name and still not be text. */
export function textProblem(name, text) {
  if (text.includes('\u0000')) return `${name} isn’t plain text. The tray reads .txt, .eml and .csv files.`;
  if (!text.trim()) return `${name} is empty.`;
  return '';
}

/**
 * Which slot each dropped file goes in. A .csv is always the invoices. Other text goes on the
 * slot it was dropped on; a second one goes to whichever of the promise and their next note is free.
 *   sortFiles([a.txt, b.csv], 'promiseText') → [['promiseText', a.txt], ['invoiceCsv', b.csv]]
 */
export function sortFiles(files, droppedOn, form) {
  const placed = [];
  const taken = new Set();
  const letters = ['promiseText', 'replyText'];
  for (const file of files) {
    let slot;
    if (kind(file.name) === 'csv') slot = 'invoiceCsv';
    else if (droppedOn && droppedOn !== 'invoiceCsv' && !taken.has(droppedOn)) slot = droppedOn;
    else slot = letters.find(key => !taken.has(key) && !form[key].trim()) || letters.find(key => !taken.has(key));
    if (!slot || taken.has(slot)) continue;
    taken.add(slot);
    placed.push([slot, file]);
  }
  return placed;
}

// ————————————————————————————————————————————————— where the highlighter goes

/**
 * Every passage of one paper that the reading touched: the ones it used (highlighted) and the
 * invoice rows it left out (struck through, with the reason beside them).
 *   marksFor(report, 'invoice') → [{ id: 'e6', start: 66, end: 163 }, { id: 'x0', start: 164, end: 262, out: 'Left out. …' }]
 */
export function marksFor(report, source) {
  const used = (report.citations || []).filter(cite => cite.source === source).map(cite => ({ id: cite.id, start: cite.start, end: cite.end }));
  if (source !== 'invoice') return used;
  const out = (report.excludedRows || []).map((row, i) => ({ id: `x${i}`, start: row.start, end: row.end, out: whyLeftOut(row, report) }));
  return [...used, ...out];
}

/**
 * Cut a paper's text into its lines, and each line at every place a mark starts or stops.
 * Every character lands in one part, in order, so what is highlighted is the characters the
 * engine cited and no others: for a mark m, the parts that carry it spell text.slice(m.start, m.end).
 *   → [{ start, end, parts: [{ text, start, end, marks: [mark, …] }] }]   (one entry per line; the line ends are not in any part)
 */
export function cutPaper(text, marks) {
  const whole = String(text ?? '');
  const good = (marks || []).filter(m => Number.isInteger(m.start) && Number.isInteger(m.end) && m.start >= 0 && m.end <= whole.length && m.start < m.end);
  const cuts = [...new Set(good.flatMap(m => [m.start, m.end]))].sort((a, b) => a - b);
  const lines = [];
  let from = 0;
  for (let i = 0; i <= whole.length; i += 1) {
    if (i < whole.length && whole[i] !== '\n') continue;
    const points = [from, ...cuts.filter(c => c > from && c < i), i];
    const parts = [];
    for (let k = 0; k < points.length - 1; k += 1) {
      const start = points[k], end = points[k + 1];
      if (start === end) continue;
      parts.push({ text: whole.slice(start, end), start, end, marks: good.filter(m => m.start < end && m.end > start) });
    }
    lines.push({ start: from, end: i, parts });
    from = i + 1;
  }
  if (lines.length > 1 && !lines.at(-1).parts.length) lines.pop();      // the text ended on a line end
  return lines;
}

// ————————————————————————————————————————————————— what Truthful found

const one = (n, single, many) => (n === 1 ? single : many.replace('#', String(n)));
const ids = (report, ...labels) => (report.citations || []).filter(cite => labels.includes(cite.label)).map(cite => cite.id);
const due = report => (report.dueDatePrecision === 'month' ? `due by ${shortDay(report.dueDate)}` : `due ${shortDay(report.dueDate)}`);

/** Did the papers hold a promise Truthful could read at all? */
export const couldRead = report => report.status !== 'unsupported' && !(report.errors || []).length && Number.isSafeInteger(report.promisedCents);

/**
 * The answer, in one sentence with the real figures.
 *   → { lead: 'A promise: $2,400 from Pipeline CRM, due Oct 1. On the invoices: $900.', owed: '$1,500', tail: '', stamp: 'overdue' }
 * `owed` is the one figure that is printed red. stamp: 'overdue' | 'paid' | 'only if' | null.
 */
export function answer(report) {
  if (!couldRead(report)) return { lead: 'Couldn’t read these.', owed: '', tail: '', stamp: null };
  const from = `${dollars(report.promisedCents)} from ${report.vendor}`;
  if (report.condition) return { lead: `An offer: ${from}, ${due(report)}, with strings attached.`, owed: '', tail: '', stamp: 'only if' };
  const lead = `A promise: ${from}, ${due(report)}. On the invoices: ${report.appliedCents ? dollars(report.appliedCents) : 'nothing yet'}.`;
  if (report.outstandingCents === 0) return { lead, owed: '', tail: 'Paid in full.', stamp: 'paid' };
  return { lead, owed: dollars(report.outstandingCents), tail: '', stamp: report.dueDate < report.asOf ? 'overdue' : null };
}

/**
 * The reasons, each in a few words, and the passages each rests on (ids of marksFor).
 *   → [{ key, text, owed?, marks: ['e1'] }]   `owed` is a figure printed red after the text.
 */
export function reasons(report) {
  if (!couldRead(report)) return [];
  const list = [];
  const offered = Boolean(report.condition);
  const matched = (report.invoiceMatches || []).map(row => row.citationId).filter(Boolean);
  const promised = ids(report, 'Promised credit');
  list.push({ key: 'promise', text: `They ${offered ? 'offered' : 'promised'} ${dollars(report.promisedCents)}.`, marks: promised });

  const who = ids(report, 'Source vendor'), when = ids(report, 'Promise date');
  if (report.sourceVendor && report.promiseDate) list.push({ key: 'from', text: `${report.sourceVendor} sent it ${day(report.promiseDate)}.`, marks: [...who, ...when] });
  else if (report.promiseDate) list.push({ key: 'from', text: `It was sent ${day(report.promiseDate)}.`, marks: when });
  else if (report.sourceVendor) list.push({ key: 'from', text: `It is from ${report.sourceVendor}.`, marks: who });

  if (report.commitmentRef) list.push({ key: 'ref', text: `Their reference is ${report.commitmentRef}.`, marks: ids(report, 'Commitment reference') });
  if (report.dueDate) {
    const late = report.dueDate < report.asOf ? '' : ' That day hasn’t come yet.';
    const by = report.dueDatePrecision === 'month' ? `It is due on that month’s invoice, by ${day(report.dueDate)}.` : `It is due ${day(report.dueDate)}.`;
    list.push({ key: 'due', text: `${by}${offered ? '' : late}`, marks: ids(report, 'Expected invoice date') });
  }

  if (!offered) {
    const n = matched.length;
    list.push({
      key: 'invoices',
      text: n ? `${one(n, 'One invoice row is', '# invoice rows are')} for this promise: ${dollars(report.appliedCents)}.` : 'No invoice row is for this promise.',
      marks: matched,
    });
    if (report.overappliedCents) list.push({ key: 'extra', text: `The invoices show ${dollars(report.overappliedCents)} more than they promised. The extra isn’t counted here.`, marks: matched });
    list.push(report.outstandingCents > 0
      ? { key: 'sum', text: `${dollars(report.promisedCents)} − ${dollars(report.appliedCents)} =`, owed: `${dollars(report.outstandingCents)} still owed.`, marks: [...promised, ...matched] }
      : { key: 'sum', text: `${dollars(report.promisedCents)} − ${dollars(Math.min(report.appliedCents, report.promisedCents))} = nothing left to pay.`, marks: [...promised, ...matched] });
  }

  const out = (report.excludedRows || []).map((row, i) => `x${i}`);
  if (out.length) list.push({ key: 'out', text: `${one(out.length, 'One invoice row is', '# invoice rows are')} left out. Each says why.`, marks: out });
  if (report.replyCondition) list.push({ key: 'reply', text: 'Their later note adds a string. You haven’t agreed to it.', marks: ids(report, 'New vendor condition') });
  return list;
}

/** Why an invoice row was not counted, as a note in the margin beside it. */
export function whyLeftOut(row, report) {
  const reason = String(row.reason || '');
  if (/^Different vendor/.test(reason)) return `Left out. It is from ${row.vendor}.`;
  if (/^Different currency/.test(reason)) return `Left out. It is in ${row.currency}.`;
  if (/^Different commitment reference/.test(reason)) return `Left out. Its reference is ${row.commitmentRef}.`;
  if (/predates/.test(reason)) return 'Left out. It is dated before the promise.';
  if (/later than the review date/.test(reason)) return `Left out. It is dated after ${shortDay(report.asOf)}.`;
  if (/conditional/.test(reason)) return 'Left out. The offer has strings attached.';
  if (/^Source validation failed/.test(reason)) return 'Left out until the papers can be read.';
  return `Left out. ${reason}`;
}

/**
 * What stopped it, if anything, in plain words.
 *   → null | { kind: 'strings' | 'look' | 'unread', said: '…', quote?: 'their own sentence', lines?: ['…'] }
 */
export function whatStopped(report) {
  if (!couldRead(report)) return { kind: 'unread', said: '', lines: problems(report) };
  if (report.condition) return { kind: 'strings', said: 'This one has strings attached. Someone has to decide before this goes in the book.', quote: report.condition };
  if (report.replyCondition) return { kind: 'strings', said: 'Their later note attaches strings. Someone has to decide before this goes in the book.', quote: report.replyCondition };
  if (report.replyReviewRequired) return { kind: 'look', said: 'Truthful can’t tell what their later note changes. A person has to read it before this goes in the book.' };
  return null;
}

/** Small things worth knowing that did not stop the reading. */
export function asides(report) {
  if (!couldRead(report)) return [];
  const list = [];
  for (const warning of report.warnings || []) {
    const text = String(warning?.message || warning || '');
    if (/^An unqualified \$ amount/.test(text)) list.push('The $ is read as US dollars.');
    else if (/^No invoice rows supplied/.test(text)) list.push('There were no invoices in the tray, so nothing shows as credited.');
    else if (/^The CSV has a header but no invoice rows/.test(text)) list.push('The invoices paper has its first line and no rows under it.');
    else if (/^Duplicate invoice (\S+) ignored/.test(text)) list.push(`Invoice ${/^Duplicate invoice (\S+)/.exec(text)[1]} is in there twice. It is counted once.`);
    else if (/^No promise Date: header/.test(text)) list.push('The promise has no “Date:” line. Add the day it was sent, so invoices from before it can’t be counted.');
  }
  return list;
}

// The engine's own sentences, each as a bookkeeper would say it. A sentence it does not know is passed on as it is.
const PROBLEMS = [
  [/^Name the vendor/, () => 'Say who it is from.'],
  [/^The review date must be/, () => 'The day to read it as of isn’t a real date.'],
  [/^Reply text exceeds/, () => 'What they said next is too long. The tray takes 250,000 characters.'],
  [/^Add the original vendor promise/, () => 'The promise is blank. Paste the email where they said it.'],
  [/^Promise text exceeds/, () => 'The promise is too long. The tray takes 250,000 characters.'],
  [/^Only unambiguous USD promises/, () => 'Truthful reads promises in US dollars, and this one names another currency.'],
  [/^The amount appears in a denied/, () => 'The amount sits in a sentence where they say no, or where someone is only asking for it.'],
  [/^Use an explicit confirmed vendor credit/, () => 'Couldn’t find a sentence where they say “we will credit”, “we will refund” or “we will waive”.'],
  [/^The credit amount is tentative/, () => 'They say “up to” or “about”. Truthful needs the amount they settled on.'],
  [/^An ability or possible offer/, () => '“We can” is an offer. It becomes a promise when they say “we will”.'],
  [/^Use a nonnegative decimal amount/, () => 'One amount has more than two decimal places.'],
  [/^Amount exceeds the safe integer limit|^Combined credits exceed/, () => 'The amounts are larger than Truthful can count.'],
  [/^Multiple credit amounts appear/, () => 'More than one amount is promised here. Put in one promise at a time.'],
  [/^No confirmed positive USD credit amount/, () => 'Couldn’t find a promise in that. Paste the sentence where they said it.'],
  [/^Multiple commitment references/, () => 'The promise has more than one reference. Put in one promise at a time.'],
  [/^Add an explicit Reference/, () => 'The promise has no reference. Add a line like “Reference: PC-SEATS-2026”, so its invoices can be told from the others.'],
  [/^The promise contains an invalid due date/, () => 'The due date in the promise isn’t a real date.'],
  [/^No supported due date/, () => 'The promise doesn’t say when. Add “Due date: 2026-10-01”, or name the month and year of the invoice.'],
  [/^The invoice month has no year/, () => 'The promise names a month and no year. Add the year, or a “Date:” line at the top.'],
  [/conflicting Vendor: headers/, () => 'The promise has two “Vendor:” lines that disagree.'],
  [/multiple Date: headers/, () => 'The promise has more than one “Date:” line. Keep the day it was sent.'],
  [/^The promise Date: header must contain/, () => 'The “Date:” line in the promise isn’t a real date.'],
  [/^The selected vendor does not match/, (m, r) => `The promise says it is from ${r.sourceVendor || 'another company'}, and you wrote ${r.vendor || 'a different name'}. Make them the same.`],
  [/^The promise Date: header is later/, (m, r) => `The promise is dated ${day(r.promiseDate) || 'later'}, after the day you are reading it as of.`],
  [/^Invoice CSV exceeds/, () => 'The invoices are too long. The tray takes 250,000 characters.'],
  [/^The invoice CSV is empty/, () => 'The invoices paper has no rows.'],
  [/^CSV header names must be unique/, () => 'Two columns in the invoices have the same name.'],
  [/^Row (\d+): (?:unexpected quote|characters follow a closing quote|unclosed quoted field)/, m => `Row ${m[1]} of the invoices has a stray quote mark.`],
  [/^Row (\d+): expected (\d+) columns, received (\d+)/, m => `Row ${m[1]} of the invoices has ${m[3]} columns where the first line has ${m[2]}.`],
  [/^Row (\d+): (\w+) is required/, m => `Row ${m[1]} of the invoices has no ${m[2]}.`],
  [/^Row (\d+): date must be/, m => `Row ${m[1]} of the invoices: write the date like 2026-10-01.`],
  [/^Row (\d+): currency must be/, m => `Row ${m[1]} of the invoices: write the currency as three capitals, like USD.`],
  [/^Row (\d+): (?:credit amount must be positive|amount must be a positive decimal)/, m => `Row ${m[1]} of the invoices: write the amount as a plain figure above zero, like 900.00.`],
  [/^Invoice (\S+) has conflicting rows/, m => `Invoice ${m[1]} is on two rows that disagree. Keep one.`],
];

/** One of the engine's sentences, said plainly. */
export function plainProblem(message, report = {}) {
  const text = String(message?.message || message || '').trim();
  for (const [pattern, say] of PROBLEMS) {
    const hit = pattern.exec(text);
    if (hit) return say(hit, report);
  }
  return text;
}

/** Everything that kept a set of papers from being read, each once, the missing columns as one line. */
export function problems(report) {
  const raw = (report.errors || []).map(error => String(error?.message || error || ''));
  const columns = raw.map(text => /^CSV is missing the (\w+) column/.exec(text)?.[1]).filter(Boolean);
  const said = raw.filter(text => !/^CSV is missing the/.test(text)).map(text => plainProblem(text, report));
  if (columns.length) said.push('The first line of the invoices should read invoice_id,vendor,date,description,amount,currency,commitment_ref');
  const list = [...new Set(said)];
  return list.length ? list : ['Couldn’t find a promise in that. Paste the sentence where they said it.'];
}

// ————————————————————————————————————————————————— writing it in the book

/** Why the book will not take these papers, from the engine's refusal. */
export function bookProblem(error) {
  const text = String(error?.message || error || '').trim();
  if (/^Resolve unsupported evidence or changed terms/.test(text)) return 'It has strings attached. Waiting on that decision.';
  if (/^A future review/.test(text)) return 'It was read as of a day that hasn’t come yet. Read it again as of today.';
  if (/^Several commitments share this reference/.test(text)) return 'Two promises in the book already carry this reference. Sort those out on their own pages first.';
  if (/^The tracked terms differ/.test(text)) return 'The book already holds this promise with a different amount or due date. Change it on its own page.';
  if (/^This invoice has several credit lines/.test(text)) return 'One of these invoices is already in the book with more than one credit on it. Add this one on the promise’s page.';
  if (/^The imported invoice conflicts/.test(text)) return 'One of these invoices is already in the book with a different amount. Fix it on the promise’s page.';
  if (/^That credit already has an allocation/.test(text)) return 'One of these invoices is already counted toward another promise in the book.';
  if (/^Analyze the original documents/.test(text)) return 'Read the papers first.';
  return text;
}

/**
 * Whether these papers may go in the book at all, before the book is asked.
 *   → '' | the reason, in a sentence (who or what it waits on)
 */
export function bookWaits(report) {
  if (!couldRead(report)) return 'There is no promise here to write in.';
  if (report.condition || report.replyCondition) return 'It has strings attached. Waiting on that decision.';
  if (report.replyReviewRequired) return 'Waiting on a person to read their later note.';
  return '';
}

/** What pressing the button will add, said before it is pressed: "Goes in: Pipeline West as a new company, the promise, one invoice." */
export function planSays(plan, report) {
  const types = (plan?.commands || []).map(command => command.type);
  if (!types.length) return '';
  const parts = [];
  if (types.includes('ADD_VENDOR')) parts.push(`${report.vendor} as a new company`);
  if (types.includes('CREATE_COMMITMENT')) parts.push('the promise');
  const invoices = types.filter(type => type === 'REGISTER_CREDIT').length;
  if (invoices) parts.push(one(invoices, 'one invoice', '# invoices'));
  else if (types.includes('ALLOCATE_CREDIT')) parts.push('which promise an invoice covers');
  return parts.length ? `Goes in: ${parts.join(', ')}.` : '';
}

/**
 * The letter asking for the rest, in plain words, from the reading's own figures. The engine decides
 * whether there is anything to ask for (it drafts a letter only then); '' when there is not.
 */
export function letterFor(report) {
  if (!report?.draft || !couldRead(report) || !(report.outstandingCents > 0)) return '';
  const owed = dollars(report.outstandingCents);
  const when = report.promiseDate ? `On ${day(report.promiseDate)} you` : 'You';
  const by = report.dueDatePrecision === 'month' ? `due by ${day(report.dueDate)}` : `due ${day(report.dueDate)}`;
  const sofar = report.appliedCents
    ? `So far ${dollars(report.appliedCents)} of it has shown up on our invoices`
    : 'None of it has shown up on our invoices yet';
  const papers = report.documents?.invoiceCsv?.trim() ? 'Your original email and our invoice rows are attached.' : 'Your original email is attached.';
  return [
    `Hi ${report.vendor} billing team,`,
    `${when} promised us a ${dollars(report.promisedCents)} credit (reference ${report.commitmentRef}), ${by}. ${sofar}, which leaves ${owed} still owed as of ${day(report.asOf)}.`,
    `Please put the remaining ${owed} on our next invoice and tell us its invoice number.${report.replyCondition ? ' We have not agreed to the new terms in your later note.' : ''}`,
    papers,
    'Thank you,\nFinance',
  ].join('\n\n');
}

/** The letter's own approval, when the engine refuses it. */
export function letterProblem(error) {
  const text = String(error?.message || error || '').trim();
  if (/^The saved evidence changed/.test(text)) return 'This reading was changed after it was saved. Read the papers again.';
  if (/^Write a claim/.test(text)) return 'The letter is blank. Write what you are asking for.';
  if (/^This case cannot be approved/.test(text)) return 'There is nothing to ask for on this one.';
  return text;
}

// ————————————————————————————————————————————————— the pile of earlier readings

export const approvalOf = record => record?.audit?.find(event => event.type === 'CLAIM_APPROVED') || null;

/** A slip in the pile: the company, the figure still owed, when it was read. */
export function pileSlip(record) {
  const report = record.report || {};
  const base = { id: record.id, company: report.vendor || 'No company', when: slipTime(record.createdAt), owed: '', said: '', approved: Boolean(approvalOf(record)) };
  if (!couldRead(report)) return { ...base, said: 'couldn’t be read' };
  if (report.condition) return { ...base, said: `${dollars(report.promisedCents)} offered, with strings` };
  if (report.outstandingCents > 0) return { ...base, owed: dollars(report.outstandingCents), said: 'still owed' };
  return { ...base, said: 'paid in full' };
}

/** A name for a file the reader saves: "truthful-letter-pipeline-crm.eml". */
export function fileName(kindOf, company, ext) {
  const slug = String(company || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `truthful-${kindOf}${slug ? `-${slug}` : ''}.${ext}`;
}
