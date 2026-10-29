export const vendors = {
  nimbus: { name: 'Nimbus Cloud', category: 'Infrastructure', type: 'SLA credit', reference: 'NC-2026-091', amount: 2000 },
  pipeline: { name: 'Pipeline CRM', category: 'Customer software', type: 'Email concession', reference: 'PC-2026-108', amount: 1500 },
  orbit: { name: 'Orbit Design', category: 'Design software', type: 'Price match', reference: 'OD-2026-042', amount: 480 },
  parcel: { name: 'Parcel', category: 'Logistics', type: 'Fee waiver', reference: 'PL-2026-016', amount: 350 },
};
export const sources = {
  contract: { title:'Nimbus service agreement',kind:'Contract',label:'Section 4.2 · Availability credits',date:'Effective September 1, 2026',vendor:'Nimbus Cloud', paragraphs:[
    'This agreement covers the Acme Labs production Compute service in EU-West. Monthly availability is measured over the complete calendar month using customer-verified service telemetry. Planned maintenance and unrelated services are excluded.',
    'Monthly uptime below 99.9% qualifies for a 10% service credit. Monthly uptime below 99.0% qualifies for a 25% service credit. Only the highest applicable tier applies.',
    'Credits are calculated against the covered monthly service charge, excluding tax. Claims must be submitted within 30 days after the billing period ends. Credits require vendor acceptance and are applied to a subsequent invoice.'
  ],highlight:1,facts:[['Covered service','Compute · EU-West'],['Monthly service charge','$8,000.00'],['Billing period','Sep 1–30, 2026'],['Claim deadline','Oct 30, 2026']] },
  incident: {title:'Compute service interruption',kind:'Status report',label:'INC-0928 · Customer impact verified',date:'September 28, 2026',vendor:'Nimbus Cloud',paragraphs:[
    '00:00 UTC — EU-West Compute became unavailable for the Acme Labs production account. Customer telemetry confirms all nine hours affected the covered service.',
    '09:00 UTC — Service restored. Total eligible downtime: 540 minutes. This incident was unplanned and falls within the covered September billing period.',
    'September has 43,200 minutes. Monthly availability = (43,200 − 540) ÷ 43,200 × 100 = 98.75%.'
  ],highlight:1,facts:[['Affected service','Compute · EU-West'],['Duration','9 hours'],['Eligible downtime','540 minutes'],['Evidence','Status report + account telemetry']]},
  nimbusInvoice:{title:'September service invoice',kind:'Invoice',label:'INV-NC-0926',date:'October 1, 2026',vendor:'Nimbus Cloud',paragraphs:[
    'Billed to Acme Labs. Service period: September 1–30, 2026.',
    'Compute · EU-West: $8,000.00\nService credits applied: $0.00\nInvoice total: $8,000.00',
    'The covered service charge is the basis for the SLA credit calculation. No credit has been applied to this invoice.'
  ],highlight:1,facts:[['Service charge','$8,000.00'],['Applied credit','$0.00'],['Invoice total','$8,000.00'],['Status','Paid']]},
  email:{title:'Your October credit',kind:'Email',label:'Maya Chen → Acme Labs finance',date:'September 18, 2026 · 10:42 AM',vendor:'Pipeline CRM',paragraphs:[
    'Hi Alex,',
    'Thanks for flagging the duplicate seat charges. We’ll credit you $2,400 on your October invoice. This is a correction to your current agreement and does not require a renewal.',
    'I’ve confirmed this with our billing team. Please let me know if the adjustment doesn’t appear.\n\nMaya\nAccount manager, Pipeline CRM'
  ],highlight:1,facts:[['Commitment','$2,400.00 credit'],['Due on','October invoice'],['Condition','No renewal required'],['Source','Vendor email']]},
  pipelineInvoice:{title:'October subscription invoice',kind:'Invoice',label:'INV-PC-1026',date:'October 1, 2026',vendor:'Pipeline CRM',paragraphs:[
    'Billed to Acme Labs. Service period: October 1–31, 2026.',
    'Team subscription: $6,000.00\nLoyalty adj. / duplicate seats: −$900.00\nInvoice total: $5,100.00',
    'The $900 adjustment references the seat correction in the September 18 email. The remaining $1,500 has not been applied.'
  ],highlight:1,facts:[['Subscription','$6,000.00'],['Applied adjustment','−$900.00'],['Invoice total','$5,100.00'],['Status','Paid']]},
  orbit:{title:'Price-match negotiation',kind:'Agent conversation',label:'Acme purchasing agent ↔ Orbit sales agent',date:'October 20, 2026',vendor:'Orbit Design',paragraphs:[
    'Acme instruction: explore a price match against our current $2,400 annual plan. Any renewal commitment requires finance approval.',
    'Orbit: We can reduce your next invoice by $480 if you renew for another year by November 1.',
    'Purchasing agent: Offer received. I have not accepted the renewal. Finance approval is still required.'
  ],highlight:1,facts:[['Potential credit','$480.00'],['Condition','12-month renewal'],['Authority','Approval required'],['Verified savings','$0.00']]},
  parcel:{title:'We’ll waive the setup fee',kind:'Email',label:'Parcel onboarding → Acme Labs',date:'October 21, 2026',vendor:'Parcel',paragraphs:[
    'Welcome to Parcel, Alex.',
    'As agreed, we’ll waive the $350 setup fee on your first invoice, scheduled for November 1. There is no minimum-term commitment attached to the waiver.',
    'We’ll send the invoice to your finance address once onboarding is complete.'
  ],highlight:1,facts:[['Fee waiver','$350.00'],['Expected invoice','November 1, 2026'],['Condition','None'],['Current status','Invoice not due yet']]}
};
sources.nimbusApplied={title:'November invoice · credit applied',kind:'Invoice',label:'INV-NC-1126 · Matched to CM-NC-204',date:'November 1, 2026 · simulated next invoice',vendor:'Nimbus Cloud',paragraphs:['Billed to Acme Labs. Service period: November 1–30, 2026.','Compute · EU-West: $8,000.00\nSeptember SLA credit, CM-NC-204: −$2,000.00\nInvoice total: $6,000.00','The credit is matched to the September service interruption and reduces the amount due. No annual renewal was accepted.'],highlight:1,facts:[['Gross charge','$8,000.00'],['Credit applied','−$2,000.00'],['Net amount due','$6,000.00'],['Verification','Credit reference + invoice line']]};
sources.pipelineApplied={title:'November invoice · remaining credit',kind:'Invoice',label:'INV-PC-1126',date:'November 1, 2026 · simulated next invoice',vendor:'Pipeline CRM',paragraphs:['Billed to Acme Labs. Service period: November 1–30, 2026.','Team subscription: $6,000.00\nDuplicate seat correction: −$1,500.00\nInvoice total: $4,500.00','Together with the $900 October adjustment, this completes the $2,400 commitment in the September 18 email.'],highlight:1,facts:[['October adjustment','$900.00'],['November credit','$1,500.00'],['Total verified','$2,400.00'],['Renewal accepted','No']]};
export function claimText(id) {
  if(id==='pipeline') return 'Hi Maya,\n\nYour September 18 email confirmed a $2,400 credit for duplicate seat charges on our October invoice. Invoice INV-PC-1026 includes a $900 adjustment, leaving $1,500 outstanding.\n\nPlease apply the remaining $1,500 under our existing agreement and share the credit reference. The original correction did not require a renewal.\n\nAttached: the original email and October invoice.\n\nThank you,\nAlex · Acme Labs';
  return 'Hi Nimbus billing team,\n\nWe’re submitting an availability credit claim for September 2026 under section 4.2 of our service agreement.\n\nOur covered EU-West Compute service experienced 540 minutes of verified, unplanned downtime on September 28. Across the 43,200-minute billing period, monthly availability was 98.75%. This qualifies for the 25% credit tier.\n\nCovered service charge: $8,000\nRequested service credit: $2,000\nClaim deadline: October 30, 2026\n\nPlease confirm acceptance and apply the credit to our next invoice. The agreement, incident report, and invoice are attached below.\n\nThank you,\nAlex · Acme Labs';
}
