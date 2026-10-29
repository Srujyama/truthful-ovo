const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const cents = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function currency(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError('Amount must be a finite number.');
  }
  return usd.format(amount);
}

export function calculateSla({
  bill = 8000,
  downtimeMinutes = 540,
  periodMinutes = 43200,
  covered = true,
} = {}) {
  for (const [name, value] of Object.entries({ bill, downtimeMinutes, periodMinutes })) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite, nonnegative number.`);
    }
  }
  if (periodMinutes === 0) throw new RangeError('The billing period must be greater than zero.');
  if (downtimeMinutes > periodMinutes) throw new RangeError('Downtime cannot exceed the billing period.');
  if (typeof covered !== 'boolean') throw new TypeError('Coverage must be true or false.');

  const uptime = Number(((1 - downtimeMinutes / periodMinutes) * 100).toFixed(8));
  // Compare downtime against the exact tier boundary instead of rounded display uptime.
  const tier = downtimeMinutes > periodMinutes * 0.01 ? 0.25
    : downtimeMinutes > periodMinutes * 0.001 ? 0.1 : 0;
  const rate = covered ? tier : 0;
  const amount = cents(bill * rate);
  const eligible = rate > 0 && amount > 0;
  const reason = !covered
    ? 'The incident is outside the services covered by this agreement.'
    : rate === 0
      ? 'Availability meets the 99.9% commitment. No service credit applies.'
      : amount === 0
        ? 'No eligible monthly charges are available for a service credit.'
        : `${rate * 100}% of eligible monthly charges under the service agreement.`;

  return { uptime, rate, amount, eligible, reason };
}

export function initialState() {
  return {
    nimbus: 'monitoring',
    pipeline: 'partial',
    pipelineApplied: 900,
    pipelinePromised: 2400,
    pipelineDeferred: false,
    events: [],
  };
}

function record(state, type, caseId, patch, title, detail) {
  return {
    ...state,
    ...patch,
    events: [...state.events, {
      id: `event-${state.events.length + 1}`,
      type,
      caseId,
      title,
      detail,
    }],
  };
}

export function transition(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  const nimbusCredit = calculateSla().amount;
  switch (type) {
    case 'RESET':
      return initialState();
    case 'DETECT_OUTAGE':
      if (state.nimbus !== 'monitoring') return state;
      return record(state, type, 'nimbus', { nimbus: 'eligible' },
        'Service credit identified',
        `Nine hours of covered downtime triggers a ${currency(nimbusCredit)} credit. Claim ready for review.`);
    case 'SUBMIT_CLAIM':
      if (state.nimbus !== 'eligible') return state;
      return record(state, type, 'nimbus', { nimbus: 'submitted' },
        'Claim approved', 'The evidence-backed claim was recorded in this demo. No email was sent.');
    case 'VENDOR_CONDITION':
      if (state.nimbus !== 'submitted') return state;
      return record(state, type, 'nimbus', { nimbus: 'conditional' },
        'New condition needs approval',
        'The vendor tied the credit to an annual renewal. The original claim remains open; no savings were added.');
    case 'KEEP_TERMS':
      if (state.nimbus !== 'conditional') return state;
      return record(state, type, 'nimbus', { nimbus: 'submitted' },
        'Original terms preserved',
        'Follow-up requests the existing service credit without accepting a new annual obligation.');
    case 'ISSUE_CREDIT':
      if (!['submitted', 'conditional'].includes(state.nimbus)) return state;
      return record(state, type, 'nimbus', { nimbus: 'issued' },
        'Credit memo received',
        `${currency(nimbusCredit)} issued under the original terms. Awaiting application to an invoice.`);
    case 'APPLY_CREDIT':
      if (state.nimbus !== 'issued') return state;
      return record(state, type, 'nimbus', { nimbus: 'verified' },
        'Credit application verified',
        `${currency(nimbusCredit)} matched to the invoice. The commitment is fulfilled.`);
    case 'PIPELINE_CONDITION':
      if (state.pipeline !== 'partial') return state;
      return record(state, type, 'pipeline', { pipeline: 'conditional' },
        'Conditional renewal offer',
        'The offer adds a year of service. It requires approval and does not increase realized savings.');
    case 'PIPELINE_KEEP_TERMS':
      if (state.pipeline !== 'conditional') return state;
      return record(state, type, 'pipeline', { pipeline: 'partial' },
        'Original concession remains open',
        'The new renewal terms were not accepted. Follow-up continues against the original promise.');
    case 'PIPELINE_DEFER':
      if (!['partial', 'conditional'].includes(state.pipeline)) return state;
      return record(state, type, 'pipeline', { pipeline: 'scheduled', pipelineDeferred: true },
        'Credit rescheduled',
        'A confirmed amendment moves the remaining credit to November. It is no longer due this period.');
    case 'PIPELINE_RESTORE':
      if (state.pipeline !== 'scheduled') return state;
      return record(state, type, 'pipeline', { pipeline: 'partial', pipelineDeferred: false },
        'Original schedule restored',
        'The demonstration restored the original invoice date and outstanding balance.');
    case 'PIPELINE_APPLY':
      if (!['partial', 'conditional'].includes(state.pipeline)) return state;
      return record(state, type, 'pipeline', {
        pipeline: 'verified', pipelineApplied: state.pipelinePromised, pipelineDeferred: false,
      }, 'Remaining credit verified',
      `${currency(cents(state.pipelinePromised - state.pipelineApplied))} applied under the original terms. The promise is fulfilled.`);
    default:
      return state;
  }
}

export function getTotals(state) {
  const nimbusAmount = calculateSla().amount;
  const nimbusOpen = ['eligible', 'submitted', 'conditional', 'issued'].includes(state.nimbus);
  const pipelineOpen = !state.pipelineDeferred && state.pipeline !== 'verified';
  const pipelineOutstanding = Math.max(0, cents(state.pipelinePromised - state.pipelineApplied));
  return {
    recoverable: cents((nimbusOpen ? nimbusAmount : 0) + (pipelineOpen ? pipelineOutstanding : 0)),
    realized: cents(state.pipelineApplied + (state.nimbus === 'verified' ? nimbusAmount : 0)),
    activeCount: 2 - Number(state.nimbus === 'verified') - Number(state.pipeline === 'verified'),
    reviewCount: Number(['eligible', 'conditional'].includes(state.nimbus))
      + Number(['partial', 'conditional'].includes(state.pipeline)),
  };
}
