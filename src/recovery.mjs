export const STORAGE_KEY = 'truthful.recoveries.v1';
export const MAX_CASES = 30;

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}

async function append(record, type, payload, at) {
  const previousHash = record.audit.at(-1)?.hash ?? null;
  const event = { sequence: record.audit.length + 1, at, type, payload, previousHash };
  return { ...record, audit: [...record.audit, { ...event, hash: await digest(event) }] };
}

export async function createCase(report, at = new Date().toISOString()) {
  const snapshot = structuredClone(report);
  const record = { schemaVersion: 1, id: crypto.randomUUID(), createdAt: at, report: snapshot, audit: [] };
  return append(record, 'EVIDENCE_ANALYZED', { caseId: record.id, createdAt: at, reportDigest: await digest(snapshot) }, at);
}

export async function approveCase(record, draft, at = new Date().toISOString()) {
  if (!await verifyCase(record)) throw new Error('The saved evidence changed. Analyze the original documents again.');
  if (record.audit.some(event => event.type === 'CLAIM_APPROVED')) return record;
  if (!draft?.trim()) throw new Error('Write a claim before approving it.');
  if (!record.report.requiresApproval || !['needs_review','partial','conditional'].includes(record.report.status)
      || record.report.replyReviewRequired || record.report.condition || !Number.isSafeInteger(record.report.outstandingCents) || record.report.outstandingCents <= 0) {
    throw new Error('This case cannot be approved for recovery. Resolve the terms or evidence first.');
  }
  return append(record, 'CLAIM_APPROVED', {
    actor: 'Local reviewer', scope: 'Original promise only; no renewal accepted; no email sent',
    reportDigest: await digest(record.report), draft, draftDigest: await digest(draft),
  }, at);
}

export async function verifyCase(record) {
  try {
    if (record?.schemaVersion !== 1 || typeof record.id !== 'string' || typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))
      || !record.report || !Array.isArray(record.audit) || !record.audit.length || record.audit.length > 2) return false;
    const reportDigest = await digest(record.report);
    let previousHash = null;
    for (const [index, item] of record.audit.entries()) {
      const { hash, ...event } = item;
      if (event.sequence !== index + 1 || event.previousHash !== previousHash || hash !== await digest(event)) return false;
      if (index === 0 && (event.type !== 'EVIDENCE_ANALYZED' || event.payload.caseId !== record.id || event.payload.createdAt !== record.createdAt || event.at !== record.createdAt || event.payload.reportDigest !== reportDigest)) return false;
      if (index > 0 && event.type !== 'CLAIM_APPROVED') return false;
      if (!Number.isFinite(Date.parse(event.at)) || Date.parse(event.at) < Date.parse(record.createdAt)) return false;
      if (event.type === 'CLAIM_APPROVED' && (event.payload.reportDigest !== reportDigest || event.payload.draftDigest !== await digest(event.payload.draft))) return false;
      previousHash = hash;
    }
    return true;
  } catch { return false; }
}

export function readCases(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > MAX_CASES || parsed.some(c => c?.schemaVersion !== 1 || typeof c.id !== 'string' || !c.report || !Array.isArray(c.audit))) {
    throw new Error('Saved cases could not be read. Export any open case, then clear saved cases.');
  }
  return parsed;
}

export function saveCase(storage, cases, record) {
  const next = [record, ...cases.filter(item => item.id !== record.id)].slice(0, MAX_CASES);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function packetFor(record) {
  return {
    product: 'Truthful', team: 'OVO', format: 'truthful-evidence-packet-v1',
    notice: 'Local evidence record. Hash links detect changes relative to the exported chain, not independent authenticity. No email or payment was sent. Sources may contain user-provided data.',
    ...record,
  };
}

export function summaryCsv(record) {
  const r = record.report;
  const fields = ['vendor', 'currency', 'promised', 'applied', 'outstanding', 'status', 'claim_approved'];
  const amount = value => r.status !== 'unsupported' && Number.isSafeInteger(value) ? (value / 100).toFixed(2) : '';
  const values = [r.vendor, r.currency, amount(r.promisedCents), amount(r.appliedCents), amount(r.outstandingCents), r.status, record.audit.some(e => e.type === 'CLAIM_APPROVED') ? 'yes' : 'no'];
  const safe = value => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
  };
  return fields.join(',') + '\r\n' + values.map(safe).join(',') + '\r\n';
}

export function emailFor(record) {
  const approval = record.audit.find(e => e.type === 'CLAIM_APPROVED');
  if (!approval) throw new Error('Approve the claim before downloading its draft.');
  return `Subject: Outstanding vendor credit\r\nX-Unsent: 1\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${approval.payload.draft.replace(/\r?\n/g, '\r\n')}`;
}
