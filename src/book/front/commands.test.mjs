import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace, validateWorkspace } from '../../assurance/index.mjs';
import { acceptOfferCommands, approveLetterCommands, declineOfferCommands, nextInvoiceCommands, plainFailure, readDocument } from './commands.mjs';
import { bookFor } from './selectors.mjs';
import { scopeKit } from './kit-scope.mjs';

// Every batch the book builds is sent through the app's own reducer, the way
// the app's useAssurance hook sends it, and the book is read again from the result.
const now = '2026-11-10T20:00:00.000Z';
const actor = { id: 'book-test', role: 'admin' };
const context = { actor, now };
const send = (state, commands, as = actor) => commands.reduce((next, command) => reduceWorkspace(next, { ...command, id: command.id || crypto.randomUUID() }, { actor: as, now }).state, state);
const promise = (state, id) => bookFor(state, { now, demo: true, keeper: { person: 'Alex', company: 'Acme Labs', signature: 'Alex · Acme Labs', actorId: actor.id } }).promises.find((item) => item.id === id);
const view = (state) => evaluateWorkspace(state, { asOf: now.slice(0, 10), knownAt: now });
const example = (name) => readFileSync(new URL(`../../../public/examples/${name}`, import.meta.url), 'utf8');

test('approving the letter approves the engine’s own action for that promise', () => {
  const workspace = createDemoWorkspace();
  const commands = approveLetterCommands(workspace, 'pipeline-seats', context);
  assert.deepEqual(commands, [{ type: 'APPROVE_ACTION', actionId: 'action-pipeline-preserve' }], 'the action already waiting is the one approved');
  const after = send(workspace, commands);
  assert.equal(promise(after, 'pipeline-seats').letter.approvedAt, now);
  assert.equal(promise(after, 'pipeline-seats').letter.approvedByYou, true);
  assert.equal(view(after).actions.find((action) => action.id === 'action-pipeline-preserve').status, 'approved', 'the Cases screen sees the same approval');
  assert.deepEqual(approveLetterCommands(after, 'pipeline-seats', context), [], 'approving twice asks for nothing more');
  assert.equal(validateWorkspace(after).valid, true);
});

test('a promise with no action waiting gets one recorded and approved in the same batch', () => {
  const workspace = createDemoWorkspace();
  const commands = approveLetterCommands(workspace, 'parcel-waiver', context);
  assert.deepEqual(commands.map((command) => command.type), ['PROPOSE_ACTION', 'APPROVE_ACTION']);
  assert.equal(commands[0].action.type, 'prepare_claim');
  assert.equal(commands[1].actionId, commands[0].action.id);
  const after = send(workspace, commands);
  assert.equal(promise(after, 'parcel-waiver').letter.approvedAt, now);
});

test('after the records change, the old approval is not reused: a new action is recorded', () => {
  let workspace = send(createDemoWorkspace(), approveLetterCommands(createDemoWorkspace(), 'pipeline-seats', context));
  workspace = send(workspace, declineOfferCommands('amendment-pipeline-renewal', 'It costs more than the credit'));
  assert.equal(promise(workspace, 'pipeline-seats').letter.lapsed, true);
  const again = approveLetterCommands(workspace, 'pipeline-seats', context);
  assert.deepEqual(again.map((command) => command.type), ['PROPOSE_ACTION', 'APPROVE_ACTION']);
  const after = send(workspace, again);
  assert.deepEqual([promise(after, 'pipeline-seats').letter.approvedAt, promise(after, 'pipeline-seats').letter.lapsed], [now, false]);
});

test('the engine, not the book, refuses what is not allowed', () => {
  const workspace = createDemoWorkspace();
  // Nimbus's last day to claim has passed
  assert.throws(() => send(workspace, approveLetterCommands(workspace, 'nimbus-sla', context)), { code: 'POLICY_BLOCKED' });
  // a viewer cannot approve
  assert.throws(() => send(workspace, approveLetterCommands(workspace, 'pipeline-seats', context), { id: 'reader', role: 'viewer' }), { code: 'FORBIDDEN' });
  // the renewal costs money the rules do not allow
  assert.throws(() => send(workspace, acceptOfferCommands(workspace, 'pipeline-seats', 'amendment-pipeline-renewal', context)), { code: 'POLICY_BLOCKED' });
  // the later date cannot be taken while the other offer is open
  assert.throws(() => send(workspace, acceptOfferCommands(workspace, 'pipeline-seats', 'amendment-pipeline-date', context)), { code: 'POLICY_BLOCKED' });
  assert.throws(() => approveLetterCommands(workspace, 'no-such-promise', context), /not in the book/);
});

test('declining an offer records the refusal with its reason, or says none was given', () => {
  const workspace = createDemoWorkspace();
  assert.deepEqual(declineOfferCommands('amendment-pipeline-renewal', '  It costs more than the credit '), [{ type: 'DISMISS_AMENDMENT', amendmentId: 'amendment-pipeline-renewal', reason: 'It costs more than the credit' }]);
  assert.equal(declineOfferCommands('amendment-pipeline-renewal', '   ')[0].reason, 'No reason given');
  assert.equal(declineOfferCommands('x', 'r'.repeat(400))[0].reason.length, 200);
  const after = send(workspace, declineOfferCommands('amendment-pipeline-renewal', 'It costs more than the credit'));
  const offers = promise(after, 'pipeline-seats').offers;
  assert.deepEqual(offers.map((offer) => [offer.kind, offer.decision?.type ?? null, offer.canAccept]), [['later', null, true], ['renew', 'declined', false]]);
  assert.equal(offers[1].decision.reason, 'It costs more than the credit');
  assert.equal(view(after).amendments.find((item) => item.id === 'amendment-pipeline-renewal').rejected, true);
});

test('accepting the later date moves the due date in the engine, for every screen', () => {
  let workspace = send(createDemoWorkspace(), declineOfferCommands('amendment-pipeline-renewal', ''));
  const commands = acceptOfferCommands(workspace, 'pipeline-seats', 'amendment-pipeline-date', context);
  assert.deepEqual(commands.map((command) => command.type), ['PROPOSE_ACTION', 'APPROVE_ACTION', 'EXECUTE_ACTION']);
  workspace = send(workspace, commands);
  const p = promise(workspace, 'pipeline-seats');
  assert.deepEqual([p.due, p.firstDue, p.overdue, p.owedCents], ['2026-11-15', '2026-10-01', false, 150000]);
  assert.equal(p.offers[0].decision.type, 'accepted');
  assert.equal(view(workspace).commitments.find((item) => item.id === 'pipeline-seats').dueDate, '2026-11-15');
  // the engine will not let it be chased before the new date
  assert.deepEqual([p.letter.canApprove, p.letter.why], [false, 'It is not due until Nov 15.']);
  assert.equal(validateWorkspace(workspace).valid, true);
});

test('the next invoice is recorded as a real credit, and the promise is paid everywhere', () => {
  const workspace = createDemoWorkspace();
  const { commands, invoice } = nextInvoiceCommands(workspace, 'pipeline-seats', { ...context, day: '2026-11-09' });
  assert.deepEqual(commands.map((command) => command.type), ['ADD_SOURCE', 'REGISTER_CREDIT', 'ALLOCATE_CREDIT']);
  assert.deepEqual([invoice.id, invoice.date, invoice.creditCents], ['INV-PC-1126', '2026-11-09', 150000]);
  assert.ok(commands.every((command) => command.effectiveDate === '2026-11-09'));
  const after = send(workspace, commands);
  const p = promise(after, 'pipeline-seats');
  assert.deepEqual([p.creditedCents, p.owedCents, p.overdue, p.letter, p.nextInvoice], [240000, 0, false, null, null]);
  assert.deepEqual(p.papers.invoices.map((paper) => [paper.id, paper.date, paper.creditCents, paper.totalCents]), [['INV-PC-1026', '2026-10-01', 90000, null], ['INV-PC-1126', '2026-11-09', 150000, 450000]]);
  assert.deepEqual(p.papers.invoices[1].lines, [{ label: 'Team subscription', cents: 600000, credit: false }, { label: 'Duplicate seat correction', cents: -150000, credit: true }]);
  assert.equal(p.paidNote, 'Invoice INV-PC-1126 shows the other $1,500. Paid in full.');
  const engine = view(after);
  assert.equal(engine.commitments.find((item) => item.id === 'pipeline-seats').status, 'verified');
  assert.equal(engine.totals.outstandingCents, 235000);
  assert.equal(validateWorkspace(after).valid, true);
  assert.throws(() => nextInvoiceCommands(after, 'pipeline-seats', context), /Nothing is owed/);
});

test('a credit note is applied by the invoice that shows it, not counted twice', () => {
  const workspace = createDemoWorkspace();
  const { commands } = nextInvoiceCommands(workspace, 'nimbus-sla', context);
  assert.deepEqual(commands.map((command) => command.type), ['ADD_SOURCE', 'APPLY_CREDIT']);
  const after = send(workspace, commands);
  const p = promise(after, 'nimbus-sla');
  assert.deepEqual([p.creditedCents, p.owedCents], [200000, 0]);
  assert.deepEqual(p.papers.notes.map((note) => [note.id, note.onInvoice]), [['CM-NC-204', true]]);
  assert.deepEqual(p.papers.invoices.map((paper) => [paper.id, paper.creditCents, paper.totalCents]), [['INV-NC-1126', 200000, 600000]]);
  assert.deepEqual(p.asides, []);
  assert.equal(view(after).credits.length, 2, 'no second credit was made up');
  assert.equal(validateWorkspace(after).valid, true);
});

test('with every invoice in, nothing is owed and the totals balance', () => {
  let workspace = createDemoWorkspace();
  for (const id of ['pipeline-seats', 'nimbus-sla', 'parcel-waiver']) workspace = send(workspace, nextInvoiceCommands(workspace, id, context).commands);
  assert.deepEqual(bookFor(workspace, { now }).totals, { promisedCents: 475000, creditedCents: 475000, owedCents: 0 });
  assert.equal(validateWorkspace(workspace).valid, true);
});

test('a promise dropped in the tray is read by the app’s document engine and written into the workspace', async () => {
  const workspace = createDemoWorkspace();
  const letter = 'Vendor: Lumen Mail\nDate: 2026-10-30\nReference: LM-REFUND-2026\nDue date: 2026-11-05\n\nHi Alex,\n\nWe will refund USD 600 on your November 2026 invoice for the double charge.\n\nDana';
  const read = await readDocument(workspace, letter, context);
  assert.deepEqual([read.kind, read.vendor, read.cents], ['promise', 'Lumen Mail', 60000]);
  assert.deepEqual(read.commands.map((command) => command.type), ['ADD_VENDOR', 'ADD_SOURCE', 'CREATE_COMMITMENT']);
  const after = send(workspace, read.commands);
  const p = promise(after, read.commitmentId);
  assert.deepEqual([p.vendor, p.reference, p.promisedCents, p.owedCents, p.due, p.overdue], ['Lumen Mail', 'LM-REFUND-2026', 60000, 60000, '2026-11-05', true]);
  assert.equal(p.quote, 'We will refund USD 600 on your November 2026 invoice for the double charge.');
  assert.equal(bookFor(after, { now }).totals.owedCents, 445000);
  assert.equal((await readDocument(after, letter, context)).kind, 'known');

  // its credit arrives as a spreadsheet line
  const sheet = 'invoice_id,vendor,date,description,amount,currency,commitment_ref\nINV-LM-1126,Lumen Mail,2026-11-06,Refund for double charge,600.00,USD,LM-REFUND-2026\n';
  const credit = await readDocument(after, sheet, context);
  assert.deepEqual([credit.kind, credit.cents, credit.vendors, credit.commitmentIds], ['credit', 60000, ['Lumen Mail'], [read.commitmentId]]);
  const paid = send(after, credit.commands);
  assert.deepEqual([promise(paid, read.commitmentId).owedCents, promise(paid, read.commitmentId).papers.invoices[0].lines], [0, [{ label: 'Refund for double charge', cents: -60000, credit: true }]]);
  assert.equal((await readDocument(paid, sheet, context)).kind, 'known-invoice');
  assert.equal(validateWorkspace(paid).valid, true);
});

test('the product’s own example files read the way the book says', async () => {
  const workspace = createDemoWorkspace();
  assert.equal((await readDocument(workspace, example('pipeline-promise.txt'), context)).kind, 'known');
  assert.equal((await readDocument(workspace, example('parcel-promise.txt'), context)).kind, 'known');
  assert.equal((await readDocument(workspace, example('orbit-promise.txt'), context)).kind, 'offer');
  assert.equal((await readDocument(workspace, example('pipeline-reply.txt'), context)).kind, 'offer');
  // the complete credit sheet pays Pipeline off; its first line is already in the book
  const sheet = await readDocument(workspace, example('pipeline-invoices-complete.csv'), context);
  assert.deepEqual([sheet.kind, sheet.cents, sheet.commitmentIds], ['credit', 150000, ['pipeline-seats']]);
  assert.equal(promise(send(workspace, sheet.commands), 'pipeline-seats').owedCents, 0);
  // lines for other references, or other vendors, are left alone
  assert.equal((await readDocument(workspace, example('pipeline-invoices.csv'), context)).kind, 'known-invoice');
  assert.equal((await readDocument(workspace, example('orbit-invoices.csv'), context)).kind, 'no-match');
});

test('a paper the engine cannot make a promise of is turned away with what is missing', async () => {
  const workspace = createDemoWorkspace();
  assert.deepEqual(await readDocument(workspace, 'See you at lunch on Friday.', context), { kind: 'missed', why: 'sentence' });
  assert.deepEqual(await readDocument(workspace, 'We will credit you USD 50 on your December 2026 invoice.', context), { kind: 'missed', why: 'vendor', cents: 5000 });
  assert.deepEqual(await readDocument(workspace, 'Vendor: Parcel\nWe will credit you USD 50 on your December 2026 invoice.', context), { kind: 'missed', why: 'reference', cents: 5000 });
  assert.deepEqual(await readDocument(workspace, 'Vendor: Parcel\nReference: PL-EXTRA-2026\nWe will credit you USD 50 soon.', context), { kind: 'missed', why: 'date', cents: 5000 });
  assert.deepEqual(await readDocument(workspace, 'Vendor: Parcel\nReference: PL-SETUP-2026\nDue date: 2026-12-01\nWe will credit you USD 50.', context), { kind: 'missed', why: 'differs', cents: 5000 });
  assert.deepEqual(await readDocument(workspace, 'invoice_id,vendor\nINV-1,Parcel', context), { kind: 'missed', why: 'sheet' });
});

test('a refusal from the app is said in plain words', () => {
  assert.equal(plainFailure({ code: 'FORBIDDEN', message: 'This command requires approver.' }), 'Your sign-in is not allowed to do that. Open the full case and ask someone who can approve.');
  assert.equal(plainFailure({ code: 'POLICY_BLOCKED', details: { reasons: ['The promise is not due until 2026-11-15.'] } }), 'It is not due until Nov 15.');
  assert.equal(plainFailure({ code: 'STALE_APPROVAL' }), 'The book changed while you were reading. Look again, then try once more.');
  assert.equal(plainFailure(new Error('Wait for the current operation to finish.')), 'The book is still writing the last thing down. Try again in a moment.');
  assert.equal(plainFailure(new Error('socket hang up')), 'That did not go through. Open the full case to see why.');
});

test('the kit’s stylesheet is put under the front’s root class without being edited', () => {
  const kit = readFileSync(new URL('../kit/paper.css', import.meta.url), 'utf8');
  const scoped = scopeKit(kit);
  assert.doesNotMatch(scoped, /:root/);
  assert.doesNotMatch(scoped, /\/\*/);
  assert.match(scoped, /^@property --lift\{/m);
  assert.equal((scoped.match(/@keyframes /g) ?? []).length, (kit.match(/@keyframes /g) ?? []).length);
  assert.match(scoped, /@media \(prefers-reduced-motion: reduce\)\{\.book-front /);
  // every rule outside @keyframes and @property begins at the root class
  const rules = scoped.replace(/@(?:keyframes|property)[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '').replace(/@media[^{]*\{/g, '');
  const selectors = [...rules.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].flatMap((match) => match[1].split(',')).map((selector) => selector.trim()).filter(Boolean);
  assert.ok(selectors.length > 60);
  for (const selector of selectors) assert.ok(selector === '.book-front' || selector.startsWith('.book-front '), selector);
  assert.equal((scoped.match(/\{/g) ?? []).length, (scoped.match(/\}/g) ?? []).length);
  // a list with a comma inside brackets stays one selector, and html, body and :root become the root
  assert.equal(scopeKit('.a:is(.b, .c), .d { color: red }').trim(), '.book-front .a:is(.b, .c),.book-front .d{ color: red }');
  assert.equal(scopeKit('html, body, :root { margin: 0 }', '.x').trim(), '.x,.x,.x{ margin: 0 }');
});

test('the front’s own stylesheet keeps every rule under .book-front and its tokens under --bf-', () => {
  const css = readFileSync(new URL('./book.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.replace(/@keyframes[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '').replace(/@(?:media|container)[^{]*\{/g, '');
  const selectors = [...rules.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].flatMap((match) => match[1].split(/,(?![^(]*\))/)).map((selector) => selector.trim()).filter(Boolean);
  assert.ok(selectors.length > 400);
  for (const selector of selectors) assert.ok(selector === '.book-front' || selector.startsWith('.book-front '), selector);
  assert.doesNotMatch(css, /(?:^|[\s,}])(?:html|body|:root)\s*[{,]/);
  for (const name of css.match(/@keyframes\s+([\w-]+)/g)) assert.match(name, /@keyframes\s+bf-/);
  // tokens the front defines are its own; the rest are the kit's
  const kit = readFileSync(new URL('../kit/paper.css', import.meta.url), 'utf8') + readFileSync(new URL('../kit/paper.js', import.meta.url), 'utf8');
  const defined = new Set([...css.matchAll(/(?:^|[{;\s])(--[\w-]+)\s*:/g)].map((match) => match[1]));
  for (const token of defined) assert.ok(token.startsWith('--bf-') || kit.includes(token), `${token} is neither the front's nor the kit's`);
});
