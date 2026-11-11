// How the book writes money and dates. Money is integer cents everywhere in the
// engine; these turn it into what is printed on a page, and never the other way.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 150000 → "1,500.00". For a ledger column, where the heading already says it is money. */
export function ledger(cents) {
  if (!Number.isSafeInteger(cents)) return '';
  const sign = cents < 0 ? '−' : '';
  const whole = Math.trunc(Math.abs(cents) / 100).toLocaleString('en-US');
  return `${sign}${whole}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
}

/** 150000 → "$1,500"; 1250 → "$12.50". For a sentence. */
export function dollars(cents) {
  if (!Number.isSafeInteger(cents)) return '';
  const sign = cents < 0 ? '−' : '';
  const whole = Math.trunc(Math.abs(cents) / 100).toLocaleString('en-US');
  const rest = Math.abs(cents) % 100;
  return `${sign}$${whole}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** "2026-10-01" or an ISO instant → "Oct 1, 2026". Read as a calendar date, never shifted by a time zone. */
export function day(value) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!hit) return '';
  return `${MONTHS[Number(hit[2]) - 1]} ${Number(hit[3])}, ${hit[1]}`;
}

/** "2026-10-01" → "Oct 1" when the year is this year's, for a narrow column. */
export function shortDay(value, yearNow = today().slice(0, 4)) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!hit) return '';
  return `${MONTHS[Number(hit[2]) - 1]} ${Number(hit[3])}${hit[1] === yearNow ? '' : `, ${hit[1]}`}`;
}

/** An ISO instant → "9:41 AM", in the reader's own time zone. */
export function clock(instant) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** What a dater stamp prints: "NOV 10 2026". */
export function stampDay(value = today()) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!hit) return '';
  return `${MONTHS[Number(hit[2]) - 1].toUpperCase()} ${Number(hit[3])} ${hit[1]}`;
}

/**
 * Today, for the book: the reader's own calendar day. The engine keeps time in UTC and refuses a
 * date later than its own day, so when the reader's day has run ahead of UTC (east of Greenwich,
 * in the morning) this is the engine's day instead. Late in an American afternoon it stays the
 * day on the reader's wall, not tomorrow.
 */
export function today() {
  const at = new Date();
  const mine = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  const engine = at.toISOString().slice(0, 10);
  return mine < engine ? mine : engine;
}

/** How many days from `from` to `to`, both "YYYY-MM-DD". Negative when `to` is earlier. */
export function daysBetween(from, to) {
  const a = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86400000);
}
