import {createDemoWorkspace,evaluateWorkspace} from '../src/assurance/index.mjs';
const seedSourceVersions=evaluateWorkspace(createDemoWorkspace(),{asOf:'2026-11-07'}).sourceVersions;
// Editable scene bodies for the finance workspace expansion. The caller owns
// viewport chrome and navigation; every financial example below is synthetic.
export function renderExpansionScene(s, w, mobile, H) {
  const { frame, row, text, rule, note, panel, button, status, field, facts, amount } = H;
  const family = s.scene?.family || s.family;
  const stage = s.scene?.stage || s.stage;
  const gap = mobile ? 14 : 20;
  const pad = mobile ? 16 : 20;
  const ink = (name, value, width = w, size = 13, weight = 'regular') => text(name, value, width, size, 'ink', weight);
  const muted = (name, value, width = w) => text(name, value, width, 12, 'assurance-muted');
  const title = (name, value, width = w, size = 18) => ink(name, value, width, size, 'semibold');
  const stack = (name, width, children, props = {}) => frame(name, width, null, children, { gap: 12, ...props });
  const sheet = (name, width, children, props = {}) => panel(name, width, null, children, { p: pad, gap: 14, ...props });
  const inner = width => width - pad * 2;
  const safeFacts = (name, entries, width) => stack(name, width, entries.flatMap(([label, value], i) => [
    ...(i ? [rule(width)] : []),
    mobile ? stack('Financial fact: ' + label, width, [muted('Fact label', label, width), ink('Fact value', value, width, 14, 'semibold')], { gap: 4 })
      : row('Financial fact: ' + label, width, [muted('Fact label', label, width * .52), ink('Fact value', value, width * .44, 14, 'semibold')], { gap: width * .04, justify: 'between' }),
  ]), { gap: 10 });
  const pair = (name, left, right, leftRatio = .56) => {
    const leftW = mobile ? w : Math.floor((w - gap) * leftRatio);
    const rightW = mobile ? w : w - gap - leftW;
    return frame(name, w, null, [left(leftW), right(rightW)], { flex: mobile ? 'col' : 'row', gap, items: 'start' });
  };
  const fields = (name, entries, width, columns = 2) => {
    if (mobile || columns === 1) return stack(name, width, entries.map(([label, value]) => field(label, value, width)));
    const cw = (width - 14) / 2;
    const lines = [];
    for (let i = 0; i < entries.length; i += 2) lines.push(row(name + ' row ' + i, width, entries.slice(i, i + 2).map(([label, value]) => field(label, value, cw)), { gap: 14, items: 'start' }));
    return stack(name, width, lines);
  };
  const source = (name, width, heading, handle, quote, extra = '') => { const version=Number(handle.match(/(?:revision |@)(\d+)/)?.[1]),bound=seedSourceVersions.find(source=>handle.startsWith(source.id)&&source.revision===version);return sheet(name, width, [
    title('Source sheet heading', heading, inner(width), 16),
    muted('Exact source handle', bound?`${bound.id}@${bound.revision} · Recorded synthetic fixture`:`${handle} · Authored example`, inner(width)),
    rule(inner(width)),
    ink('Exact supplied source quote', bound?bound.text:'SYNTHETIC RECONSTRUCTION\n' + quote, inner(width), 13),
    ...(extra ? [muted('Source interpretation boundary', extra, inner(width))] : []),
    muted('Source authenticity boundary', 'Recorded text is evidence supplied by an operator. Its authenticity is not independently established.', inner(width)),
  ]); };

  const comparison = (name, width, entries) => stack(name, width, entries.flatMap(([label, before, after], index) => [
    ...(index ? [rule(width)] : []),
    muted('Changed financial label', label, width),
    row('Before and after: ' + label, width, [ink('Before value', before, (width - 30) / 2, 18), ink('Direction', '→', 20, 16), ink('After value', after, (width - 30) / 2, 18, 'semibold')], { gap: 5 }),
  ]));
  const identity = (width, label = 'Northstar Research · NR-CREDIT-2026') => stack('Selected financial identity', width, [
    ink('Selected vendor and reference', label, width, 15, 'semibold'),
    muted('Selected identity rule', 'Vendor, USD, and exact commitment reference remain fixed.', width),
  ], { gap: 5 });
  const notice = (name, message, width = w, tone = 'neutral') => note(name, message, width, tone);

  const vendors = [
    ['Pipeline CRM', 'PC-SEATS-2026', '$1,500.00', 'Partly applied'],
    ['Nimbus Cloud', 'NC-SLA-2026', '$2,000.00', 'Claim window expired'],
    ['Orbit Design', 'OD-RENEWAL-2026', '$480.00', 'Conditional offer'],
    ['Parcel', 'PL-SETUP-2026', '$350.00', 'Open; due Nov 1'],
  ];
  const vendorRows = width => vendors.flatMap(([name, reference, value, state], index) => [
    ...(index ? [rule(width)] : []),
    mobile ? stack('Vendor directory row: ' + name, width, [
      row('Vendor and balance', width, [ink('Vendor name', name, width * .52, 14, 'semibold'), ink('Outstanding value', value, width * .44, 14, 'semibold')], { gap: width * .04 }),
      muted('Exact commitment reference', reference, width), muted('Vendor financial state', state, width),
    ], { gap: 5 }) : row('Vendor directory row: ' + name, width, [
      stack('Vendor record identity', width * .38, [ink('Vendor name', name, width * .38, 14, 'semibold'), muted('Exact commitment reference', reference, width * .38)], { gap: 5 }),
      ink('Outstanding value', value, width * .22, 15, 'semibold'), muted('Vendor financial state', state, width * .36),
    ], { gap: width * .02, justify: 'between' }),
  ]);

  function operations() {
    if (stage === 'deadline-review') return pair('Nimbus current deadline and exact original terms', lw => sheet('Expired Nimbus claim review', lw, [
      identity(inner(lw), 'Nimbus Cloud · NC-SLA-2026'), title('Nimbus original action task', 'Prepare original claim', inner(lw)), status('Current deadline check fails', Math.min(240, inner(lw)), 'negative'),
      amount('Original credit still outstanding', '$2,000.00', inner(lw), 32),
      safeFacts('Nimbus current action basis', [['Financial effective date', 'Nov 7, 2026'], ['Original claim deadline', 'Oct 30, 2026'], ['Issued memo', '$2,000.00; not applied'], ['Verified applied', '$0.00']], inner(lw)),
      notice('Deadline approval boundary', 'Current approval cannot authorize this expired claim. Inspect source-backed current terms; neither a role change nor a recorded memo extends the deadline.', inner(lw), 'negative'),
    ]), rw => source('Nimbus original deadline evidence', rw, 'Nimbus service agreement', 'nimbus-contract · bound revision 5', 'Reference NC-SLA-2026. Covered monthly service costs USD 8,000. Availability below 99% earns a 25% service credit. Claims are due October 30, 2026.', 'The covered outage supports the recorded $2,000 amount. Original claim eligibility and later invoice application remain separate checks.'));
    const blocked = stage === 'blocked';
    const tasks = [
      ['Nimbus Cloud', 'Review expired claim window', '$2,000.00', 'Deadline Oct 30. Issued memo is not invoice application.'],
      ['Pipeline CRM', 'Resolve competing terms', '$1,500.00', 'Two incompatible proposals. Original agreement remains active.'],
      ['Orbit Design', 'Inspect a blocked action', '$480.00', 'Conditional renewal exceeds the current mandate.'],
      ['Parcel', 'Follow up the outstanding promise', '$350.00', 'Expected Nov 1. No applied invoice evidence is recorded.'],
    ];
    return stack('Prioritized operations work surface', w, [
      fields('Queue filters', [['Search work', blocked ? 'Nimbus Cloud' : 'All recorded commitments'], ['Category', blocked ? 'Urgent · expired window' : 'All categories']], w),
      ...(blocked ? [notice('Blocked operation reason', 'Demo role: viewer. Requires approver or admin to approve; an expired claim remains blocked even after a role change.', w, 'amber')] : []),
      ...(blocked ? [pair('Blocked claim and required evidence', lw => sheet('Blocked Nimbus work item', lw, [
        title('Blocked task name', 'Review expired claim window', inner(lw)), identity(inner(lw), 'Nimbus Cloud · NC-SLA-2026'),
        amount('Recorded outstanding credit', '$2,000.00', inner(lw), 30), status('Current action blocked', Math.min(210, inner(lw)), 'negative'),
        safeFacts('Nimbus action checks', [['Financial date', 'Nov 7, 2026'], ['Claim deadline', 'Oct 30, 2026'], ['Invoice application', 'Not recorded']], inner(lw)),
      ]), rw => source('Nimbus evidence needed', rw, 'Why the queue cannot authorize a claim', 'nimbus-contract · original recorded terms', 'Claims are due October 30, 2026. A credit memo must reduce a subsequent invoice before it is applied savings.', 'Inspect actual late-claim authority or application evidence. A role switch does not extend the agreement.'))] : [
        sheet('Prioritized finance tasks', w, [
          row('Queue heading', inner(w), [title('Queue title', 'Needs a finance decision', inner(w) * .7), muted('Queue count', '4 commitments', inner(w) * .28)], { gap: inner(w) * .02 }),
          ...tasks.flatMap(([vendor, task, value, reason], index) => [
            ...(index ? [rule(inner(w))] : []),
            stack('Work item: ' + vendor, inner(w), [
              row('Task vendor and value', inner(w), [ink('Task vendor', vendor, inner(w) * .56, 14, 'semibold'), ink('Task value', value, inner(w) * .4, 15, 'semibold')], { gap: inner(w) * .04 }),
              ink('Prioritized next action', task, inner(w), 14), muted('Task reason', reason, inner(w)),
            ], { gap: 6 }),
          ]),
        ]),
        muted('Queue scope', 'One prioritized item per commitment. Secondary issues remain visible within its review. Values are recorded balances, not approved recoveries.', w),
      ]),
    ]);
  }

  function vendorScene() {
    if (stage === 'directory') return stack('Vendor directory surface', w, [
      field('Search vendors or references', 'All vendors', w),
      sheet('Vendor financial directory', w, [title('Vendor directory heading', 'Four vendors. One conserved ledger.', inner(w)), ...vendorRows(inner(w))]),
      notice('Vendor aggregation rule', 'Each physical credit is counted once. Issued, applied, conditional and recoverable value remain separate.'),
    ]);
    if (stage === 'credits') return pair('Vendor credit inventory and original promise', lw => sheet('Pipeline vendor ledger', lw, [
      identity(inner(lw), 'Pipeline CRM · vendor ledger'), title('Credit inventory title', 'Applied invoice credits', inner(lw)),
      status('Applied to invoice', Math.min(180, inner(lw))),
      safeFacts('Physical credit identity and conservation', [['Invoice', 'INV-PC-1026'], ['Credit line', 'credit-pipeline-900'], ['Remaining ledger value', '$900.00'], ['Attributed', '$900.00'], ['Available to attribute', '$0.00']], inner(lw)),
      muted('Vendor line count', 'One physical line. Counting it in another commitment would not create another $900.', inner(lw)),
    ]), rw => source('Pipeline invoice sheet', rw, 'October invoice: partial correction', 'pipeline-invoice · bound revision 10', 'Invoice INV-PC-1026, credit line CREDIT-PC-900: USD 900 applied for duplicate-seat correction PC-SEATS-2026. Gross USD 6,000 less USD 900 = USD 5,100 due.', 'The $1,500 remaining promise is not another ledger credit.'));
    return pair('Vendor account and commitments', lw => sheet('Pipeline vendor profile', lw, [
      title('Vendor title', 'Pipeline CRM', inner(lw), 23), muted('Vendor directory identity', 'Vendor ID: pipeline · synthetic supplier', inner(lw)),
      amount('Unconditional outstanding', '$1,500.00', inner(lw), 32),
      safeFacts('Pipeline aggregate accounting', [['Original promise', '$2,400.00'], ['Verified applied', '$900.00'], ['Issued, not applied', '$0.00'], ['Remaining ledger value', '$900.00']], inner(lw)),
      rule(inner(lw)), title('Pipeline commitment heading', 'PC-SEATS-2026', inner(lw), 16),
      muted('Pipeline review requirement', 'Two proposed amendments require review. Neither changes the original promise until accepted.', inner(lw)),
    ]), rw => sheet('Vendor evidence and work', rw, [
      title('Vendor evidence heading', 'Evidence and outstanding work', inner(rw)),
      ink('Original evidence record', 'Original duplicate-seat correction', inner(rw), 14, 'semibold'), muted('Original evidence handle', 'pipeline-promise · revision 6', inner(rw)), rule(inner(rw)),
      ink('Applied evidence record', 'October invoice: partial correction', inner(rw), 14, 'semibold'), muted('Applied evidence handle', 'pipeline-invoice · revision 10', inner(rw)), rule(inner(rw)),
      ink('Vendor next action', 'Resolve competing terms', inner(rw), 15, 'semibold'),
      muted('Vendor follow-up economics', 'A $1,500 renewal-linked credit comes with $2,400 incremental spend under the stated baseline: $900 worse.', inner(rw)),
      notice('Original terms remain', 'Review an original-terms action separately. A vendor profile does not grant authority.', inner(rw), 'amber'),
    ]));
  }

  function libraryScene() {
    if (stage === 'credit-source') return pair('Northstar exact invoice source and existing credit use', lw => source('Northstar application source revision', lw, 'Supplied invoice application', 'NR-INVOICE-11 · invoice · bound recorded revision', 'Invoice NR-INVOICE-11 applies USD 300 for NR-CREDIT-2026. This application uses the existing NR-MEMO-300 credit; it is not a second credit.', 'Selected source belongs to Northstar. No Pipeline record is substituted during this inspection.'), rw => sheet('Northstar application source usages', rw, [
      identity(inner(rw)), title('Northstar source usage heading', 'Application of one existing credit', inner(rw)),
      safeFacts('Invoice source financial context', [['Credit memo identity', 'NR-MEMO-300 / NR-LINE-1'], ['Credit applied on invoice', '$300.00'], ['Currently attributed', '$100.00'], ['Verified for this commitment', '$100.00'], ['Outstanding promise', '$250.00']], inner(rw)),
      notice('Invoice versus attribution', 'The invoice supports application of $300. Only $100 is currently attributed to this commitment. The other $200 is available to attribute explicitly.', inner(rw)),
    ]));
    if (stage === 'resolution-source') return pair('Exact ambiguity clarification and candidate identity', lw => source('Bound credit clarification revision', lw, 'Vendor assignment clarification', 'allocation_resolution · revision 41 · exact selected source', 'Allow up to USD 100 for primary commitment and USD 200 for supplemental commitment under NR-CREDIT-2026.', 'Separate synthetic ambiguity example. This source is available to the approver; it does not itself release quarantine.'), rw => sheet('Resolution source interpretation', rw, [
      identity(inner(rw)), status('Resolution awaiting approval', Math.min(245, inner(rw)), 'amber'),
      safeFacts('Explicitly supplied assignment bounds', [['Physical credit available', '$300.00'], ['Primary maximum', '$100.00'], ['Supplemental maximum', '$200.00'], ['Existing primary attribution', '$100.00']], inner(rw)),
      notice('No inferred ownership', 'Both candidates share exact vendor, USD and reference identity. An approver must bind this recorded revision to the explicit limits; no amount or owner is guessed.', inner(rw)),
      muted('Retained revision principle', 'A later edit remains a separate revision. It cannot rewrite the source inspected for this approval.', inner(rw)),
    ]));
    if (stage === 'revision') return pair('Exact source revision and recorded usages', lw => source('Selected promise revision', lw, 'Original duplicate-seat correction', 'pipeline-promise · revision 6 · original source', 'We will credit USD 2,400 on your October 1, 2026 invoice for duplicate seats. Reference PC-SEATS-2026. This correction does not require a renewal.', 'This is the exact recorded revision. A later edit cannot replace the passage bound to earlier terms or approvals.'), rw => sheet('Exact revision usages', rw, [
      title('Usage heading', 'Where revision 6 is used', inner(rw)),
      safeFacts('Source revision metadata', [['Vendor', 'Pipeline CRM'], ['Kind', 'Email'], ['Observed', 'Sep 18, 2026'], ['Revision identity', 'pipeline-promise@6']], inner(rw)),
      rule(inner(rw)), ink('Terms usage', 'Recorded terms · PC-SEATS-2026', inner(rw), 14, 'semibold'),
      muted('Terms source binding', 'The original commitment retains this exact revision.', inner(rw)),
      ink('Approval basis usage', 'Proposal basis · preserve original', inner(rw), 14, 'semibold'),
      muted('Cross-case authority basis', 'Actions may bind sources outside their selected case. Inspect the exact current basis before approval.', inner(rw)),
      notice('Source truth boundary', 'A revision proves which text was recorded, not that the vendor authored it.', inner(rw)),
    ]));
    const records = [
      ['Renewal counteroffer', 'Pipeline CRM · proposed terms', 'pipeline-renewal@23'],
      ['Unaccepted date amendment', 'Pipeline CRM · email', 'pipeline-proposal@21'],
      ['Nimbus credit memo issued', 'Nimbus Cloud · credit memo', 'nimbus-memo@18'],
      ['November setup-fee waiver', 'Parcel · email', 'parcel-promise@16'],
      ['Original duplicate-seat correction', 'Pipeline CRM · email', 'pipeline-promise@6'],
    ];
    return stack('Searchable evidence library', w, [
      fields('Evidence library filters', [['Search evidence', 'Vendor, source ID or exact text'], ['Versions', 'Current recorded revisions']], w),
      sheet('Current evidence register', w, [title('Evidence register title', 'Recorded sources', inner(w)), muted('Evidence register count', '9 current source records · selected examples below', inner(w)),
        ...records.flatMap(([name, kind, handle], index) => [...(index ? [rule(inner(w))] : []), stack('Evidence library row: ' + handle, inner(w), [
          ink('Document title', name, inner(w), 14, 'semibold'), muted('Vendor and kind', kind, inner(w)), muted('Exact revision handle', handle, inner(w)),
        ], { gap: 5 })]),
      ]),
      muted('Evidence library version principle', 'Switch to all versions to inspect retained prior text. New revisions do not inherit old revision usages.', w),
    ]);
  }

  function auditScene() {
    if (stage === 'event') return pair('Audited event and exact payload', lw => sheet('Selected local audit event', lw, [
      title('Selected audit operation', 'Credit allocated', inner(lw), 22), muted('Event identity', 'event-12 · command seed-12', inner(lw)),
      safeFacts('Event timing and actor', [['Effective', 'Oct 1, 2026'], ['Observed', 'Oct 1, 2026 · 12:00 UTC'], ['Actor', 'seed-curator'], ['Role', 'Admin']], inner(lw)),
      rule(inner(lw)), amount('Attributed credit', '$900.00', inner(lw), 30),
      muted('Event local effect', 'A single credit was attributed to Pipeline. The event did not issue another credit or send a vendor message.', inner(lw)),
    ]), rw => sheet('Typed allocation event payload', rw, [
      title('Payload heading', 'Recorded allocation', inner(rw)),
      safeFacts('Allocation payload fields', [['Credit ID', 'credit-pipeline-900'], ['Commitment ID', 'pipeline-seats'], ['Allocation ID', 'allocation-pipeline'], ['Amount, integer cents', '90000']], inner(rw)),
      notice('Audit event lineage', 'INV-PC-1026 → credit-pipeline-900 → allocation-pipeline → PC-SEATS-2026', inner(rw)),
      muted('Audit attribution source boundary', 'This seeded allocation uses its credit’s recorded invoice source. New source-backed attributions also retain their own exact supporting revisions.', inner(rw)),
    ]));
    const events = [
      ['Action proposed', 'Orbit renewal review', 'Oct 28 · admin'],
      ['Amendment proposed', 'Pipeline renewal counteroffer', 'Oct 28 · admin'],
      ['Source added', 'Nimbus credit memo issued', 'Oct 25 · admin'],
      ['Credit allocated', 'INV-PC-1026 · $900.00', 'Oct 1 · admin'],
    ];
    return stack('Workspace audit trail', w, [
      fields('Activity filters', [['Search audit records', 'Command, vendor, actor or event'], ['Vendor', 'All vendors']], w),
      sheet('Recorded financial activity', w, [title('Audit trail title', 'Every local transition', inner(w)), muted('Audit sequence boundary', 'Recorded event order; newest first. Observation time is distinct from financial effective time.', inner(w)),
        ...events.flatMap(([event, subject, timing], i) => [...(i ? [rule(inner(w))] : []), stack('Audit row: ' + event + i, inner(w), [
          row('Audit operation and time', inner(w), [ink('Event operation', event, inner(w) * .55, 14, 'semibold'), muted('Event timing', timing, inner(w) * .41)], { gap: inner(w) * .04 }),
          ink('Event subject', subject, inner(w), 13),
        ], { gap: 6 })]),
      ]), notice('Audit integrity limit', 'Replay and local hashes establish internal record consistency. They do not authenticate counterparties or demonstrate an external transaction.'),
    ]);
  }

  function reportScene() {
    const history = stage === 'history', exported = stage === 'export';
    return stack('Financial report work surface', w, [
      fields('Report temporal filters', [['Financial effective on', history ? '2026-10-01' : '2026-11-07'], ['Known by', history ? '2026-10-01 · 23:59 UTC' : '2026-11-07 · 23:59 UTC']], w),
      ...(history ? [notice('Historical report restriction', 'Historical comparison · read only. Later offers and the Nimbus memo were not yet observed at this cutoff.', w, 'amber')] : []),
      sheet('Reported monetary states', w, [
        title('Report accounting title', history ? 'What the recorded evidence supported then' : 'Separate promises from applied value', inner(w)),
        safeFacts('Workspace report financial states', history ? [
          ['Unconditional promised', '$4,400.00'], ['Verified applied', '$900.00'], ['Unconditional outstanding', '$3,500.00'], ['Recoverable at this cutoff', '$3,500.00'], ['Issued, not applied', '$0.00'], ['Conditional offers known then', '$0.00'],
        ] : [
          ['Unconditional promised', '$4,750.00'], ['Verified applied', '$900.00'], ['Unconditional outstanding', '$3,850.00'], ['Recoverable within current windows', '$1,850.00'], ['Issued, not applied', '$2,000.00'], ['Conditional offers', '$480.00'],
        ], inner(w)),
      ]),
      ...(exported ? [sheet('Financial CSV export ready', w, [
        title('Export result title', 'Current report prepared for export', inner(w)),
        ink('Exported filename', 'truthful-financial-report.csv', inner(w), 15, 'semibold'),
        muted('CSV record contents', 'Four vendor rows plus WORKSPACE TOTAL. Financial columns use integer cents; time cutoffs and currency are included.', inner(w)),
        notice('Spreadsheet safety', 'Text cells are quoted and formula-like values are neutralized. Exported figures retain the selected financial and knowledge cutoffs.', inner(w)),
      ])] : [notice('Recoverable report explanation', history ? 'Only Nimbus and Pipeline existed at this knowledge cutoff. Unknown future evidence is not treated as an empty posting stream.' : 'The expired Nimbus window excludes $2,000 from recoverable now. Its recorded promise and issued memo remain visible. Orbit’s $480 is conditional and excluded.')]),
    ]);
  }

  function creditScene() {
    const baseSource = (width, kind = 'memo') => source('Northstar supporting source', width,
      kind === 'invoice' ? 'Supplied invoice application' : kind === 'reversal' ? 'Supplied credit reversal' : 'Supplied issued memo',
      kind === 'invoice' ? 'NR-INVOICE-11 · invoice · exact recorded revision' : kind === 'reversal' ? 'NR-REVERSAL-150 · credit memo · exact recorded revision' : 'NR-MEMO-300 / NR-LINE-1 · credit memo',
      kind === 'invoice' ? 'Invoice NR-INVOICE-11 applies USD 300 for NR-CREDIT-2026. This application uses the existing NR-MEMO-300 credit; it is not a second credit.'
        : kind === 'reversal' ? 'Reverse USD 150 of NR-MEMO-300 for NR-CREDIT-2026. Remove USD 50 from the first attribution and USD 100 from the second attribution.'
          : 'Credit memo NR-MEMO-300, line NR-LINE-1: USD 300 issued for NR-CREDIT-2026. This memo does not establish application to an invoice.');
    const summary = (width, state = 'issued') => {
      const values = state === 'empty' ? ['$350.00', '$0.00', '$0.00'] : state === 'issued' ? ['$350.00', '$0.00', '$100.00'] : state === 'applied' ? ['$250.00', '$100.00', '$0.00'] : state === 'attributed' ? ['$50.00', '$300.00', '$0.00'] : ['$200.00', '$150.00', '$0.00'];
      return sheet('Selected commitment financial ledger', width, [
        identity(inner(width)), amount('Credit still outstanding', values[0], inner(width), mobile ? 30 : 34),
        safeFacts('Northstar financial meanings', [['Original promise', '$350.00'], ['Verified applied', values[1]], ['Issued, attributed', values[2]]], inner(width)),
        ...(state === 'empty' ? [notice('No credit exists', 'No issued or applied credit is recorded. A reviewed claim does not create a credit.', inner(width))] : [
          rule(inner(width)), ink('Physical credit reference', 'NR-MEMO-300 / NR-LINE-1', inner(width), 14, 'semibold'),
          safeFacts('Conserved credit capacity', [['Remaining ledger value', state === 'reversed' ? '$150.00' : '$300.00'], ['Attributed across cases', state === 'issued' || state === 'applied' ? '$100.00' : state === 'reversed' ? '$150.00' : '$300.00'], ['Available to attribute', state === 'issued' || state === 'applied' ? '$200.00' : '$0.00']], inner(width)),
        ]),
      ]);
    };
    if (stage === 'empty') return pair('Unfulfilled promise and evidence entry', lw => summary(lw, 'empty'), rw => sheet('Credit entry instructions', rw, [
      title('Empty credit task', 'Record the supplied credit', inner(rw)),
      ink('Evidence requirements', 'Use a stable invoice or memo reference and an explicit credit-line identity.', inner(rw), 14),
      safeFacts('Credit entry decisions', [['Issued memo', 'Not verified applied'], ['Applied invoice credit', 'Requires invoice evidence'], ['Attribution', 'Explicit amount; optional']], inner(rw)),
      notice('Record source first', 'Nothing will be recorded until the exact financial effect is previewed and confirmed.', inner(rw)),
    ]));
    if (stage === 'register-issued') return pair('Issued credit form and supplied memo', lw => sheet('Issued credit data entry', lw, [
      identity(inner(lw)), title('New credit form title', 'Record a new credit', inner(lw)),
      fields('New issued credit fields', [['Evidence establishes', 'Issued memo — not applied'], ['Invoice or memo reference', 'NR-MEMO-300'], ['Unique credit line', 'NR-LINE-1'], ['Credit amount USD', '300.00'], ['Effective date', '2026-11-07'], ['Attribute now USD', '100.00']], inner(lw)),
      muted('Attribution meaning', '$100 is attributed now; $200 remains available. Neither amount becomes verified without invoice application.', inner(lw)),
    ]), rw => baseSource(rw));
    if (stage === 'issued-preview') return pair('Issued credit financial preview', lw => sheet('Review issued credit before recording', lw, [
      identity(inner(lw)), status('Unrecorded preview', Math.min(185, inner(lw)), 'amber'),
      comparison('Issued credit changes', inner(lw), [['Verified applied', '$0.00', '$0.00'], ['Ledger issued', '$0.00', '$300.00'], ['Attributed issued', '$0.00', '$100.00']]),
      safeFacts('Available issued value', [['Still outstanding after', '$350.00'], ['Credit available to attribute', '$200.00']], inner(lw)),
      notice('Atomic issued recording', 'Source, credit registration and $100 attribution will commit together. No invoice application is asserted.', inner(lw)),
    ]), rw => baseSource(rw));
    if (stage === 'issued-recorded') return stack('Issued credit recorded result', w, [notice('Issued credit success', 'Issued credit recorded. Verified applied remains $0. No vendor transaction was performed.'), pair('Issued credit and next proof', lw => summary(lw), rw => sheet('Application evidence next step', rw, [
      title('Issued memo next action', 'Obtain invoice application evidence', inner(rw)), status('Issued, not applied', Math.min(185, inner(rw)), 'amber'),
      ink('Invoice requirement', 'A separate invoice must demonstrate application of this same $300 credit.', inner(rw), 14),
      safeFacts('Retained identity', [['Memo reference', 'NR-MEMO-300'], ['Line reference', 'NR-LINE-1'], ['Current attributed value', '$100.00']], inner(rw)),
      muted('No duplicate credit', 'Application changes the existing credit’s state. It does not register another $300 line.', inner(rw)),
    ]))]);
    if (stage === 'application') return pair('Invoice application form and source', lw => sheet('Apply existing issued credit', lw, [
      identity(inner(lw)), title('Invoice application task', 'Record invoice application', inner(lw)),
      fields('Invoice application fields', [['Existing credit', 'NR-MEMO-300 / NR-LINE-1'], ['Operation', 'Invoice application'], ['Effective date', '2026-11-07'], ['Source title', 'November invoice application']], inner(lw)),
      safeFacts('Invoice effect preview context', [['Existing credit amount', '$300.00'], ['Already attributed', '$100.00'], ['Currently verified applied', '$0.00']], inner(lw)),
      notice('Application distinction', 'The invoice will establish application of the whole existing credit. Only its $100 current attribution can verify the selected commitment.', inner(lw)),
    ]), rw => baseSource(rw, 'invoice'));
    if (stage === 'applied') return stack('Invoice application recorded', w, [notice('Application recorded success', 'Invoice application recorded. Verified applied increased by $100; the same physical credit remains conserved.'), pair('Applied credit and retained invoice', lw => summary(lw, 'applied'), rw => baseSource(rw, 'invoice'))]);
    if (stage === 'fully-attributed') return stack('Applied credit fully attributed once', w, [
      notice('Remaining attribution recorded', 'The remaining $200 has been attributed. Total verified applied is $300; $50 of the original promise remains outstanding.'),
      pair('Fully attributed credit and conserved lineage', lw => summary(lw, 'attributed'), rw => sheet('Two attributions on one applied line', rw, [
        title('Full attribution lineage title', 'One credit. Two exact attributions.', inner(rw)),
        safeFacts('Full attribution capacity', [['Physical applied credit', '$300.00'], ['First attribution', '$100.00'], ['Second attribution', '$200.00'], ['Unallocated capacity', '$0.00']], inner(rw)),
        notice('No duplicated credit', 'NR-MEMO-300 / NR-LINE-1 is counted once. Separate supporting instructions retain the exact lineage of each attribution.', inner(rw)),
        muted('Reversal consequence', 'A subsequent reversal must name which attributed amounts lose their invoice backing.', inner(rw)),
      ])),
    ]);
    if (stage === 'attribute') return pair('Partial credit attribution form', lw => sheet('Attribute remaining applied capacity', lw, [
      identity(inner(lw)), title('Attribution task', 'Attribute available credit', inner(lw)),
      fields('Partial attribution fields', [['Exact credit line', 'NR-MEMO-300 / NR-LINE-1'], ['Amount to attribute USD', '200.00'], ['Effective date', '2026-11-07'], ['Supporting source', 'Vendor attribution instruction']], inner(lw)),
      safeFacts('Attribution conservation checks', [['Credit still available', '$200.00'], ['Already attributed', '$100.00'], ['Verified applied before', '$100.00']], inner(lw)),
      muted('Attribution source requirement', 'The instruction is recorded as a supporting revision for this attribution. Vendor and reference cannot be changed here.', inner(lw)),
    ]), rw => source('Explicit attribution instruction', rw, 'Supplied credit attribution', 'NR-ATTRIBUTION-200 · exact recorded revision', 'Attribute the remaining USD 200 of NR-MEMO-300, line NR-LINE-1, to commitment NR-CREDIT-2026. The previously attributed USD 100 remains unchanged.'));
    if (stage === 'attribution-preview') return pair('Attribution review and backed balance', lw => sheet('Review attribution financial effect', lw, [
      identity(inner(lw)), status('Unrecorded preview', Math.min(185, inner(lw)), 'amber'),
      comparison('Attribution changes', inner(lw), [['Verified applied', '$100.00', '$300.00'], ['Still outstanding', '$250.00', '$50.00'], ['Available to attribute', '$200.00', '$0.00']]),
      notice('No new physical credit', 'This uses $200 of existing applied capacity. Source and attribution commit together; the original $350 promise is unchanged.', inner(lw)),
    ]), rw => summary(rw, 'applied'));
    if (stage === 'reversal') return pair('Causal reversal entry and issuer notice', lw => sheet('Explicit reversal allocation form', lw, [
      identity(inner(lw)), title('Reversal task', 'Record a credit reversal', inner(lw)),
      fields('Reversal entry fields', [['Credit line', 'NR-MEMO-300 / NR-LINE-1'], ['Reversal amount USD', '150.00'], ['First attribution · $100', 'Remove 50.00'], ['Second attribution · $200', 'Remove 100.00']], inner(lw)),
      notice('Exact reversal backing', '$150 of attributed backing must be removed. There is no unallocated capacity to consume first.', inner(lw), 'amber'),
      muted('Causal reversal requirement', 'The exact positive removals must total $150 and cannot exceed either active attribution.', inner(lw)),
    ]), rw => baseSource(rw, 'reversal'));
    if (stage === 'reversal-preview') return pair('Reversal effect and causal attribution', lw => sheet('Review exact reversal effect', lw, [
      identity(inner(lw)), comparison('Credit reversal financial changes', inner(lw), [['Verified applied', '$300.00', '$150.00'], ['Still outstanding', '$50.00', '$200.00'], ['Remaining ledger value', '$300.00', '$150.00']]),
      safeFacts('Reversal allocation effects', [['First attribution remaining', '$50.00'], ['Second attribution remaining', '$100.00'], ['Available to attribute', '$0.00']], inner(lw)),
      notice('Atomic reversal confirmation', 'The supporting notice and both causal removals will commit together. The original promise remains $350.', inner(lw), 'amber'),
    ]), rw => baseSource(rw, 'reversal'));
    if (stage === 'reversed') return stack('Credit reversal recorded result', w, [notice('Reversal recorded success', 'Reversal recorded. Verified applied decreased by $150; outstanding increased to $200. No external financial transaction occurred.'), pair('Reopened commitment and reversal evidence', lw => summary(lw, 'reversed'), rw => baseSource(rw, 'reversal'))]);
    if (stage === 'duplicate-error') return pair('Duplicate physical credit refusal', lw => sheet('Uncommitted duplicate registration', lw, [
      identity(inner(lw)), status('Duplicate line refused', Math.min(205, inner(lw)), 'negative'),
      fields('Conflicting credit identity', [['Invoice or memo reference', 'NR-MEMO-300'], ['Unique credit line', 'NR-LINE-1'], ['Attempted amount USD', '300.00']], inner(lw)),
      notice('Duplicate identity error', 'This vendor invoice line is already registered under a credit ID. No new source, credit or attribution was recorded.', inner(lw), 'negative'),
      muted('Duplicate recovery action', 'Inspect the existing line. Apply invoice evidence or record an evidenced correction; do not alias the same physical credit.', inner(lw)),
    ]), rw => summary(rw, 'reversed'));
    if (stage === 'role-blocked') return pair('Role-correct credit restriction', lw => sheet('Credit recording blocked by role', lw, [
      identity(inner(lw)), field('Demo actor role', 'Viewer · read only', inner(lw)), status('Recording unavailable', Math.min(200, inner(lw)), 'amber'),
      notice('Analyst role requirement', 'Requires analyst or admin role. Current role: viewer. Source, registration, attribution, application and reversal writes are disabled.', inner(lw), 'amber'),
      ink('Permitted read activity', 'Inspect the exact credit, source revisions and financial preview context without changing the ledger.', inner(lw), 14),
    ]), rw => summary(rw, 'applied'));
    if (stage === 'historical') return stack('Historical credit comparison', w, [
      notice('Historical write restriction', 'Historical comparison · write actions disabled. Return to latest records to record credit evidence.', w, 'amber'),
      fields('Credit temporal cutoffs', [['Financial effective on', '2026-11-01'], ['Known by', '2026-11-01 · 23:59 UTC']], w),
      pair('Historical original promise and absent evidence', lw => summary(lw, 'empty'), rw => sheet('Historical evidence boundary', rw, [
        title('Unknown later credit evidence', 'No credit observed at this cutoff', inner(rw)),
        ink('Historical interpretation', 'The later November 7 memo, invoice application and reversal are absent from this view.', inner(rw), 14),
        muted('No future leakage', 'The original $350 promise remains visible. Later evidence must not leak into an earlier knowledge view.', inner(rw)),
        notice('Unknown is not settled loss', 'Missing evidence is unobserved. It does not prove an absent or final vendor posting.', inner(rw)),
      ])),
    ]);
    if (stage.startsWith('resolution-')) {
      const evidenceStage = stage === 'resolution-evidence', released = stage === 'resolution-released';
      return stack('Explicit credit identity resolution', w, [
        notice('Separate ambiguity example', 'Separate synthetic identity example: two commitments share NR-CREDIT-2026. A single $300 credit cannot be attributed twice.', w, 'amber'),
        pair('Clarification handoff and assignment review', lw => sheet(evidenceStage ? 'Analyst clarification evidence entry' : released ? 'Approved exact assignment limits' : 'Approver assignment limits', lw, [
          identity(inner(lw)), status(released ? 'Resolution recorded' : 'Attribution quarantined', Math.min(205, inner(lw)), released ? 'safe' : 'amber'),
          ...(evidenceStage ? [
            field('Demo actor role', 'Analyst', inner(lw)), field('Clarification title', 'Vendor assignment clarification', inner(lw)),
            ink('Recorded clarification passage', 'SYNTHETIC SOURCE\nAllow up to USD 100 for primary commitment and USD 200 for supplemental commitment under NR-CREDIT-2026.', inner(lw), 13),
            notice('Evidence does not release identity', 'Only this source is recorded. An approver must inspect it and set explicit assignment limits.', inner(lw)),
          ] : [
            field('Demo actor role', 'Approver', inner(lw)), field('Recorded clarification source', 'Vendor assignment clarification · revision 41', inner(lw)),
            fields('Exact assignment limits', [['Primary commitment maximum USD', '100.00'], ['Supplemental commitment maximum USD', '200.00']], inner(lw)),
            safeFacts('Conserved resolution capacity', [['Remaining credit', '$300.00'], ['Total explicit limits', '$300.00'], ['Existing primary attribution', '$100.00']], inner(lw)),
            notice('Resolution meaning', released ? 'Quarantine released. Existing supported $100 attribution is verified again; $200 remains unallocated. An analyst can attribute within the approved limits.' : 'Blank or zero leaves a candidate unassigned. Limits cannot exceed capacity or erase an existing active attribution.', inner(lw)),
          ]),
        ]), rw => source('Exact resolution supporting revision', rw, 'Vendor assignment clarification', 'allocation_resolution · bound revision 41', 'Allow up to USD 100 for primary commitment and USD 200 for supplemental commitment under NR-CREDIT-2026.', 'Source capture requires analyst or admin. Resolution approval uses this recorded source and requires approver or admin.')),
      ]);
    }
    throw new Error('Unknown credit expansion stage: ' + stage);
  }

  function amendmentScene() {
    const renewal = stage === 'renewal-only' || stage === 'policy-blocked';
    const executed = stage === 'executed';
    const preview = stage === 'preview' || stage === 'policy-blocked';
    const original = executed ? '$400.00' : '$350.00';
    const open = executed ? '$250.00' : '$200.00';
    const proposedSource = width => source('Proposed terms source sheet', width, renewal ? 'Renewal-only counteroffer' : 'Proposed corrected promise amount', renewal ? 'Synthetic proposed_terms · explicit renewal baseline' : 'Synthetic proposed_terms · exact supplied passage', renewal
      ? 'Keep the existing USD 350 credit promise for NR-CREDIT-2026. Proposed renewal: USD 1,200 incremental spend above an explicit USD 6,000 annual baseline. No renewal has been accepted.'
      : 'Proposal: amend the total promised credit for NR-CREDIT-2026 from USD 350 to USD 400. No additional service, renewal or new condition is required. Original terms remain until finance accepts this amendment.');
    if (stage === 'approval' || stage === 'approved') return pair('Northstar exact amendment authorization', lw => sheet(stage === 'approved' ? 'Approved Northstar action awaiting execution' : 'Approver review of Northstar amendment', lw, [
      identity(inner(lw)), title('Exact amendment action', 'Accept proposed amendment', inner(lw)),
      status(stage === 'approved' ? 'Approved; not executed' : 'Current action needs approval', Math.min(255, inner(lw)), stage === 'approved' ? 'safe' : 'amber'),
      field('Demo actor role', stage === 'approved' ? 'Executor' : 'Approver', inner(lw)),
      safeFacts('Exact reviewed Northstar agreement', [['Binding promise before execution', '$350.00'], ['Promise this action would accept', '$400.00'], ['Verified applied unchanged', '$150.00'], ['Outstanding before execution', '$200.00'], ['Incremental obligation', '$0.00']], inner(lw)),
      notice('Exact current policy decision', stage === 'approved' ? 'The exact current action is approved. Execution rechecks source, accepted terms, ledger and policy before one local acceptance effect.' : 'No new obligation is introduced. The current proposed amount is within the mandate; review its exact source before approving.', inner(lw)),
      muted('Approval is not acceptance', stage === 'approved' ? 'Approval alone has not changed the agreement. Recording this approved action would make the promise $400 and outstanding $250.' : 'Approval binds the current complete action basis. Later evidence, ledger, terms or policy changes can require a new review.', inner(lw)),
    ]), rw => proposedSource(rw));
    if (stage === 'draft' || stage === 'renewal-only') return pair('Editable amendment and proposed evidence', lw => sheet('Proposed amendment authoring', lw, [
      identity(inner(lw)), title('Amendment form task', 'Propose changed terms', inner(lw)),
      ...(renewal ? [
        field('Includes a new renewal obligation', 'Selected', inner(lw)), fields('Renewal-only economics fields', [['Current promise retained USD', '350.00'], ['Baseline total USD', '6,000.00'], ['Incremental renewal cost USD', '1,200.00'], ['Amendment effective date', '2026-11-07']], inner(lw)),
        ink('Explicit renewal comparison', 'Baseline: the same twelve-month service at USD 6,000. Proposed renewal adds USD 1,200; service value is not inferred.', inner(lw), 13),
        notice('Retained terms disclosure', 'No financial term was changed. The current $350 promise is retained explicitly; the proposed change is a new renewal obligation.', inner(lw), 'amber'),
      ] : [
        field('Terms to change', 'Promise amount selected', inner(lw)), fields('Changed promise fields', [['Current promise USD', '350.00'], ['Amended promise USD', '400.00'], ['Amendment effective date', '2026-11-07'], ['Additional renewal obligation', 'No']], inner(lw)),
        muted('Preserved unedited terms', 'Due date, claim deadline and conditions are retained. Vendor, reference and USD identity cannot be replaced.', inner(lw)),
      ]),
    ]), rw => proposedSource(rw));
    if (preview) return pair('Proposed terms preview and acceptance gate', lw => sheet('Review proposed amendment', lw, [
      identity(inner(lw)), status(stage === 'policy-blocked' ? 'Acceptance currently blocked' : 'Unrecorded proposal', Math.min(245, inner(lw)), 'amber'),
      ...(renewal ? [
        safeFacts('Renewal obligation economics', [['Promise amount retained', '$350.00'], ['Already verified after reversal', '$150.00'], ['Remaining contingent credit', '$200.00'], ['Incremental renewal cost', '$1,200.00'], ['Contingent net value', '−$1,000.00']], inner(lw)),
        notice('Renewal mandate refusal', 'Current policy allows no new commitments and has a $0 renewal limit. The proposal may be recorded for review; acceptance and execution remain blocked.', inner(lw), 'negative'),
      ] : [
        comparison('Changed promise comparison', inner(lw), [['Promise if accepted', '$350.00', '$400.00'], ['Verified applied', '$150.00', '$150.00'], ['Outstanding if accepted', '$200.00', '$250.00']]),
        notice('Proposal does not amend', 'Recording the source, proposal and review action does not change the current agreement. Acceptance requires a separately approved exact action.', inner(lw)),
      ]),
      muted('Proposed effective date', 'Proposed effective date: Nov 7, 2026. Future dates remain scheduled until effective after acceptance.', inner(lw)),
    ]), rw => proposedSource(rw));
    if (stage === 'recorded') return stack('Recorded proposal and next financial review', w, [
      notice('Amendment proposal recorded', 'Proposal recorded with its source and review action. Current promise remains $350; verified applied remains $150.'),
      pair('Recorded proposal and current binding terms', lw => sheet('Proposed change awaiting exact approval', lw, [
        identity(inner(lw)), title('Recorded amendment title', 'Accept proposed amendment', inner(lw)), status('Needs approval', Math.min(160, inner(lw)), 'amber'),
        safeFacts('Current and proposed agreement', [['Binding promise now', '$350.00'], ['Proposed promise', '$400.00'], ['Verified applied now', '$150.00'], ['Outstanding now', '$200.00']], inner(lw)),
        muted('Approval and execution sequence', 'An approver reviews the exact source and current basis. An executor then records the approved action once.', inner(lw)),
      ]), rw => proposedSource(rw)),
    ]);
    if (executed) return stack('Accepted amendment recorded once', w, [
      notice('Amendment acceptance completed', 'Approved amendment recorded once. This changes the promise to $400; it creates no invoice credit or vendor transaction.'),
      pair('Accepted commitment and retained financial evidence', lw => sheet('Amended Northstar commitment', lw, [
        identity(inner(lw)), status('Recorded once', Math.min(160, inner(lw))), amount('Current credit outstanding', open, inner(lw), 32),
        safeFacts('Accepted terms and ledger', [['Current promise', original], ['Original promise retained', '$350.00'], ['Verified applied unchanged', '$150.00'], ['Accepted incremental obligation', '$0.00']], inner(lw)),
        muted('Accepted basis remains inspectable', 'Original terms, accepted proposal, exact approval and execution history remain separate recorded events.', inner(lw)),
      ]), rw => proposedSource(rw)),
    ]);
    throw new Error('Unknown amendment expansion stage: ' + stage);
  }

  const render = { operations, vendor: vendorScene, library: libraryScene, audit: auditScene, report: reportScene, credit: creditScene, amendment: amendmentScene }[family];
  if (!render) throw new Error('Unknown expansion scene family: ' + family);
  const actions = (s.actions || []).filter(action => !['Portfolio', 'Assurance', 'Operations', 'Vendors', 'Evidence library', 'Workspace activity', 'Financial reports', 'Evidence lab', 'Execution lab', 'Navigation'].includes(action.label));
  const actionNodes = actions.map(action => {
    const controlWidth = mobile ? w : Math.min(350, (w - 16) / 2);
    const node = button(s, action.label, controlWidth, action === actions[0] ? 'primary' : 'secondary');
    const lines = Math.ceil(action.label.length / Math.max(12, Math.floor((controlWidth - 28) / 6.5)));
    if (lines > 1) node.props.h = 24 + lines * 17;
    return node;
  });
  const actionRows = [];
  for (let i = 0; i < actionNodes.length; i += mobile ? 1 : 2) actionRows.push(row('Declared next-step controls ' + i, w, actionNodes.slice(i, i + (mobile ? 1 : 2)), { gap: 16, items: 'start' }));
  return stack('Expansion scene: ' + family + '/' + stage, w, [
    render(),
    ...(actions.length ? [rule(w), title('Next step heading', 'Next step', w, 14), ...actionRows] : []),
  ], { gap: 18 });
}
