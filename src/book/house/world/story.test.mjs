// The quarter's replay, checked against the demo book.
//   node --test src/book/house/world/story.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorkspace, createWorkspace, evaluateWorkspace, reduceWorkspace } from '../../../assurance/index.mjs';
import { approveLetterCommands, nextInvoiceCommands } from '../../front/commands.mjs';
import { liveStep, stateOf, storyOf } from './story.mjs';

const now = '2026-11-10T20:00:00.000Z';
const actor = { id: 'story-test', role: 'admin' };
const send = (state, commands) => commands.reduce((next, command) => reduceWorkspace(next, { ...command, id: command.id || crypto.randomUUID() }, { actor, now }).state, state);
const read = (workspace) => evaluateWorkspace(workspace, { asOf: now.slice(0, 10), knownAt: now });

const workspace = createDemoWorkspace();
const view = read(workspace);
const { steps, empty } = storyOf(workspace, view);
const KNOWN = ['arrive', 'pass', 'file', 'slip', 'coins', 'hang', 'clip', 'draft', 'deliver', 'withdraw', 'ring', 'call', 'send'];
const AGENTS = ['postmaster', 'reader', 'scribe', 'checker', 'writer'];

test('the demo book replays in eleven steps, one per day it records, then today', () => {
  assert.equal(empty, false);
  assert.equal(steps.length, 11);
  assert.deepEqual(steps.map((s) => s.day), ['Sep 1', 'Sep 18', 'Sep 28', 'Oct 1', 'Oct 20', 'Oct 21', 'Oct 25', 'Oct 28', 'Oct 30', 'Nov 1', 'today']);
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(steps.every((s) => s.of === 11));
  assert.equal(steps.at(-1).today, true);
  assert.equal(steps.at(-1).date, view.asOf);
});

test('every sentence carries the book’s own names and numbers', () => {
  const said = steps.map((s) => s.sentence);
  assert.match(said[0], /^Nimbus Cloud’s agreement comes in\./);
  assert.match(said[1], /^Pipeline CRM’s email comes in: “We will credit USD 2,400 .*” The scribe writes down \$2,400, due Oct 1\.$/);
  assert.match(said[2], /nine-hour outage: 25% of the \$8,000 month is \$2,000\./);
  assert.match(said[2], /claims by Oct 30/);
  assert.match(said[3], /^Pipeline CRM’s October invoice takes off \$900\. They still owe \$1,500, due today\.$/);
  assert.match(said[4], /^Orbit Design offers \$480 if you renew, spending \$2,400 more\./);
  assert.match(said[5], /^Parcel’s email comes in: “We will waive the USD 350 setup fee .*\$350, due Nov 1\.$/);
  assert.match(said[6], /^Nimbus Cloud sends credit note CM-NC-204 for \$2,000\./);
  assert.match(said[7], /^Pipeline CRM offers to pay later, or the rest if you renew\./);
  assert.match(said[7], /two letters for you to sign: \$1,500 from Pipeline CRM, \$2,000 from Nimbus Cloud\./);
  assert.match(said[8], /^Nimbus Cloud’s window to claim the \$2,000 closes\./);
  assert.match(said[9], /^Parcel’s \$350 falls due, and no invoice shows it\. The clock rings\.$/);
  assert.equal(said[10], '$3,850 still owed. A letter waits for your signature.');
  for (const s of steps) {
    const words = [s.sentence, ...s.moves.flatMap((m) => [m.say, m.reply, m.line])].filter(Boolean).join(' ');
    assert.doesNotMatch(words, /undefined|NaN|null|\d{4}-\d{2}-\d{2}/, `${s.day}: ${words}`);
  }
});

test('the moves are ones the director knows, and the papers go the way the work goes', () => {
  for (const s of steps) for (const m of s.moves) {
    assert.ok(KNOWN.includes(m.do), `${s.day}: ${m.do}`);
    if (m.do === 'pass') assert.ok(AGENTS.includes(m.from) && AGENTS.includes(m.to), `${s.day}: ${m.from} → ${m.to}`);
  }
  const did = (i) => steps[i].moves.map((m) => (m.do === 'pass' ? `${m.from}>${m.to}` : m.do));
  assert.deepEqual(did(0), ['arrive', 'postmaster>reader', 'file']);
  assert.deepEqual(did(1), ['arrive', 'postmaster>reader', 'reader>scribe', 'slip']);
  assert.deepEqual(did(3), ['arrive', 'postmaster>reader', 'reader>checker', 'coins', 'ring']);
  assert.deepEqual(did(4), ['arrive', 'postmaster>reader', 'reader>scribe', 'hang']);
  assert.deepEqual(did(6), ['arrive', 'postmaster>reader', 'reader>checker', 'clip']);
  assert.deepEqual(did(7), ['arrive', 'postmaster>reader', 'reader>writer', 'draft', 'deliver']);
  assert.deepEqual(did(8), ['ring', 'withdraw']);
  assert.deepEqual(did(9), ['ring']);
  assert.deepEqual(did(10), ['call']);
  // the courier is the company's: Pipeline CRM is the first in the book, Nimbus Cloud the second
  assert.equal(steps[1].moves[0].vendor, 0);
  assert.equal(steps[2].moves[0].vendor, 1);
  assert.equal(steps[3].moves[0].carry, 'invoice');
  assert.equal(steps[3].moves.find((m) => m.do === 'coins').cents, 90000);
  assert.equal(steps[3].moves[2].reply, 'Nine coins.');
  assert.equal(steps[4].moves.find((m) => m.do === 'hang').vendor, 2);
  assert.equal(steps[6].moves.find((m) => m.do === 'clip').vendor, 1);
  assert.match(steps[3].moves.find((m) => m.do === 'ring').line, /Nimbus Cloud’s \$2,000 is due today\./);
});

test('each step ends with the quarter as the book stood then', () => {
  const s = (i) => steps[i].state;
  assert.deepEqual([s(0).slips, s(0).owedCents, s(0).inTray], [[], 0, 1]);
  assert.deepEqual([s(1).slips, s(1).promisedCents, s(1).owedCents], [[0], 240000, 240000]);
  assert.deepEqual([s(2).slips, s(2).owedCents], [[0, 1], 440000]);
  assert.deepEqual([s(3).creditedCents, s(3).owedCents], [90000, 350000]);
  assert.deepEqual(s(4).offers, [2]);
  assert.deepEqual([s(5).slips, s(5).owedCents], [[0, 1, 3], 385000]);
  assert.deepEqual(s(6).notes, [1]);
  assert.equal(s(7).waiting, 2);
  assert.equal(s(8).waiting, 1);
  assert.deepEqual(s(10), stateOf(view));
  assert.equal(s(10).owedCents, 385000);
  assert.equal(s(10).inTray, view.sources.length);
});

test('an empty book has nothing to replay and says so in one line', () => {
  const blank = createWorkspace({ id: 'blank' });
  const story = storyOf(blank, read(blank));
  assert.equal(story.empty, true);
  assert.deepEqual(story.steps, []);
  assert.equal(story.line, 'Nothing in the book yet.');
  assert.equal(storyOf(null, null).empty, true);
});

test('what happens after the replay plays live: an approved letter goes out, an invoice brings coins', () => {
  const approved = send(workspace, approveLetterCommands(workspace, 'pipeline-seats', { now }));
  const out = liveStep(approved, read(approved), workspace.events.length);
  assert.ok(out);
  assert.deepEqual(out.moves.map((m) => m.do), ['send']);
  assert.equal(out.moves[0].vendor, 0);
  assert.match(out.sentence, /You approved the letter to Pipeline CRM\./);
  assert.equal(out.state.waiting, 0);

  const built = nextInvoiceCommands(workspace, 'pipeline-seats', { actor, now, day: now.slice(0, 10) });
  const paid = send(workspace, built.commands);
  const arrived = liveStep(paid, read(paid), workspace.events.length);
  assert.deepEqual(arrived.moves.map((m) => (m.do === 'pass' ? `${m.from}>${m.to}` : m.do)), ['arrive', 'postmaster>reader', 'reader>checker', 'coins']);
  assert.equal(arrived.moves.find((m) => m.do === 'coins').cents, 150000);
  assert.equal(liveStep(workspace, view, workspace.events.length), null);
});
