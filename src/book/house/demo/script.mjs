// The demo: a 2½-minute walk through every part of Truthful, made to be recorded.
//
// SCENES is the whole film, in play order. Each scene has:
//   id         a short name
//   title      what the scene counter shows
//   seconds    how long the scene holds, at least (it never runs shorter than its narration needs)
//   narration  the caption on screen, and the line a narrator reads over it
//   run(d)     what happens: real pages, real buttons, real commands (d is the player's hand, see Player.jsx)
//
// Every figure the narration says is the demo book's own, as it stands after a reset
// (the player starts the book again first, so every take is the same).
// This file imports nothing, so `node -e "import('./script.mjs')"` reads the narration for a voice-over.

/** A narrator reads about 2.6 words a second; a scene lasts at least that, plus a breath. */
export const WORDS_PER_SECOND = 2.6;
export const BREATH = 0.8;
export const wordsIn = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
export const secondsFor = (scene) => Math.max(scene.seconds, wordsIn(scene.narration) / WORDS_PER_SECOND + BREATH);

const PIPELINE = 'pipeline-seats';

// Scenes 2 on stay in the quarter: World.jsx sets window.__quarter while it is mounted
// (focus a place, open its panel, a bubble, a few moves, and the book's own commands).
const Q = () => (typeof window !== 'undefined' ? window.__quarter : null);
async function inQuarter(d) {
  if (document.querySelector('.bk')?.dataset.page !== 'home') await d.go('home');
  await d.until(() => Q(), 4000);
  return Q() ?? { focus() {}, open() {}, close() {}, say() {}, play: async () => false, busy: () => false, vendorIndex: () => 0, decline: async () => false, nextInvoice: async () => null, read: async () => null };
}
/** Wait for the quarter to finish acting out what was just written in the book. */
const settle = (d, ms = 12000) => d.until(() => !Q()?.busy(), ms);

export const SCENES = [
  {
    id: 'cover',
    title: 'the cover',
    seconds: 10,
    narration: 'Vendors promise you credits by email, and their invoices forget them. Truthful keeps every promise until it is paid.',
    async run(d) {
      await d.go('home');
      await d.point(await d.find('.qw-head'));
      await d.wait(4200);
      await d.point(await d.find('.qw-tag', { text: 'Pipeline CRM' }));
    },
  },
  {
    id: 'agents',
    title: 'the quarter',
    seconds: 24,
    narration: 'Watch its agents work. Pipeline CRM\'s email arrives at the post, the reader finds the $2,400, and the scribe writes it down. The October invoice takes off $900 on the scale. Orbit\'s offer comes with strings, so it hangs off to the side. And a letter now waits on your desk.',
    async run(d) {
      await d.go('home');
      // Pipeline's email comes in and is written down (stepping back and on takes the replay off its own clock)
      await d.tour(1);
      await d.tour(2);
      await d.point(await d.find('.qw-tour'));
      await d.wait(4400);
      await d.point(await d.find('.qw-tag', { text: 'the reading desk' }));
      await d.wait(1400);
      // its October invoice takes off $900 on the scale
      await d.tour(4);
      await d.point(d.above('the scale'));
      await d.wait(5200);
      // Orbit's offer hangs off the stand, not on a pan
      await d.tour(5);
      await d.wait(5000);
      // a letter waits on your desk
      await d.tour(d.lastTourStep());
      await d.point(d.above('your desk'));
    },
  },
  {
    id: 'book',
    title: 'the book of IOUs',
    seconds: 11,
    narration: 'The book holds every promise, one row per vendor. One coin is a hundred dollars: ink came in, red is still owed.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('book', { zoom: 1.3 });
      await d.point(await d.find('.qw-tag', { text: 'the book' }));
      await d.wait(1100);
      q.open('book');
      await d.wait(900);
      await d.point(await d.find('.qw-panel .qp-legend'));
      await d.wait(3000);
      await d.point(await d.find('.qw-panel .qp-promise', { text: 'Pipeline' }));
    },
  },
  {
    id: 'pipeline',
    title: 'one promise',
    seconds: 11,
    narration: 'Pipeline CRM promised $2,400 in an email. One invoice took off $900, so $1,500 is still owed, and it is late.',
    async run(d) {
      const q = await inQuarter(d);
      const house = `vendor:${q.vendorIndex('Pipeline CRM')}`;
      // Pipeline's house and the post across the bridge, where its papers come in
      q.focus('post', { zoom: 1.25 });
      q.open(house);
      await d.wait(1000);
      await d.point(await d.find('.qw-tag.is-house', { text: 'Pipeline CRM' }));
      await d.wait(1800);
      await d.point(await d.find('.qw-panel .qp-promise'));
      await d.wait(2600);
      await d.point(await d.find('.qw-panel .qp-promise .qp-fig'));
    },
  },
  {
    id: 'offers',
    title: 'an offer with strings',
    seconds: 12,
    narration: 'Then Pipeline offered the rest, but only if we spend $2,400 more. Our house rules say no new spending, so the offer is declined.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('letter', { zoom: 1.25 });
      await d.wait(900);
      q.say('checker', 'Only if we spend $2,400 more?', 3, 'left');
      await d.point(d.above('the scale'));
      await d.wait(2600);
      q.say('writer', 'Our rules say no new spending.', 3.4, 'left');
      await d.point(d.above('the letter desk'));
      await d.wait(2200);
      await q.decline(PIPELINE, 'Our rules say no new spending.');
      await settle(d, 6000);
      await q.play([{ do: 'drop', vendor: q.vendorIndex('Pipeline CRM'), say: 'Declined.' }]);
      await d.point(await d.find('.qw-panel .qp-promise'));
    },
  },
  {
    id: 'letter',
    title: 'the letter',
    seconds: 13,
    narration: 'The writer drafts a letter asking for the $1,500, straight from the evidence. Nothing goes out until you approve it. Once approved, the courier takes it to Pipeline.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('you', { zoom: 1.3 });
      q.say('writer', 'I’ll ask Pipeline for the $1,500.', 2.6, 'right');
      await d.wait(1200);
      // the writer walks the letter over to your desk
      const walk = q.play([{ do: 'deliver', say: 'For you to sign.' }]);
      await d.point(d.above('your desk'));
      await walk;
      q.open('you', { want: PIPELINE });
      await d.wait(900);
      await d.point(await d.find('.qw-panel .qp-letter'));
      await d.wait(3000);
      await d.click(await d.find('.qw-panel .qp-act .bk-btn', { text: 'Approve this letter' }));
      await d.wait(500);
      // Truthful's courier takes it over the bridge to Pipeline's house
      q.focus('post', { zoom: 1.1 });
      await d.point(await d.find('.qw-panel .qp-approved', { timeout: 3000 }));
      await settle(d, 7000);
    },
  },
  {
    id: 'invoice',
    title: 'the next invoice',
    seconds: 13,
    narration: 'Pipeline\'s next invoice arrives with the $1,500 credit. The checker weighs it, the coins turn over, Pipeline is paid in full, and the total drops to $2,350.',
    async run(d) {
      const q = await inQuarter(d);
      q.close();
      q.focus(null);
      await d.wait(900);
      await q.nextInvoice(PIPELINE);
      await d.point(await d.find('.qw-tag.is-house', { text: 'Pipeline CRM' }));
      await d.wait(2400);
      await d.point(d.above('the scale'));
      await settle(d, 14000);
      q.focus('scale', { zoom: 1.2 });
      await d.point(await d.find('.qw-head'));
    },
  },
  {
    id: 'tray',
    title: 'the in-tray',
    seconds: 13,
    narration: 'Any email or invoice dropped in comes through the post. Truthful reads it, marks every figure, and knows this promise is already in the book, so nothing counts twice.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('post', { zoom: 1.35 });
      const text = await fetch('/examples/pipeline-promise.txt').then((r) => (r.ok ? r.text() : '')).catch(() => '');
      const vendor = q.vendorIndex('Pipeline CRM');
      await d.point(await d.find('.qw-tag', { text: 'the post' }));
      await q.play([{ do: 'arrive', vendor, carry: 'paper', papers: 0, say: 'Pipeline’s email again.', reply: 'Into the tray.' }]);
      const outcome = text ? await q.read(text) : null;
      q.open('post');
      const play = q.play([{ do: 'pass', from: 'postmaster', to: 'reader', carry: 'paper', say: 'From Pipeline CRM.', reply: outcome?.kind === 'known' ? 'Already in the book.' : 'Read it.' }]);
      await d.wait(700);
      await d.point(await d.find('.qw-panel .qp-row'));
      await play;
    },
  },
  {
    id: 'paper',
    title: 'a paper on file',
    seconds: 9,
    narration: 'Every figure points back to the exact words it came from, highlighted in the paper itself.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('read', { zoom: 1.35 });
      q.open('read');
      await d.wait(1000);
      await d.point(await d.find('.qw-panel .qp-paper-text mark.qp-hl') ?? await d.find('.qw-panel .qp-paper'));
      await d.wait(2800);
      await d.point(await d.find('.qw-panel .qp-part', { text: 'what was read' }));
    },
  },
  {
    id: 'balance',
    title: 'the balance',
    seconds: 12,
    narration: 'The scale adds it all up: $4,750 promised, $2,400 credited, $2,350 still owed. A credit note and an offer with strings stay off it until they are real money.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('scale', { zoom: 1.4 });
      q.open('scale');
      await d.wait(1000);
      await d.point(await d.find('.qw-panel .qp-sum'));
      await d.wait(3200);
      await d.point(d.above('the scale'));
      await d.wait(2600);
      await d.point(await d.find('.qw-panel .qp-foot'));
    },
  },
  {
    id: 'history',
    title: 'history',
    seconds: 9,
    narration: 'The clock watches every deadline: Parcel is nine days late. And every entry is kept, in order, never rewritten.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('clock', { zoom: 1.3 });
      q.open('clock');
      await d.wait(900);
      q.say('clock', 'Every entry kept, in order.', 3.6);
      await d.point(await d.find('.qw-tour'));
      await d.wait(3000);
      await d.point(await d.find('.qw-panel .qp-head'));
    },
  },
  {
    // Staged in the quarter: the real race runs on #/bench, against the ledger itself.
    id: 'bench',
    title: 'the test bench',
    seconds: 13,
    narration: 'And the ledger cannot be fooled. Two clerks race to spend the same credit: one gets through, the other is refused. The same check runs on every write.',
    async run(d) {
      const q = await inQuarter(d);
      q.focus('scale', { zoom: 1.4 });
      q.open('scale');
      await settle(d, 3000);
      await d.wait(700);
      const race = q.play([{ do: 'race', ask: 'Spending this $100.', also: 'So am I.', got: 'Mine. Through.', reply: 'Already spent.' }]);
      await d.point(d.above('the scale'));
      await race;
    },
  },
  {
    id: 'close',
    title: 'truthful',
    seconds: 8,
    narration: 'Truthful. Every credit you were promised, kept or chased.',
    async run(d) {
      const q = await inQuarter(d);
      q.close();
      q.focus(null);
      await d.wait(900);
      await d.point(await d.find('.qw-head'));
    },
  },
];

export const TOTAL_SECONDS = SCENES.reduce((sum, scene) => sum + secondsFor(scene), 0);
