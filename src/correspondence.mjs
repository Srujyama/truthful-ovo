// A reading model over the evaluated records. It does not infer settlement or
// authorize a change; the original source versions remain the evidence.

export function formatMoney(cents, currency = 'USD') {
  if (!Number.isSafeInteger(cents)) throw new TypeError('Money must be a safe integer number of cents.');
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const dateText = value => value ? new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '';

function relatedCredits(view, commitment) {
  return (view.credits || []).filter(credit => credit.vendorId === commitment.vendorId && credit.currency === commitment.currency && (
    credit.reference === commitment.reference ||
    credit.allocations?.some(allocation => allocation.commitmentId === commitment.id) ||
    credit.candidateCommitmentIds?.includes(commitment.id)
  ));
}

/** Exact, directly related pages, in reading order; never all action-basis pages. */
export function correspondenceDocuments(view, commitment) {
  if (!commitment) return [];
  const links = new Map();
  const add = (items, role) => {
    for (const link of items || []) {
      const key = JSON.stringify([link.sourceId, link.revision]);
      if (!links.has(key)) links.set(key, {link: {...link}, roles: []});
      const entry = links.get(key);
      if (!entry.roles.includes(role)) entry.roles.push(role);
    }
  };
  add(commitment.sourceLinks, 'promise');
  for (const amendment of view.amendments || []) {
    if (amendment.commitmentId === commitment.id) add(amendment.sourceLinks, 'changed-terms');
  }
  const credits = relatedCredits(view, commitment);
  for (const credit of credits) {
    for (const link of credit.sourceLinks || []) {
      const kind = (view.sourceVersions || []).find(item => item.id === link.sourceId && item.revision === link.revision)?.kind;
      add([link], kind === 'invoice' ? 'invoice' : kind === 'credit_memo' ? 'credit-note' : 'credit-evidence');
    }
    add(credit.applicationSourceLinks, 'invoice');
    add(credit.resolution?.sourceLinks, 'matching-instruction');
    for (const allocation of credit.allocations || []) {
      if (allocation.commitmentId === commitment.id) add(allocation.sourceLinks, 'matching-instruction');
    }
  }
  const creditNodes = new Set(credits.map(credit => `credit:${credit.id}`));
  const reversalNodes = new Set((view.graph?.edges || []).filter(edge => edge.relation === 'reverses' && creditNodes.has(edge.to)).map(edge => edge.from));
  for (const edge of view.graph?.edges || []) {
    if (edge.relation !== 'supports' || !reversalNodes.has(edge.to)) continue;
    const sourceNode = (view.graph?.nodes || []).find(node => node.id === edge.from && node.kind === 'source');
    if (sourceNode) add([{sourceId: sourceNode.sourceId, revision: sourceNode.revision}], 'reversal');
  }
  return [...links.values()].map(({link, roles}) => {
    const source = (view.sourceVersions || []).find(item => item.id === link.sourceId && item.revision === link.revision) || null;
    return {
      link, source, roles, role: roles[0], available: Boolean(source),
      id: link.sourceId, sourceId: link.sourceId, revision: link.revision,
      title: source?.title || link.sourceId, kind: source?.kind || null,
      text: source?.text ?? null, observedAt: source?.observedAt || null,
    };
  });
}

function changedTerms(view, commitment) {
  const currency = commitment.currency || 'USD';
  const money = cents => formatMoney(cents, currency);
  return (view.amendments || [])
    .filter(item => item.commitmentId === commitment.id && !item.accepted && !item.rejected && !item.superseded)
    .map(amendment => {
      const common = {id: amendment.id, amendmentId: amendment.id, sourceLinks: amendment.sourceLinks || [], accepted: false};
      if (amendment.basisStale) return {
        ...common, kind: 'stale-offer', title: 'An earlier offer needs checking',
        detail: 'The promise or a supporting document has changed since this offer was recorded. It has not been accepted.',
      };
      if (amendment.newCommitment || amendment.incrementalRenewalCostCents > 0) {
        const creditCents = Math.max(0, (amendment.patch?.promisedCents ?? commitment.promisedCents) - commitment.verifiedCents);
        const extraCostCents = amendment.incrementalRenewalCostCents;
        const netCostCents = extraCostCents - creditCents;
        return {
          ...common, kind: 'renewal',
          title: netCostCents > 0 ? `This offer costs ${money(netCostCents)} more after the credit` : 'This offer comes with new spending',
          detail: `${money(creditCents)} of credit requires ${money(extraCostCents)} in extra spending. You have not accepted it.`,
          creditCents, extraCostCents, netCostCents,
          baselineCostCents: amendment.baselineCostCents,
          baselineDescription: amendment.baselineDescription,
        };
      }
      if (amendment.patch?.dueDate) return {
        ...common, kind: 'date-change', date: amendment.patch.dueDate,
        title: `They proposed waiting until ${dateText(amendment.patch.dueDate)}`,
        detail: `The original date is still ${dateText(commitment.dueDate)}. You have not accepted the new date.`,
      };
      return {...common, kind: 'changed-terms', title: 'They proposed different terms', detail: 'The original promise still applies. The proposed change has not been accepted.'};
    });
}

/**
 * Plain-language correspondence for a real evaluated commitment.
 * `amounts` are formatted print values; `amountsCents` retain exact cents.
 * Conditional value has no `owed` amount. Expired claims are not labelled
 * recoverable. A missing recorded invoice is not evidence of nonpayment.
 */
export function correspondenceStory(view, commitment, companyName) {
  if (!commitment) return null;
  const company = companyName || (view.vendors || []).find(item => item.id === commitment.vendorId)?.name || 'This company';
  const currency = commitment.currency || 'USD';
  const money = cents => formatMoney(cents, currency);
  const conditional = (commitment.conditions || []).length > 0;
  const values = {
    originalPromised: commitment.originalPromisedCents ?? commitment.promisedCents,
    promised: commitment.promisedCents,
    applied: commitment.verifiedCents,
    missing: commitment.outstandingCents,
    issued: commitment.issuedCents,
    owed: conditional ? null : commitment.outstandingCents,
  };
  const amounts = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null ? '—' : money(value)]));
  const documents = correspondenceDocuments(view, commitment);
  const warnings = changedTerms(view, commitment);
  const renewal = warnings.find(item => item.kind === 'renewal');
  const invoiceNeedsMatching = commitment.quarantinedAppliedCents > 0 || relatedCredits(view, commitment).some(credit => credit.status === 'applied' && credit.availableCents > 0 && (credit.quarantined || credit.unallocatedCents > 0));
  let headline, detail, nextLabel, tone, kind;
  if (conditional) {
    kind = 'offer'; tone = 'caution';
    headline = `A ${amounts.promised} offer, with a catch`;
    detail = renewal
      ? `They offered ${amounts.promised} if you take on ${money(renewal.extraCostCents)} in extra spending.`
      : `The offer has a condition: ${commitment.conditions.join(' ')}`;
    nextLabel = 'Read the offer';
  } else if (values.missing === 0) {
    kind = 'complete'; tone = 'settled';
    headline = `The full ${amounts.promised} is on the invoice`;
    detail = `The invoice credit matches the ${amounts.promised} promise.`;
    nextLabel = 'Read the invoice';
  } else if (invoiceNeedsMatching) {
    kind = 'needs-matching'; tone = 'caution';
    headline = 'An invoice credit needs matching';
    detail = values.applied > 0
      ? `${amounts.applied} of the ${amounts.promised} promise matches. Another invoice credit needs checking before it can cover the rest.`
      : `The ${amounts.promised} promise is recorded, but the invoice credit has not been assigned to it.`;
    nextLabel = 'Check which promise it covers';
  } else if (values.applied > 0) {
    kind = 'partly-applied'; tone = 'attention';
    headline = `The invoice is ${amounts.missing} short`;
    detail = `They promised ${amounts.promised}. The matching invoice shows ${amounts.applied} of credit.`;
    nextLabel = 'Compare the promise and invoice';
  } else if (values.issued > 0) {
    kind = 'credit-note'; tone = 'waiting';
    const notes = relatedCredits(view, commitment).filter(credit => credit.status === 'issued');
    const singleWholeNote = notes.length === 1 && notes[0].availableCents === values.issued;
    headline = singleWholeNote ? `A ${amounts.issued} credit note, waiting on an invoice` : `${amounts.issued} of credit notes, waiting on an invoice`;
    detail = singleWholeNote ? 'The note is recorded. No invoice here confirms that the credit reduced your bill.' : `${amounts.issued} is matched to this promise${notes.length === 1 ? ` from the ${money(notes[0].amountCents)} note` : ''}. No invoice here confirms an actual reduction.`;
    nextLabel = 'Check the credit note';
  } else {
    kind = commitment.dueDate > view.asOf ? 'not-due' : 'waiting-for-invoice'; tone = 'waiting';
    headline = `The ${amounts.promised} promise still needs an invoice`;
    detail = `They promised ${amounts.promised} off the invoice${commitment.dueDate ? ` expected ${dateText(commitment.dueDate)}` : ''}. No matching invoice has been added.`;
    nextLabel = 'Read the promise';
  }
  const deadlineNote = commitment.deadline?.date
    ? commitment.deadline.state === 'expired'
      ? `The claim deadline passed ${dateText(commitment.deadline.date)}.`
      : `The claim deadline is ${dateText(commitment.deadline.date)}.`
    : null;
  if (commitment.sourceChanged) warnings.push({kind: 'new-source-version', title: 'A document has changed', detail: 'A newer version is recorded. Check it before deciding what to do next.'});
  if (commitment.incrementalObligationCents > 0) warnings.push({
    kind: 'accepted-spending', title: `${money(commitment.incrementalObligationCents)} in extra spending was accepted`,
    detail: 'The invoice credit and the extra spending are separate amounts.', extraCostCents: commitment.incrementalObligationCents,
  });
  if (commitment.futureIncrementalObligationCents > 0) warnings.push({
    kind: 'future-spending', title: `${money(commitment.futureIncrementalObligationCents)} in extra spending is scheduled`,
    detail: 'An accepted change starts later. It does not change today’s invoice credit.', extraCostCents: commitment.futureIncrementalObligationCents,
  });
  return {
    id: commitment.id, reference: commitment.reference, company, currency,
    kind, tone, headline, detail, nextLabel, deadlineNote,
    expectedDate: commitment.dueDate, expectedDateText: dateText(commitment.dueDate),
    conditional, complete: !conditional && values.missing === 0,
    amounts, amountsCents: values,
    amountLabels: {
      originalPromised: 'Originally promised', promised: conditional ? 'Offer' : 'Promised',
      applied: 'On the invoice', missing: conditional ? 'Offer still conditional' : 'Still missing from the invoice',
      issued: 'Credit note, not yet on an invoice', owed: 'Still missing from the invoice',
    },
    documents, warnings,
  };
}
