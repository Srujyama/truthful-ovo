import { prepareEvidenceImport } from './assuranceImport.mjs';
import { batchMutationReason } from './assurance-ui.mjs';

/** Copy and availability for the existing evidence approval and import boundaries. */
export function evidenceActions(report, { approved = false, draft = '', today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!report) return null;
  const sourceErrors = (report.errors || []).map(error => typeof error === 'string' ? error : error.message).filter(Boolean);
  const supported = report.status !== 'unsupported' && !sourceErrors.length;
  let approval;
  if (!supported) approval = { reason: sourceErrors.join(' ') || report.reasoning?.[0]?.detail || 'The documents do not establish a supported recovery.', next: 'Correct the source documents, then analyze the evidence again.' };
  else if (report.condition) approval = { reason: `The original promise is conditional: ${report.condition}`, next: 'Establish that the original condition is fulfilled with supporting evidence before preparing a recovery claim.' };
  else if (report.replyReviewRequired) approval = { reason: (report.warnings || []).find(warning => typeof warning === 'string' && warning.startsWith('Vendor reply retained')) || 'The vendor reply is outside the supported rules and requires manual review.', next: 'Review the retained reply and obtain clear supporting terms before analyzing again.' };
  else if (report.outstandingCents === 0) approval = { reason: 'The matched invoice credits fully cover the promise. No outstanding credit remains to claim.', next: 'Review the matched invoices. You can add the completed record to the portfolio.' };
  else if (report.status === 'scheduled' || (report.dueDate && report.dueDate > report.asOf)) approval = { reason: report.reasoning?.find(step => step.label === 'Schedule')?.detail || `The credit is not due until ${report.dueDate}.`, next: 'Reconcile on or after the due date with the latest invoice credits. You can track the scheduled promise in the portfolio now.' };
  else if (approved) approval = { reason: 'Approval is recorded for this exact draft under the original terms. No email was sent.', next: report.replyCondition ? 'Download the unsent draft if needed. The changed vendor terms still prevent portfolio import.' : 'Add the reviewed evidence to the portfolio, or download the unsent draft.' };
  else if (!draft.trim()) approval = { reason: 'There is no claim draft to approve.', next: 'Write a follow-up draft under the supported original terms before approving it.' };
  else if (!report.requiresApproval || !['needs_review', 'partial', 'conditional'].includes(report.status) || !Number.isSafeInteger(report.outstandingCents) || report.outstandingCents <= 0) approval = { reason: 'This analysis does not establish a supported outstanding recovery claim.', next: 'Review the evidence and resolve the terms before analyzing again.' };
  else approval = { allowed: true, reason: report.replyCondition ? 'You may approve a follow-up under the original promise only. The vendor’s new condition is not accepted.' : 'Review the exact draft and its cited evidence before recording approval.', next: 'Approve the claim locally. No email is sent.' };
  const approvalAllowed = supported && report.requiresApproval && ['needs_review', 'partial', 'conditional'].includes(report.status) && !report.replyReviewRequired && !report.condition && Number.isSafeInteger(report.outstandingCents) && report.outstandingCents > 0 && Boolean(draft.trim()) && !approved;
  let portfolio;
  if (!supported) portfolio = { reason: sourceErrors.join(' ') || 'The evidence does not establish supported original terms.', next: 'Correct the source errors and analyze again before adding a portfolio record.' };
  else if (report.condition || report.replyCondition) portfolio = { reason: report.replyCondition ? `The reply introduces changed terms: ${report.replyCondition}` : `The original promise is conditional: ${report.condition}`, next: 'Resolve the terms with supporting evidence before importing. Approval of an original-terms follow-up does not accept the condition.' };
  else if (report.replyReviewRequired) portfolio = { reason: approval.reason, next: 'Resolve the unrecognized reply before importing this evidence into the portfolio.' };
  else if (report.asOf > today) portfolio = { reason: `The review date ${report.asOf} is in the future. It cannot establish applied credits in the current workspace.`, next: 'Use the current review date and analyze again.' };
  else portfolio = { allowed: true, reason: 'Adds the original promise and matched applied credits to the shared portfolio. Portfolio actions keep their own approval requirements.', next: 'No email or payment is sent.' };
  return { approval: { ...approval, allowed: Boolean(approvalAllowed) }, portfolio: { ...portfolio, allowed: Boolean(portfolio.allowed) } };
}

/** Read-only preflight; execution must prepare and authorize the batch again. */
export async function previewEvidencePortfolio(workspace, report, { actorRole, busy = false, now = new Date().toISOString() } = {}) {
  if (!workspace) return { allowed: false, pending: true, reason: 'The shared portfolio is still connecting.', next: 'Wait for the portfolio workspace to load before continuing.' };
  const plan = await prepareEvidenceImport(workspace, report, now);
  // A duplicate needs no write: every role may open the existing record.
  const reason = busy ? 'Wait for the current portfolio operation to finish.' : plan.commands.length ? batchMutationReason(plan.commands, actorRole) : '';
  if (reason) return { allowed: false, reason, next: busy ? 'Wait until the current portfolio operation completes, then review the refreshed import preview.' : 'Open Assurance workspace options to select an analyst or admin demo role before importing new evidence.', plan };
  return { allowed: true, plan, reason: plan.commands.length ? 'Adds the original promise and matched applied credits to the shared portfolio. Portfolio actions keep their own approval requirements.' : 'This commitment and its matched credits are already tracked. Opening the record does not change the shared portfolio.', next: 'No email or payment is sent.' };
}
