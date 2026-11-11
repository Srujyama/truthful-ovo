// The book of IOUs: what the page works out that is not drawing.
//
// BookFront.jsx draws the page. This is the arithmetic and the words it leans
// on: which coins a promise shows, the order the rows stand in, where the
// figure sits in what they said, what an offer amounts to, what the drop zone
// says after reading a paper, and the approved letter as an .eml file.
// Nothing here decides anything the engine has not already decided: every
// amount comes from a reading made by selectors.mjs.

import { coinsFor } from "../ui/coins.js";
import { money, dateDay, dateLong } from "./selectors.mjs";

// ————————————————————————————————————————————————————————— one promise

/** Nothing is owed any more and it was never only an offer. */
export const isPaid = (p) => !p.offer && p.owedCents === 0;

/** What the one solid button on an opened promise says. */
export const askWords = (p) => (p.creditedCents > 0 ? "Ask for the rest" : "Ask for it");

/** A credit note covers it, but no invoice shows it yet. */
export const noteCentsOf = (p) => p.papers.notes.filter((note) => !note.onInvoice).reduce((sum, note) => sum + note.cents, 0);

/** The promise's coins, one per $100: what came in, then what a note covers, then what is owed. */
export const coinsOf = (p) => coinsFor({ promisedCents: p.promisedCents, creditedCents: p.creditedCents, noteCents: noteCentsOf(p), offer: p.offer });

/** What a screen reader hears for a promise's coins. */
export function coinsSaid(p) {
  if (p.offer) return `${money(p.promisedCents)} on offer, only if you agree`;
  if (isPaid(p)) return `${money(p.promisedCents)} promised, all of it came in`;
  return `${money(p.creditedCents)} of ${money(p.promisedCents)} came in`;
}

/** The rows in the order they stand: everything still open in the order it was written down, then what is paid. */
export function orderOf(promises) {
  return [...promises.filter((p) => !isPaid(p)), ...promises.filter(isPaid)].map((p) => p.id);
}

// ————————————————————————————————————————————————————————— what they said

const FIGURE = /(?:\bUSD\s*\$?\s*|\$\s*)\d[\d,]*(?:\.\d{1,2})?|\d+(?:\.\d+)?\s?%/gi;
const centsIn = (text) => {
  const digits = text.match(/\d[\d,]*(?:\.\d{1,2})?/)?.[0];
  return digits && !text.includes("%") ? Math.round(Number(digits.replace(/,/g, "")) * 100) : null;
};

/**
 * The quote cut in three around the figure the promise rests on: the amount
 * when they wrote it, the percentage when the working comes from one.
 * @returns {[string, string, string]}  before, figure, after ("" figure when there is none)
 */
export function quoteParts(p) {
  const text = p.quote ?? "";
  const found = [...text.matchAll(FIGURE)];
  const pick = found.find((m) => centsIn(m[0]) === p.promisedCents)
    ?? (p.working ? found.find((m) => parseFloat(m[0]) === p.working.percent && m[0].includes("%")) : null)
    ?? found[0];
  if (!pick) return [text, "", ""];
  return [text.slice(0, pick.index), pick[0], text.slice(pick.index + pick[0].length)];
}

/** "25% of the $8,000 month": where the figure comes from, when they gave a percentage. */
export function workingWords(w) {
  return `${w.percent}% of ${w.per ? "the " : ""}${money(w.ofCents)}${w.per ? ` ${w.per}` : ""}`;
}

// ————————————————————————————————————————————————————————— dates, the way the labels say them

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** nov 10, from 2026-11-10 */
export const dayLabel = (iso) => { const [, m, d] = iso.slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };
/** 6:42 pm */
const clock = (date) => { const hr = date.getHours(); return `${hr % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hr < 12 ? "am" : "pm"}`; };
/** A moment on the visitor's own calendar: nov 10 */
const dayOfMoment = (date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`;

/** approved by you, nov 10, 6:42 pm */
export function approvedLine(letter) {
  const at = new Date(letter.approvedAt);
  return `approved${letter.approvedByYou ? " by you" : ""}, ${dayOfMoment(at)}, ${clock(at)}`;
}

/** taken nov 10 / declined nov 10 */
export const decidedLine = (decision) => `${decision.type === "accepted" ? "taken" : "declined"} ${dayOfMoment(new Date(decision.at))}`;

// ————————————————————————————————————————————————————————— offers

/** What one offer amounts to, in a title and a line. */
export function offerWords(p, offer) {
  if (offer.kind === "later") return { title: "Pay later", text: `${dateDay(offer.due)} instead of ${dateDay(offer.firstDue)}.` };
  if (offer.kind === "renew") {
    return { title: "Only if you renew", text: `A ${money(offer.creditCents)} credit if you spend ${money(offer.extraCents)} more.${offer.costCents > 0 ? ` That costs you ${money(offer.costCents)}.` : ""}` };
  }
  return { title: "Different terms", text: Number.isSafeInteger(offer.promisedCents) ? `${money(offer.promisedCents)} instead of ${money(p.promisedCents)}.` : "They want to change what was agreed." };
}

/** Once a promise is paid, an offer nobody answered is no longer on the table. */
export const offersShown = (p) => p.offers.filter((offer) => p.offer || p.owedCents > 0 || offer.decision);

// ————————————————————————————————————————————————————————— the drop zone

/** What the drop zone says when the app's reader could not make a promise of a paper. */
export function missedLine(outcome) {
  const found = Number.isSafeInteger(outcome.cents) ? `Found ${money(outcome.cents)} promised, but ` : "Found a promise, but ";
  switch (outcome.why) {
    case "vendor": return `${found}not who by. Add a line like “Vendor: Parcel” and drop it in again.`;
    case "reference": return `${found}nothing to match invoices to. Add a line like “Reference: PL-SETUP-2026”.`;
    case "date": return `${found}not when. Add a line like “Due date: 2026-12-01”.`;
    case "differs": return "That vendor already has a promise under this reference, for a different amount or date. Open its page to change it.";
    case "sheet": return "One line of that spreadsheet can’t be read. Each line needs an invoice number, vendor, date, amount and reference.";
    default: return "Couldn’t find a promise in that. Paste the sentence where they said it.";
  }
}

/** What the drop zone says after reading a paper the book could place, or already had. */
export function readLine(outcome) {
  if (outcome.kind === "promise") return `Found a promise: ${money(outcome.cents)} from ${outcome.vendor}.`;
  if (outcome.kind === "credit") return `Found a credit: ${money(outcome.cents)} from ${outcome.vendors.join(" and ")}.`;
  if (outcome.kind === "missed") return missedLine(outcome);
  return {
    known: "That promise is already in the book.",
    "known-invoice": "That invoice is already in the book.",
    "no-match": "Found an invoice, but nothing in the book matches it.",
    offer: "That offer has strings attached. It isn’t owed to you unless you agree.",
  }[outcome.kind] ?? "Couldn’t find a promise in that. Paste the sentence where they said it.";
}

/** Keep the text in the box to fix it: the reader found an amount but not who, what or when. */
export const keepsText = (outcome) => outcome.kind === "missed" && outcome.why && outcome.why !== "sentence" && outcome.why !== "sheet";

/** Why a dropped file cannot be read as text, or null when it can. */
export function fileProblem(file) {
  if (file.size > 400000 || (file.type && !/^text\/|rfc822|csv|json/.test(file.type))) return "That file isn’t text. Paste the sentence where they said it.";
  return null;
}

// ————————————————————————————————————————————————————————— the approved letter

/** The approved letter as an .eml file a mail program opens as a draft, with the papers attached as the app has them. */
export function emailFile(p, letter = p.letter) {
  const L = letter;
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

/** pipeline-crm-1500-credit.eml */
export const letterFileName = (p) => `${p.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(p.owedCents || p.promisedCents) / 100}-credit.eml`;

/** Hand the visitor the .eml file. */
export function downloadLetter(p, letter = p.letter) {
  const blob = new Blob([emailFile(p, letter)], { type: "message/rfc822" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = letterFileName(p);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

/** Put the letter on the clipboard. Resolves true when it got there. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no clipboard permission: copy it the old way */ }
  const area = document.createElement("textarea");
  area.style.cssText = "position: fixed; opacity: 0; top: 0; left: 0";
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  area.remove();
  return ok;
}

// ————————————————————————————————————————————————————————— motion

/** The visitor asked for less motion. */
export const stillPlease = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long a strip of coins takes to turn over `n` coins (Coins.jsx: one every 70ms, each 260ms). */
export const turnTime = (n) => (n > 0 ? 260 + (n - 1) * 70 : 0);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
