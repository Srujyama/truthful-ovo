export const backendCapabilities=Object.freeze({
 version:'truthful-backend-v1',
 financialCommandTypes:['ADD_VENDOR','ADD_SOURCE','REVISE_SOURCE','CREATE_COMMITMENT','PROPOSE_AMENDMENT','DISMISS_AMENDMENT','REGISTER_CREDIT','APPLY_CREDIT','RESOLVE_CREDIT','ALLOCATE_CREDIT','REVERSE_CREDIT','SET_POLICY','PROPOSE_ACTION','APPROVE_ACTION','EXECUTE_ACTION'],
 workflowTypes:['evidence-import','credit','amendment','credit-resolution-evidence','credit-resolution'],
 creditOperations:['register','apply','allocate','reverse'],
 readModels:['operations','vendors','commitments','credits','sources','activity','audit'],
 roles:{viewer:['read','export'],analyst:['read','evidence','draft','propose','record-credit','explore'],approver:['read','approve-action','approve-claim','resolve-credit','issue-authority','explore'],executor:['read','execute-approved-action','explore'],admin:['workspace-administration','all-workspace-operations']},
 concurrency:{financialRevision:'expectedRevision or If-Match',evidenceRevision:'expectedEvidenceVersion',draftRevision:'expectedVersion',idempotency:'Idempotency-Key on every persisted workflow or financial write',previews:'actor-bound; 10 minute lifetime; changes require a new preview'},
 modules:['accounts-and-memberships','durable-evidence-analysis','typed-finance-workflows','financial-command-ledger','temporal-projections','claim-recovery','bounded-execution-explorer','signed-authority','portable-packet-verification','financial-reports','backup-and-restore'],
 externalActions:{emailDelivery:false,vendorMessages:false,paymentExecution:false,bankSync:false,liveModel:false},
});
