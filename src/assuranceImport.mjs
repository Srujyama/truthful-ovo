import { analyzeEvidence } from './engine/index.mjs';
import { evaluateWorkspace } from './assurance/index.mjs';
import { digest } from './recovery.mjs';

const identity = value => value.normalize('NFC').trim().toLowerCase();

/** Convert a freshly revalidated supported report into an atomic command batch. */
export async function prepareEvidenceImport(workspace, report, now = new Date().toISOString()) {
  if (!report?.documents) throw new Error('Analyze the original documents before adding a portfolio case.');
  const fresh = analyzeEvidence({ vendor:report.vendor, asOf:report.asOf, ...report.documents });
  if (fresh.errors.length || fresh.condition || fresh.replyCondition || fresh.replyReviewRequired) {
    throw new Error('Resolve unsupported evidence or changed terms before importing this case. Original terms are never inferred from an ambiguous reply.');
  }
  if (fresh.asOf > now.slice(0,10)) throw new Error('A future review cannot establish applied credits in the current workspace.');
  const view = evaluateWorkspace(workspace,{asOf:now.slice(0,10),knownAt:now});
  const tag = (await digest(identity(fresh.vendor))).slice(0,20);
  let vendor = view.vendors.find(v => identity(v.name) === identity(fresh.vendor));
  const commands = [];
  if (!vendor) {
    vendor = {id:`vendor-${tag}`,name:fresh.vendor};
    commands.push({type:'ADD_VENDOR',vendor});
  }
  const candidates = view.commitments.filter(c => c.vendorId === vendor.id && c.reference === fresh.commitmentRef && c.currency === fresh.currency);
  if (candidates.length > 1) throw new Error('Several commitments share this reference. Resolve their credit allocation explicitly in the assurance workspace.');
  let commitment = candidates[0];
  const caseTag = (await digest(`${vendor.id}\n${fresh.commitmentRef}`)).slice(0,24);
  const promiseSourceId = `import-promise-${caseTag}`;
  const invoiceSourceId = `import-invoice-${(await digest(fresh.documents.invoiceCsv)).slice(0,24)}`;
  if (commitment && (commitment.promisedCents !== fresh.promisedCents || commitment.dueDate !== fresh.dueDate || commitment.conditions.length)) {
    throw new Error('The tracked terms differ. Record and approve an amendment instead of replacing the original commitment.');
  }
  if (!commitment) {
    commitment = {id:`commitment-${caseTag}`,vendorId:vendor.id,reference:fresh.commitmentRef,currency:'USD',promisedCents:fresh.promisedCents,dueDate:fresh.dueDate,claimDeadline:null,conditions:[],sourceIds:[promiseSourceId]};
    commands.push({type:'ADD_SOURCE',source:{id:promiseSourceId,vendorId:vendor.id,title:`${fresh.vendor} original promise`,kind:'email',text:fresh.documents.promiseText}});
    commands.push({type:'CREATE_COMMITMENT',commitment,effectiveDate:fresh.promiseDate || fresh.asOf});
  }
  let needsInvoiceSource = false;
  for (const row of fresh.invoiceMatches) {
    const matching = view.credits.filter(c => c.vendorId === vendor.id && c.invoiceId === row.invoiceId && c.currency === 'USD');
    if (matching.length > 1) throw new Error('This invoice has several credit lines. Import explicit line identities through the command API instead of guessing.');
    let credit = matching[0];
    if (credit && (credit.reference !== fresh.commitmentRef || credit.amountCents !== row.amountCents || credit.reversedCents || credit.status !== 'applied')) {
      throw new Error('The imported invoice conflicts with an existing ledger credit. Inspect the source and record a correction explicitly.');
    }
    if (!credit) {
      needsInvoiceSource = true;
      const creditTag = (await digest(`${vendor.id}\n${row.invoiceId}`)).slice(0,24);
      credit = {id:`credit-${creditTag}`,lineId:'legacy-single-credit',invoiceId:row.invoiceId,vendorId:vendor.id,currency:'USD',reference:fresh.commitmentRef,amountCents:row.amountCents,status:'applied',sourceIds:[invoiceSourceId]};
      commands.push({type:'REGISTER_CREDIT',credit,effectiveDate:row.date});
    }
    const already = view.allocations.filter(a => a.creditId === credit.id && a.commitmentId === commitment.id).reduce((total,a) => total+a.activeCents,0);
    if (already === row.amountCents) continue;
    if (already || credit.allocatedCents) throw new Error('That credit already has an allocation. Review the shared ledger before reallocating it.');
    const allocationTag = (await digest(`${credit.id}\n${commitment.id}`)).slice(0,24);
    commands.push({type:'ALLOCATE_CREDIT',allocationId:`allocation-${allocationTag}`,creditId:credit.id,commitmentId:commitment.id,amountCents:row.amountCents,effectiveDate:row.date});
  }
  if(needsInvoiceSource && !view.sources.some(s => s.id === invoiceSourceId)) {
    const source = {type:'ADD_SOURCE',source:{id:invoiceSourceId,vendorId:vendor.id,title:`${fresh.vendor} imported invoice credits`,kind:'invoice',text:fresh.documents.invoiceCsv}};
    const position = commands.findIndex(c => c.type === 'REGISTER_CREDIT');
    commands.splice(position,0,source);
  }
  return {commands,commitmentId:commitment.id,report:fresh,alreadyTracked:commands.length === 0};
}
