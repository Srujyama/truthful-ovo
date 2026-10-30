import { createWorkspace, reduceWorkspace } from '../assurance/index.mjs';
export const AUTHORITY_DEMO_TIME = '2026-11-01T12:00:00.000Z';
export const AUTHORITY_DEMO_ACTOR = { id: 'authority-demo-reviewer', role: 'admin' };
export function createAuthorityDemoWorkspace() {
  let state = createWorkspace({ id: 'isolated-authority-demo', policy: { version: 'authority-policy-1', claimLimitCents: 50000, renewalLimitCents: 5000, allowNewCommitments: true } });
  const commands = [
    { type: 'ADD_VENDOR', vendor: { id: 'demo-vendor', name: 'Synthetic Vendor' } },
    { type: 'ADD_SOURCE', source: { id: 'demo-source', vendorId: 'demo-vendor', title: 'Synthetic revised credit offer', kind: 'email', text: 'SYNTHETIC ISOLATED DEMO: original USD 100 credit; a proposed amendment raises the credit to USD 120 with USD 20 incremental renewal obligation against a zero additional-spend baseline. No money is applied and no vendor is contacted.' } },
    { type: 'CREATE_COMMITMENT', commitment: { id: 'demo-commitment', vendorId: 'demo-vendor', reference: 'DEMO-ONLY', currency: 'USD', promisedCents: 10000, dueDate: '2026-11-01', conditions: [], sourceIds: ['demo-source'] } },
    { type: 'PROPOSE_AMENDMENT', amendment: { id: 'demo-amendment', commitmentId: 'demo-commitment', kind: 'renewal', patch: { promisedCents: 12000 }, effectiveDate: '2026-11-01', sourceIds: ['demo-source'], incrementalRenewalCostCents: 2000, baselineCostCents: 0, baselineDescription: 'No additional spend; explicit synthetic baseline.', newCommitment: true } },
    { type: 'PROPOSE_ACTION', action: { id: 'demo-action', commitmentId: 'demo-commitment', type: 'accept_amendment', payload: { amendmentId: 'demo-amendment' } } },
    { type: 'APPROVE_ACTION', actionId: 'demo-action' },
  ];
  for (const [i, command] of commands.entries()) state = reduceWorkspace(state, { id: `authority-seed-${i}`, ...command }, { actor: AUTHORITY_DEMO_ACTOR, now: AUTHORITY_DEMO_TIME }).state;
  return state;
}
