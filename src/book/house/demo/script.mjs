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
const openRow = '.f-item.is-open';

export const SCENES = [
  {
    id: 'cover',
    title: 'the cover',
    seconds: 10,
    narration: 'Vendors promise you credits by email, and then their invoices forget them. Truthful keeps every promise until it is paid.',
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
    narration: 'Its agents read every paper that comes in, write each promise down, and weigh every invoice against it on the scale. An offer with strings hangs off to the side.',
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
    narration: 'This is the book of IOUs, one row per vendor. One coin is a hundred dollars: ink came in, red is still owed.',
    async run(d) {
      await d.go('ious');
      await d.point(await d.find('h1', { front: true }));
      await d.wait(2600);
      await d.point(await d.find('.f-list > .f-key', { front: true }));
      await d.wait(2800);
      await d.point(await d.find(`[data-item="${PIPELINE}"] .f-coins`, { front: true }));
    },
  },
  {
    id: 'pipeline',
    title: 'one promise',
    seconds: 11,
    narration: 'Pipeline CRM promised $2,400 in an email. One invoice took off $900, so $1,500 is still owed.',
    async run(d) {
      await d.go('ious');
      const row = await d.find(`[data-row="${PIPELINE}"]`, { front: true });
      if (row && row.getAttribute('aria-expanded') !== 'true') await d.click(row);
      await d.wait(700);
      await d.point(await d.find(`${openRow} .f-quote mark`, { front: true }));
      await d.wait(3000);
      await d.point(await d.find(`${openRow} .t-row.is-sum`, { front: true }), { box: (el) => el.closest('dd') });
    },
  },
  {
    id: 'offers',
    title: 'an offer with strings',
    seconds: 12,
    narration: 'Then they offered the rest, but only if we spend $2,400 more. The house rules say no new spending, so we decline it.',
    async run(d) {
      await d.go('ious');
      const offer = await d.find(`${openRow} .f-offer`, { front: true, text: 'Only if you renew' });
      await d.point(offer);
      await d.wait(3200);
      await d.click(offer && [...offer.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Decline'));
      const why = await d.find(`${openRow} .f-offer-why input`, { front: true, timeout: 1500 });
      await d.type(why, 'Our rules say no new spending.');
      await d.wait(300);
      await d.click(await d.find(`${openRow} .f-offer-why button`, { front: true, text: 'Decline it' }));
      await d.point(await d.find(`${openRow} .f-offer.is-dismissed, ${openRow} .f-decided`, { front: true, timeout: 2500 }), { box: (el) => el.closest('.f-offer') });
    },
  },
  {
    id: 'letter',
    title: 'the letter',
    seconds: 13,
    narration: 'Ask for the rest, and the letter writes itself from the evidence. Nothing is sent until you approve it.',
    async run(d) {
      await d.go('ious');
      await d.click(await d.find(`${openRow} .f-acts .f-btn:not(.is-quiet)`, { front: true }));
      await d.wait(700);
      const letter = await d.find(`#f-letter-${PIPELINE}`, { front: true });
      await d.point(letter?.querySelector('textarea'));
      await d.wait(3600);
      await d.click(await d.find(`#f-letter-${PIPELINE} .f-letter-foot .f-btn`, { front: true, text: 'Approve this letter' }));
      await d.point(await d.find(`#f-letter-${PIPELINE} .f-approved`, { front: true, timeout: 3000 }));
    },
  },
  {
    id: 'invoice',
    title: 'the next invoice',
    seconds: 11,
    narration: 'When the next invoice shows the credit, the coins turn over, Pipeline is paid, and the total counts down.',
    async run(d) {
      await d.go('ious');
      const button = await d.find(`[data-item="${PIPELINE}"] .f-acts .f-btn`, { front: true, text: 'The next invoice arrives' });
      await d.scrollTo(0);
      await d.click(button);
      await d.point(await d.find(`[data-item="${PIPELINE}"] .f-big`, { front: true, timeout: 800 }));
      await d.wait(3400);
      await d.scrollTo(0);
      await d.point(await d.find('h1', { front: true }));
      await d.wait(2400);
      await d.point(await d.find(`[data-item="${PIPELINE}"]`, { front: true }));
    },
  },
  {
    id: 'tray',
    title: 'the in-tray',
    seconds: 13,
    narration: 'Drop a paper in the tray. Truthful reads it, highlights every figure it used, and sees this promise is already in the book.',
    async run(d) {
      await d.go('tray');
      await d.click(await d.find('.bk-tray-tries button', { text: 'Pipeline CRM, half paid' }));
      await d.until(() => [...document.querySelectorAll('.bk-tray-box textarea')].some((t) => t.value.trim()), 3000);
      await d.point(await d.find('.bk-tray-box'));
      await d.wait(1800);
      await d.click(await d.find('.bk-tray-go button'));
      await d.find('.bk-tray-read', { timeout: 4000 });
      await d.wait(500);
      await d.point(await d.find('.bk-tray-row'));
      await d.wait(3200);
      await d.point(await d.find('.bk-tray-found'));
    },
  },
  {
    id: 'paper',
    title: 'a paper on file',
    seconds: 9,
    narration: 'Every figure in the book points back to the exact words it came from.',
    async run(d) {
      await d.go('papers', d.paperOf(PIPELINE));
      await d.wait(400);
      await d.click(await d.find('.bk-pap-side button.bk-pap-fact'));
      await d.point(await d.find('.bk-pap-text mark.is-lit', { timeout: 1200 }) ?? await d.find('.bk-pap-text mark'));
      await d.wait(2800);
      await d.point(await d.find('.bk-pap-uses'));
    },
  },
  {
    id: 'balance',
    title: 'the balance',
    seconds: 12,
    narration: 'The balance adds it all up as of any date. Turn the date back to see what you knew then, and hand the accountant a CSV.',
    async run(d) {
      await d.go('balance');
      await d.point(await d.find('.bk-rec-sums'));
      await d.wait(2800);
      const date = await d.find('.bk-rec-daters .bk-rec-turn');
      await d.point(date);
      await d.wait(900);
      await d.go('balance', '', { asof: '2026-10-02', by: '2026-10-02' }, { replace: true });
      await d.wait(400);
      await d.point(await d.find('.bk-rec-sums'));
      await d.wait(3000);
      await d.point(await d.find('.bk-rec-take button', { text: 'Copy for the accountant (CSV)' }));
    },
  },
  {
    id: 'history',
    title: 'history',
    seconds: 9,
    narration: 'History keeps every entry in order, including what we just did. Nothing is ever rewritten.',
    async run(d) {
      await d.go('daybook');
      await d.point(await d.find('.bk-rec-count'));
      await d.wait(1600);
      const rows = await d.findAll('.bk-rec-day');
      await d.point(rows[0], { box: () => rows.slice(0, 4) });
      await d.wait(3200);
      await d.point(rows[6] ?? rows.at(-1), { box: () => rows.slice(4, 10) });
    },
  },
  {
    id: 'bench',
    title: 'the test bench',
    seconds: 13,
    narration: 'On the test bench, two clerks race to spend the same credit. The ledger lets one through and refuses the other.',
    async run(d) {
      await d.go('bench', '', { tool: 'clerks' });
      const go = await d.find('.bk-bench-go button');
      await d.point(await d.find('.bk-bench-setup') ?? go);
      await d.wait(2200);
      await d.click(go);
      await d.wait(1000);
      const rows = await d.findAll('.bk-bench-ledger [data-step]', { timeout: 4000 });
      await d.point(rows.at(-1));
      await d.wait(2800);
      const verdicts = await d.findAll('.bk-bench-verdict');
      await d.point(verdicts.at(-1));
    },
  },
  {
    id: 'close',
    title: 'truthful',
    seconds: 8,
    narration: 'Truthful. Every credit you were promised, kept or chased.',
    async run(d) {
      await d.go('home');
      await d.wait(300);
      await d.tour(d.lastTourStep());
      await d.point(await d.find('.qw-head'));
    },
  },
];

export const TOTAL_SECONDS = SCENES.reduce((sum, scene) => sum + secondsFor(scene), 0);
