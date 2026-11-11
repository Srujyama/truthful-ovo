import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, evaluateWorkspace, reduceWorkspace } from '../../../assurance/index.mjs';
import {
  GROUPS, companyCounts, creditMatches, creditMoney, creditNoun, creditPapers, drawerPapers, filterCounts,
  findPassages, groupFor, nothingFound, openingLines, paperCopies, paperFacts, paperLook, paperTurn,
  paperUses, splitByPassages, whatItIs,
} from './kinds.mjs';

const TODAY = '2026-11-10';
const book = (workspace = createDemoWorkspace(), knownAt = `${TODAY}T23:59:59.999Z`) => evaluateWorkspace(workspace, { asOf: TODAY, knownAt });
const paper = (view, id) => view.sources.find(source => source.id === id);
const marked = (text, passages) => passages.map(passage => text.slice(passage.start, passage.end));

test('every kind of paper in the demo book has a noun and a stock', () => {
  const view = book();
  const kinds = [...new Set(view.sourceVersions.map(source => source.kind))];
  assert.ok(kinds.length >= 6);
  for (const kind of kinds) {
    const look = paperLook(kind);
    assert.notEqual(look.noun, 'Paper', `${kind} has no noun of its own`);
    assert.match(look.stock, /^(bond|cool|laid|manila|carbon)$/, `${kind} has no stock`);
    assert.ok(GROUPS.some(group => group.id === look.group), `${kind} sits under no filter`);
  }
  assert.deepEqual(paperLook('email'), { noun: 'Letter', stock: 'bond', group: 'letters' });
  assert.equal(paperLook('invoice').stock, 'cool');
  assert.equal(paperLook('credit_memo').stock, 'carbon');
  assert.equal(paperLook('contract').stock, 'laid');
  assert.equal(paperLook('agent_conversation').stock, 'manila');
});

test('a kind the book has never seen is a plain paper on bond', () => {
  assert.deepEqual(paperLook('fax_from_the_future'), { noun: 'Paper', stock: 'bond', group: 'other' });
  assert.equal(groupFor('email'), 'letters');
  assert.equal(groupFor('credit-notes'), 'credit-notes');
  assert.equal(groupFor('nonsense'), '');
});

test('the pipeline promise is marked where it prints its amount, its date and its reference', () => {
  const view = book();
  const source = paper(view, 'pipeline-promise');
  const facts = paperFacts(view, source);
  const passages = findPassages(source.text, facts);
  const words = marked(source.text, passages);
  assert.ok(words.includes('USD 2,400'), 'the amount is marked');
  assert.ok(words.includes('October 1, 2026'), 'the due date is marked');
  assert.ok(words.includes('PC-SEATS-2026'), 'the reference is marked');
  const amount = passages.find(passage => source.text.slice(passage.start, passage.end) === 'USD 2,400');
  assert.deepEqual(amount.facts.map(index => facts[index].label), ['They promised']);
  assert.equal(facts[amount.facts[0]].value, '$2,400');
});

test('marking a paper never changes a letter of it', () => {
  const view = book();
  for (const source of view.sourceVersions) {
    const passages = findPassages(source.text, paperFacts(view, source));
    assert.equal(splitByPassages(source.text, passages).map(part => part.text).join(''), source.text);
    for (let i = 1; i < passages.length; i++) assert.ok(passages[i].start >= passages[i - 1].end, 'passages overlap');
  }
});

test('a figure Truthful worked out is not pinned on a passage that happens to match', () => {
  const view = book();
  const source = paper(view, 'pipeline-renewal');
  const facts = paperFacts(view, source);
  const cost = facts.findIndex(fact => fact.label === 'That costs you');
  assert.equal(facts[cost].value, '$900');
  const passages = findPassages(source.text, facts);
  assert.ok(passages.every(passage => !passage.facts.includes(cost)));
  assert.ok(!marked(source.text, passages).includes('USD 900'));
  assert.ok(marked(source.text, passages).includes('USD 74,400'));
  assert.equal(facts.find(fact => fact.label === 'Where it stands').value, 'Waiting for your answer');
});

test('money and dates are found however the paper writes them', () => {
  const text = 'Paid $1,500.00 on 2026-11-15, then 900.00 USD on 3 Dec 2026. Ref AB-12. Uptime was 98.75%.';
  const facts = [{ label: 'a', value: '$1,500' }, { label: 'b', value: 'Nov 15, 2026' }, { label: 'c', value: '$900' }, { label: 'd', value: 'December 3, 2026' }, { label: 'e', value: 'ab-12' }, { label: 'f', value: '$98.75' }];
  assert.deepEqual(marked(text, findPassages(text, facts)), ['$1,500.00', '2026-11-15', '900.00 USD', '3 Dec 2026', 'AB-12']);
  assert.deepEqual(findPassages('Two figures: USD 2,400 and USD 2,400.', [{ value: '$2,400' }, { value: '$2,400' }]).map(p => p.facts), [[0, 1], [0, 1]]);
  assert.deepEqual(findPassages('', [{ value: '$1' }]), []);
});

test('the outage report shows the claim it supports, and the agreement its claim date', () => {
  const view = book();
  const incident = paper(view, 'nimbus-incident');
  assert.ok(marked(incident.text, findPassages(incident.text, paperFacts(view, incident))).includes('USD 2,000'));
  const contract = paper(view, 'nimbus-contract');
  const facts = paperFacts(view, contract);
  assert.equal(facts.find(fact => fact.label === 'Claim by').value, 'Oct 30, 2026');
  assert.ok(marked(contract.text, findPassages(contract.text, facts)).includes('October 30, 2026'));
  assert.equal(whatItIs(view, paper(view, 'pipeline-promise')), 'A promise of $2,400, due Oct 1, 2026.');
  assert.equal(whatItIs(view, paper(view, 'nimbus-memo')), 'A credit note for $2,000.');
});

test('the filter counts add up to the number of papers', () => {
  const view = book();
  const items = drawerPapers(view);
  assert.equal(items.length, view.sources.length + view.credits.length);
  const [all, ...groups] = filterCounts(items);
  assert.deepEqual({ id: all.id, count: all.count }, { id: 'all', count: items.length });
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), items.length);
  assert.equal(groups.find(group => group.id === 'letters').count, 4);
  assert.equal(groups.find(group => group.id === 'credit-notes').count, 3);
  assert.ok(groups.every(group => group.count > 0));
  const [every, ...companies] = companyCounts(view, items);
  assert.equal(every.count, items.length);
  assert.equal(companies.reduce((sum, company) => sum + company.count, 0), items.length);
  assert.deepEqual(companies.map(company => company.label), ['Nimbus Cloud', 'Orbit Design', 'Parcel', 'Pipeline CRM']);
});

test('the drawer is newest first, finds by word, and a credit note is a paper in it', () => {
  const view = book();
  const items = drawerPapers(view);
  assert.equal(items[0].address, 'pipeline-renewal@23');
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].order >= items[i].order);
  const note = items.find(item => item.address === 'credit:credit-nimbus-2000');
  assert.deepEqual({ noun: note.noun, stock: note.stock, group: note.group, onInvoice: note.onInvoice, amountCents: note.amountCents }, { noun: 'Credit note', stock: 'carbon', group: 'credit-notes', onInvoice: false, amountCents: 200000 });
  assert.equal(items.find(item => item.address === 'credit:credit-pipeline-900').noun, 'Invoice credit');
  assert.deepEqual(drawerPapers(view, { query: 'cm-nc-204' }).map(item => item.address).sort(), ['credit:credit-nimbus-2000', 'nimbus-memo@18']);
  assert.deepEqual(drawerPapers(view, { query: 'no such word anywhere' }), []);
  assert.equal(items.find(item => item.sourceId === 'pipeline-promise').lines.startsWith('We will credit USD 2,400'), true);
});

test('papers received by a date leaves out what came later', () => {
  const view = book(createDemoWorkspace(), '2026-09-30T23:59:59.999Z');
  assert.deepEqual(drawerPapers(view).map(item => item.address), ['nimbus-incident@8', 'pipeline-promise@6', 'nimbus-contract@5']);
  assert.deepEqual(drawerPapers(book(createDemoWorkspace(), '2026-08-01T23:59:59.999Z')), []);
});

test('an older copy is kept, says when it was replaced, and only shows when asked for', () => {
  const revised = reduceWorkspace(createDemoWorkspace(), { id: 'test-revise', type: 'REVISE_SOURCE', sourceId: 'pipeline-promise', text: 'Corrected copy.\nWe will credit USD 2,400 on your October 1, 2026 invoice.' }, { actor: { id: 'tester', role: 'admin' }, now: '2026-11-05T09:30:00.000Z' }).state;
  const view = book(revised);
  assert.equal(drawerPapers(view).filter(item => item.sourceId === 'pipeline-promise').length, 1);
  const copies = drawerPapers(view, { versions: 'all' }).filter(item => item.sourceId === 'pipeline-promise');
  assert.deepEqual(copies.map(item => [item.revision, item.current, item.replacedOn]), [[29, true, ''], [6, false, '2026-11-05']]);
  assert.deepEqual(paperCopies(view, 'pipeline-promise').map(copy => [copy.revision, copy.current, copy.replacedAt.slice(0, 10)]), [[29, true, ''], [6, false, '2026-11-05']]);
  assert.equal(filterCounts(drawerPapers(view, { versions: 'all' }))[0].count, view.sourceVersions.length + view.credits.length);
});

test('a paper is used in the promise it is behind and that promise’s decisions, and nobody else’s', () => {
  const view = book();
  const uses = paperUses(view, 'pipeline-promise', 6);
  assert.deepEqual(uses[0], { label: 'Pipeline CRM’s promise of $2,400', to: ['iou', 'pipeline-seats', null] });
  assert.ok(uses.length >= 2);
  assert.ok(uses.every(use => use.to[1] === 'pipeline-seats'));
  assert.ok(uses.some(use => use.to[2]?.a === 'action-pipeline-preserve'));
  const memo = paperUses(view, 'nimbus-memo', 18);
  assert.deepEqual(memo[0], { label: 'Credit note CM-NC-204 for $2,000', to: ['papers', 'credit:credit-nimbus-2000', null] });
  const offer = paperUses(view, 'pipeline-renewal', 23);
  assert.equal(new Set(offer.map(use => JSON.stringify(use.to))).size, offer.length);
  assert.deepEqual(paperUses(view, 'pipeline-promise', 999), []);
});

test('a credit note’s three figures add up to the note', () => {
  const view = book();
  for (const credit of view.credits) {
    const money = creditMoney(credit);
    assert.equal(money.matchedCents + money.takenBackCents + money.unmatchedCents, money.noteCents);
  }
  const nimbus = view.credits.find(credit => credit.id === 'credit-nimbus-2000');
  assert.deepEqual(creditMatches(nimbus), [{ commitmentId: 'nimbus-sla', amountCents: 200000 }]);
  assert.deepEqual(creditPapers(view, nimbus).map(source => source.id), ['nimbus-memo']);
  assert.equal(creditNoun(view, nimbus), 'Credit note');
});

test('the paper that took money back from a credit note is one of the papers behind it', () => {
  const actor = { id: 'tester', role: 'admin' }, now = '2026-11-08T10:00:00.000Z';
  let state = reduceWorkspace(createDemoWorkspace(), { id: 't-1', type: 'ADD_SOURCE', source: { id: 'pipeline-reversal', vendorId: 'pipeline', title: 'November invoice', kind: 'invoice', text: 'USD 300 of credit line CREDIT-PC-900 is reversed.' } }, { actor, now }).state;
  state = reduceWorkspace(state, { id: 't-2', type: 'REVERSE_CREDIT', creditId: 'credit-pipeline-900', amountCents: 30000, sourceIds: ['pipeline-reversal'], allocationReversals: [{ allocationId: 'allocation-pipeline', amountCents: 30000 }] }, { actor, now }).state;
  const view = book(state);
  const credit = view.credits.find(item => item.id === 'credit-pipeline-900');
  assert.deepEqual(creditMoney(credit), { noteCents: 90000, matchedCents: 60000, takenBackCents: 30000, unmatchedCents: 0 });
  assert.deepEqual(creditPapers(view, credit).map(source => source.id), ['pipeline-invoice', 'pipeline-reversal']);
  assert.deepEqual(creditMatches(credit), [{ commitmentId: 'pipeline-seats', amountCents: 60000 }]);
  const uses = paperUses(view, 'pipeline-reversal', view.sources.find(source => source.id === 'pipeline-reversal').revision);
  assert.deepEqual(uses[0], { label: 'Money taken back from invoice credit INV-PC-1026', to: ['papers', 'credit:credit-pipeline-900', null] });
});

test('small things: the turn, the opening lines, the sentence for nothing found', () => {
  assert.equal(paperTurn('pipeline-promise'), paperTurn('pipeline-promise'));
  for (const id of ['pipeline-promise', 'nimbus-memo', 'orbit-offer', 'credit:credit-nimbus-2000']) {
    const turn = Math.abs(paperTurn(id));
    assert.ok(turn >= 0.6 && turn <= 2.3, `${id} turns ${turn}`);
  }
  assert.notEqual(paperTurn('pipeline-promise'), paperTurn('pipeline-invoice'));
  assert.equal(openingLines('SYNTHETIC ASSURANCE EXAMPLE\nWe will credit you.'), 'We will credit you.');
  assert.equal(openingLines('Hi Alex,\nThanks.'), 'Hi Alex,\nThanks.');
  assert.equal(nothingFound({ group: 'invoices', company: 'Parcel' }), 'No invoices from Parcel on file yet.');
  assert.equal(nothingFound({ query: 'refund' }), 'No papers mention “refund”.');
  assert.equal(nothingFound({ group: 'letters', by: '2026-09-01' }), 'No letters had come in by Sep 1, 2026.');
});
