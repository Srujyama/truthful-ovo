/**
 * Truthful's deliberately bounded, dependency-free evidence engine.
 * It accepts explicit USD credit promises and a documented credit-ledger CSV.
 * This is rules-based extraction, not an LLM or a claim of general language understanding.
 * Citation offsets use JavaScript UTF-16 string indices: source.slice(start, end) === quote.
 */
const HEADERS = ['invoice_id', 'vendor', 'date', 'description', 'amount', 'currency', 'commitment_ref'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONEY = /(?:\bUSD\s*\$?\s*|\$\s*)(\d[\d,]*(?:\.\d+)?)(?:\s*USD\b)?(?![\d,A-Za-z]|\.\d)/gi;
const MAX_INPUT = 250_000;

export function moneyToCents(value) {
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) {
    throw new RangeError('Use a nonnegative decimal amount with at most two decimal places.');
  }
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new RangeError('Amount exceeds the safe integer limit.');
  return amount;
}

const display = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const identity = value => String(value).normalize('NFC').trim().toLowerCase();
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function span(source, start, end, label) {
  return { source, quote: source.slice(start, end), start, end, label };
}

function sentenceAt(text, index) {
  // Monetary decimals are not sentence breaks; a sentence-ending period is followed by space/end.
  const ranges = [];
  const expression = /[^\n]+?(?:[.!?](?=\s|$)|(?=\n|$))/g;
  for (const match of text.matchAll(expression)) {
    const leading = match[0].length - match[0].trimStart().length;
    ranges.push({ text: match[0].trim(), start: match.index + leading, end: match.index + match[0].trimEnd().length });
  }
  return ranges.find(part => part.start <= index && index < part.end)
    || { text: text, start: 0, end: text.length };
}

function extractCondition(text) {
  // Remove only the explicitly supported *negated* renewal clauses before scanning.
  const negatives = /(?:does\s+not\s+require\s+(?:a\s+)?renewal|no\s+renewal\s+(?:is\s+)?required|without\s+(?:a\s+)?renewal|no\s+minimum[- ]term\s+commitment)/gi;
  const masked = text.replace(negatives, match => ' '.repeat(match.length));
  const expression = /\b(?:if\s+(?:you|we)|provided\s+(?:that\s+)?you|subject\s+to|contingent\s+on|conditional\s+on|in\s+exchange\s+for|requires?\s+(?:an?\s+)?(?:annual\s+|\d+[- ]month\s+)?renewal|renewal\s+(?:is\s+)?required|only\s+(?:when|after|if)|(?:after|upon)\s+(?:your\s+|an?\s+)?(?:annual\s+)?renewal|must\s+renew|renew\s+for\s+(?:another|a|one|\d+))\b/i;
  const found = expression.exec(masked);
  if (!found) return null;
  const sentence = sentenceAt(text, found.index);
  return { text: sentence.text, start: sentence.start, end: sentence.end };
}

function extractDueDate(text) {
  const explicit = /\b(?:due(?:\s+date)?|apply\s+by|credit\s+by)\s*:?\s*(\d{4}-\d{2}-\d{2})\b/i.exec(text);
  if (explicit) {
    return isDate(explicit[1])
      ? { dueDate: explicit[1], precision: 'day', evidence: { start: explicit.index, end: explicit.index + explicit[0].length }, error: null }
      : { dueDate: null, precision: null, evidence: null, error: 'The promise contains an invalid due date.' };
  }
  const monthExpression = new RegExp(`\\b(?:on|in|for|to)\\s+(?:(?:your|the|our)\\s+)?(${MONTHS.join('|')})(?:\\s+(20\\d{2}))?\\s+invoice\\b`, 'i');
  const month = monthExpression.exec(text);
  if (!month) return { dueDate: null, precision: null, evidence: null, error: 'No supported due date. State a due date (YYYY-MM-DD) or an invoice month and year.' };
  const monthIndex = MONTHS.indexOf(month[1].toLowerCase());
  let year = month[2] ? Number(month[2]) : null;
  if (!year) {
    const sourceIso = /\bDate:\s*(\d{4}-\d{2}-\d{2})\b/i.exec(text);
    const sourceLong = new RegExp(`\\bDate:\\s*(${MONTHS.join('|')})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'i').exec(text);
    let sourceDate = null;
    if (sourceIso && isDate(sourceIso[1])) sourceDate = sourceIso[1];
    if (sourceLong) {
      const candidate = `${sourceLong[3]}-${String(MONTHS.indexOf(sourceLong[1].toLowerCase()) + 1).padStart(2, '0')}-${sourceLong[2].padStart(2, '0')}`;
      if (isDate(candidate)) sourceDate = candidate;
    }
    if (!sourceDate) return { dueDate: null, precision: null, evidence: null, error: 'The invoice month has no year or valid Date: header; the engine will not guess a year.' };
    year = Number(sourceDate.slice(0, 4)) + Number(monthIndex + 1 < Number(sourceDate.slice(5, 7)));
  }
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    dueDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${lastDay}`,
    precision: 'month',
    evidence: { start: month.index, end: month.index + month[0].length }, error: null,
  };
}

function sourceMetadata(text) {
  const vendorHeaders = [...text.matchAll(/(?:^|\n)[ \t]*Vendor:[ \t]*([^\r\n]+)/gi)];
  const sourceVendors = [...new Set(vendorHeaders.map(match => match[1].trim()))];
  const dates = [...text.matchAll(/(?:^|\n)[ \t]*Date:[ \t]*([^\r\n]+)/gi)];
  const errors = [];
  if (sourceVendors.length > 1) errors.push('The original promise has conflicting Vendor: headers.');
  if (dates.length > 1) errors.push('The original promise has multiple Date: headers; use one dated promise.');
  let promiseDate = null;
  if (dates.length === 1) {
    const raw = dates[0][1].trim();
    if (isDate(raw)) promiseDate = raw;
    else {
      const long = new RegExp(`^(${MONTHS.join('|')})\\s+(\\d{1,2}),?\\s+(20\\d{2})$`, 'i').exec(raw);
      if (long) {
        const candidate = `${long[3]}-${String(MONTHS.indexOf(long[1].toLowerCase()) + 1).padStart(2, '0')}-${long[2].padStart(2, '0')}`;
        if (isDate(candidate)) promiseDate = candidate;
      }
      if (!promiseDate) errors.push('The promise Date: header must contain a real YYYY-MM-DD or Month D, YYYY date.');
    }
  }
  return {
    promiseDate, sourceVendor: sourceVendors.length === 1 ? sourceVendors[0] : null, errors,
    vendorEvidence: vendorHeaders.length === 1 ? { start: vendorHeaders[0].index + Number(vendorHeaders[0][0].startsWith('\n')), end: vendorHeaders[0].index + vendorHeaders[0][0].length, label: 'Source vendor' } : null,
    dateEvidence: dates.length === 1 ? { start: dates[0].index + Number(dates[0][0].startsWith('\n')), end: dates[0].index + dates[0][0].length, label: 'Promise date' } : null,
  };
}

export function extractPromise(promiseText) {
  const text = typeof promiseText === 'string' ? promiseText : '';
  const errors = [], warnings = [], evidence = [];
  if (!text.trim()) errors.push('Add the original vendor promise.');
  if (text.length > MAX_INPUT) errors.push('Promise text exceeds 250,000 characters.');
  const foreignCurrency = /(?:\b(?:CAD|AUD|NZD|EUR|GBP|JPY|CNY|INR)\b|[€£¥₹]|[CA]\s*\$)/i.test(text);
  if (foreignCurrency) errors.push('Only unambiguous USD promises are supported. Another currency appears in the source.');
  const candidates = [];
  for (const match of text.matchAll(MONEY)) {
    const sentence = sentenceAt(text, match.index);
    if (!/\b(?:credit|waiv(?:e|ed|ing)|refund)\b/i.test(sentence.text)) continue;
    if (/\b(?:not|never|won['’]t|cannot|can['’]t|rejected|denied|request(?:ed|ing)?|can\s+you|could\s+you)\b/i.test(sentence.text)) {
      errors.push('The amount appears in a denied, negated, or requested credit rather than a confirmed vendor promise.');
    }
    const affirmative = /\b(?:we|i)(?:['’]ll|\s+will|\s+can)\s+(?:(?:apply|issue|provide|give)\s+(?:you\s+)?(?:a\s+)?)?(?:credit|waive|refund)\b|\b(?:confirm(?:ed)?|approved)\s+(?:a\s+)?(?:credit|refund)\b|\b(?:credit|refund)\s+of\b.*\bwill\s+be\s+(?:applied|issued)\b/i.test(sentence.text);
    if (!affirmative) errors.push('Use an explicit confirmed vendor credit or waiver sentence. This wording is outside the supported extraction rules.');
    if (/\b(?:might|may|could|up\s+to|approximately|about|estimate[ds]?)\b/i.test(sentence.text)) {
      errors.push('The credit amount is tentative or bounded; a confirmed amount is required.');
    }
    if (/\b(?:we|i)\s+can\b/i.test(sentence.text) && !extractCondition(text)) errors.push('An ability or possible offer is not a confirmed unconditional promise.');
    try {
      candidates.push({ cents: moneyToCents(match[1]), start: match.index, end: match.index + match[0].length, sentence });
    } catch (error) { errors.push(error.message); }
  }
  const amounts = [...new Set(candidates.map(item => item.cents))];
  if (amounts.length !== 1 || amounts[0] <= 0) errors.push(amounts.length > 1 ? 'Multiple credit amounts appear in the promise; select one commitment before analyzing.' : 'No confirmed positive USD credit amount was found. Use an explicit credit or fee-waiver sentence.');
  const promisedCents = amounts.length === 1 && amounts[0] > 0 ? amounts[0] : null;
  if (promisedCents != null && candidates.length) evidence.push({ ...candidates[0].sentence, label: 'Promised credit' });
  if (candidates.length && !/\bUSD\b/i.test(text)) warnings.push('An unqualified $ amount is treated as USD in this USD-only prototype. Confirm the currency.');
  const references = [...text.matchAll(/\b(?:commitment\s+reference|commitment_ref|reference|ref)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9_-]{1,79})(?![A-Za-z0-9_-])/gi)];
  const uniqueReferences = [...new Set(references.map(match => match[1]))];
  if (uniqueReferences.length !== 1) errors.push(uniqueReferences.length > 1 ? 'Multiple commitment references appear. Analyze one commitment at a time.' : 'Add an explicit Reference: value to match invoice credits safely.');
  const commitmentRef = uniqueReferences.length === 1 ? uniqueReferences[0] : null;
  if (commitmentRef) evidence.push({ start: references[0].index, end: references[0].index + references[0][0].length, label: 'Commitment reference' });
  const due = extractDueDate(text);
  if (due.error) errors.push(due.error);
  if (due.evidence) evidence.push({ ...due.evidence, label: 'Expected invoice date' });
  const condition = extractCondition(text);
  if (condition) evidence.push({ ...condition, label: 'Original condition' });
  return { promisedCents, commitmentRef, dueDate: due.dueDate, dueDatePrecision: due.precision, condition: condition?.text || null, evidence, errors: [...new Set(errors)], warnings };
}

/** Parse RFC 4180-style CSV while retaining each record's exact source range. */
function csvRecords(text) {
  const records = [], errors = [];
  let cells = [], cell = '', quote = false, closedQuote = false, start = 0, row = 1;
  const pushRecord = end => {
    cells.push(cell);
    if (cells.some(value => value.trim())) records.push({ cells, start, end, rowNumber: row });
    cells = []; cell = ''; closedQuote = false; start = end; row += 1;
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; }
        else { quote = false; closedQuote = true; }
      } else cell += character;
    } else if (character === '"') {
      if (cell !== '' || closedQuote) errors.push(`Row ${row}: unexpected quote.`);
      quote = true;
    } else if (character === ',') {
      cells.push(cell); cell = ''; closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      const end = index;
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      pushRecord(end); start = index + 1;
    } else {
      if (closedQuote && !/\s/.test(character)) errors.push(`Row ${row}: characters follow a closing quote.`);
      if (!closedQuote) cell += character;
    }
  }
  if (quote) errors.push(`Row ${row}: unclosed quoted field.`);
  if (cell || cells.length) pushRecord(text.length);
  return { records, errors: [...new Set(errors)] };
}

export function parseInvoiceCsv(invoiceCsv) {
  const text = typeof invoiceCsv === 'string' ? invoiceCsv : '';
  if (text.length > MAX_INPUT) return { rows: [], errors: ['Invoice CSV exceeds 250,000 characters.'], warnings: [] };
  if (!text.trim()) return { rows: [], errors: [], warnings: ['No invoice rows supplied. A promise alone cannot prove applied savings.'] };
  const parsed = csvRecords(text);
  const errors = [...parsed.errors], warnings = [], rows = [];
  if (!parsed.records.length) return { rows, errors: ['The invoice CSV is empty.'], warnings };
  const header = parsed.records[0].cells.map(value => value.replace(/^\uFEFF/, '').trim());
  if (new Set(header).size !== header.length) errors.push('CSV header names must be unique.');
  for (const required of HEADERS) if (!header.includes(required)) errors.push(`CSV is missing the ${required} column.`);
  if (errors.length) return { rows, errors, warnings };
  const seen = new Map();
  for (const record of parsed.records.slice(1)) {
    if (record.cells.length !== header.length) { errors.push(`Row ${record.rowNumber}: expected ${header.length} columns, received ${record.cells.length}.`); continue; }
    const data = Object.fromEntries(header.map((name, index) => [name, record.cells[index].trim()]));
    const rowErrors = [];
    for (const field of HEADERS) if (!data[field]) rowErrors.push(`Row ${record.rowNumber}: ${field} is required.`);
    if (!isDate(data.date)) rowErrors.push(`Row ${record.rowNumber}: date must be a real YYYY-MM-DD date.`);
    if (!/^[A-Z]{3}$/.test(data.currency)) rowErrors.push(`Row ${record.rowNumber}: currency must be a three-letter uppercase code.`);
    let amountCents = null;
    try {
      amountCents = moneyToCents(data.amount);
      if (amountCents <= 0) rowErrors.push(`Row ${record.rowNumber}: credit amount must be positive.`);
    } catch { rowErrors.push(`Row ${record.rowNumber}: amount must be a positive decimal credit with at most two decimal places.`); }
    if (rowErrors.length) { errors.push(...rowErrors); continue; }
    const signature = JSON.stringify(HEADERS.map(name => data[name]));
    if (seen.has(data.invoice_id)) {
      if (seen.get(data.invoice_id) === signature) warnings.push(`Duplicate invoice ${data.invoice_id} ignored; its credit is counted once.`);
      else errors.push(`Invoice ${data.invoice_id} has conflicting rows. Use one credit row per invoice or distinct invoice IDs; the engine cannot safely deduplicate them.`);
      continue;
    }
    seen.set(data.invoice_id, signature);
    rows.push({ invoiceId: data.invoice_id, vendor: data.vendor, date: data.date, description: data.description, amountCents, currency: data.currency, commitmentRef: data.commitment_ref, rowNumber: record.rowNumber, start: record.start, end: record.end, quote: text.slice(record.start, record.end) });
  }
  if (!rows.length && !errors.length) warnings.push('The CSV has a header but no invoice rows. No savings are verified.');
  return { rows, errors, warnings };
}

function fingerprint(text) {
  let result = 2166136261;
  for (let index = 0; index < text.length; index += 1) { result ^= text.charCodeAt(index); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export function analyzeEvidence(input = {}) {
  let { vendor = '', promiseText = '', invoiceCsv = '', replyText = '', asOf = '2026-10-28' } = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const inputErrors = [];
  for (const [field, value] of Object.entries({ vendor, promiseText, invoiceCsv, replyText, asOf })) {
    if (typeof value !== 'string') inputErrors.push(`${field} must be text.`);
  }
  vendor = typeof vendor === 'string' ? vendor.trim() : '';
  promiseText = typeof promiseText === 'string' ? promiseText : '';
  invoiceCsv = typeof invoiceCsv === 'string' ? invoiceCsv : '';
  replyText = typeof replyText === 'string' ? replyText : '';
  asOf = typeof asOf === 'string' ? asOf : '';
  if (!vendor) inputErrors.push('Name the vendor before analyzing.');
  if (!isDate(asOf)) inputErrors.push('The review date must be a real YYYY-MM-DD date.');
  if (replyText.length > MAX_INPUT) inputErrors.push('Reply text exceeds 250,000 characters.');
  const promise = extractPromise(promiseText);
  const metadata = sourceMetadata(promiseText);
  const invoices = parseInvoiceCsv(invoiceCsv);
  const errors = [...inputErrors, ...promise.errors, ...metadata.errors, ...invoices.errors];
  const warnings = [...promise.warnings, ...invoices.warnings];
  if (metadata.sourceVendor && identity(metadata.sourceVendor) !== identity(vendor)) errors.push('The selected vendor does not match the Vendor: header in the original promise.');
  if (metadata.promiseDate && isDate(asOf) && metadata.promiseDate > asOf) errors.push('The promise Date: header is later than the review date. Future source evidence cannot establish a current promise.');
  if (!metadata.promiseDate) warnings.push('No promise Date: header was supplied. Matching relies on the unique commitment reference; add the source date to exclude earlier credits.');
  const citations = [];
  const addCitation = (source, text, range) => {
    const result = { id: `e${citations.length + 1}`, ...span(text, range.start, range.end, range.label), source };
    citations.push(result); return result.id;
  };
  for (const range of promise.evidence) addCitation('promise', promiseText, range);
  if (metadata.vendorEvidence) addCitation('promise', promiseText, metadata.vendorEvidence);
  if (metadata.dateEvidence) addCitation('promise', promiseText, metadata.dateEvidence);
  const reply = extractCondition(replyText);
  if (reply) addCitation('reply', replyText, { ...reply, label: 'New vendor condition' });
  const replyReviewRequired = Boolean(replyText.trim() && !reply);
  if (replyReviewRequired) warnings.push('Vendor reply retained for manual review. No supported condition phrase was detected; this does not establish acceptance or rule out changed terms.');
  const excludedRows = [], invoiceMatches = [];
  let appliedCents = 0;
  for (const row of invoices.rows) {
    let exclusion = null;
    if (errors.length) exclusion = 'Source validation failed; resolve errors before counting credits.';
    else if (identity(row.vendor) !== identity(vendor)) exclusion = 'Different vendor.';
    else if (row.currency !== 'USD') exclusion = 'Different currency.';
    else if (row.commitmentRef !== promise.commitmentRef) exclusion = 'Different commitment reference.';
    else if (metadata.promiseDate && row.date < metadata.promiseDate) exclusion = 'Invoice predates the original promise.';
    else if (row.date > asOf) exclusion = 'Invoice is later than the review date.';
    else if (promise.condition) exclusion = 'Original promise is conditional; finance must establish fulfillment before verifying these credits.';
    if (exclusion) { excludedRows.push({ ...row, reason: exclusion }); continue; }
    if (!Number.isSafeInteger(appliedCents + row.amountCents)) {
      errors.push('Combined credits exceed the safe integer limit.');
      break;
    }
    const citationId = addCitation('invoice', invoiceCsv, { ...row, label: `Applied credit · ${row.invoiceId}` });
    invoiceMatches.push({ ...row, citationId });
    appliedCents += row.amountCents;
  }
  if (errors.length) { appliedCents = 0; invoiceMatches.length = 0; }
  const promisedCents = promise.promisedCents;
  const outstandingCents = promisedCents == null ? null : Math.max(0, promisedCents - appliedCents);
  const overappliedCents = promisedCents == null ? 0 : Math.max(0, appliedCents - promisedCents);
  if (overappliedCents) warnings.push(`${display(overappliedCents)} more credit is present than the original promise. Review the excess; it is not attributed to this promise.`);
  if (reply) warnings.push('The vendor reply introduces a condition. Original terms are unchanged; accepting any new obligation requires a separate approval.');
  if (promise.condition) warnings.push('The original promise is conditional. Potential value is excluded from verified savings until the condition is independently resolved.');
  const future = Boolean(promise.dueDate && isDate(asOf) && promise.dueDate > asOf);
  let status = errors.length ? 'unsupported' : promise.condition ? 'conditional' : outstandingCents === 0 ? 'verified' : reply ? 'conditional' : future ? 'scheduled' : replyReviewRequired ? 'needs_review' : appliedCents > 0 ? 'partial' : 'needs_review';
  // Extra invoice value is observable, but only the promised amount can be attributed as savings.
  const verifiedCents = errors.length || promise.condition ? 0 : Math.min(appliedCents, promisedCents ?? 0);
  const citationIds = label => citations.filter(item => item.label === label).map(item => item.id);
  const reasoning = [
    { label: 'Original promise', detail: promisedCents == null ? 'A single supported amount could not be established.' : `${display(promisedCents)} promised by ${vendor || 'the vendor'}.`, citationIds: citationIds('Promised credit') },
    { label: 'Invoice match', detail: `${invoiceMatches.length} credit row${invoiceMatches.length === 1 ? '' : 's'} matched vendor, USD, commitment reference, and review date.`, citationIds: invoiceMatches.map(row => row.citationId) },
    { label: 'Outstanding', detail: outstandingCents == null ? 'Cannot calculate without an unambiguous promise.' : `${display(promisedCents)} promised − ${display(appliedCents)} matched = ${display(outstandingCents)} outstanding.`, citationIds: [...citationIds('Promised credit'), ...invoiceMatches.map(row => row.citationId)] },
  ];
  if (future) reasoning.push({ label: 'Schedule', detail: `Expected by ${promise.dueDate}${promise.dueDatePrecision === 'month' ? ' (invoice month; using month end)' : ''}. This balance is not overdue as of ${asOf}.`, citationIds: citationIds('Expected invoice date') });
  if (reply) reasoning.push({ label: 'Authority boundary', detail: 'A new vendor condition is separate from the original promise. No new terms have been accepted.', citationIds: citationIds('New vendor condition') });
  if (errors.length) reasoning.push({ label: 'Needs correction', detail: 'Resolve source errors before using this analysis. No invoice savings are counted.', citationIds: [] });
  const draft = errors.length || promise.condition || future || replyReviewRequired || !outstandingCents ? '' : `Hi ${vendor} billing team,\n\nYour original commitment (${promise.commitmentRef}) confirms a ${display(promisedCents)} credit, expected by ${promise.dueDate}. We matched ${display(appliedCents)} in invoice credits, leaving ${display(outstandingCents)} outstanding as of ${asOf}.\n\nPlease confirm the remaining credit under the original agreement and provide its invoice reference.${reply ? ' We have not accepted the new condition in your reply; any renewal or other new obligation requires separate finance approval.' : ''}\n\nThe original promise and matching invoice evidence are attached for review.\n\nThank you,\nFinance`;
  return {
    id: `case-${fingerprint(JSON.stringify({ vendor, promiseText, invoiceCsv, replyText, asOf }))}`,
    vendor, promisedCents, appliedCents, verifiedCents, outstandingCents, overappliedCents,
    currency: 'USD', dueDate: promise.dueDate, dueDatePrecision: promise.dueDatePrecision,
    commitmentRef: promise.commitmentRef, promiseDate: metadata.promiseDate, sourceVendor: metadata.sourceVendor,
    condition: promise.condition, replyCondition: reply?.text || null, replyReviewRequired,
    status, requiresApproval: Boolean(draft), citations, invoiceMatches, excludedRows, warnings,
    errors: [...new Set(errors)], reasoning: errors.length ? [{label:'Source review required',detail:'The documents do not establish a supported recovery. No financial result is verified.',citationIds:citations.map(c => c.id)}] : reasoning, draft, asOf,
    documents: { promiseText, invoiceCsv, replyText },
    engine: { name: 'Truthful bounded evidence rules', version: '1.0.0', citationOffsets: 'UTF-16', liveIntegration: false },
  };
}
