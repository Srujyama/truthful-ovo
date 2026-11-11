// craft-words: the product's own
//
// The titles the engine gives a To do row (src/operations.mjs, operationQueue)
// and the event types it writes in the day book (src/assurance/core.mjs).
// Nobody reads these on a page: plain.mjs looks a row up by them and says it
// as a person would. They are kept here, apart from the book's own words.

export const TITLE = {
  expired: 'Review expired claim window',
  competing: 'Resolve competing terms',
  whichPromise: 'Resolve credit attribution',
  unmatched: 'Inspect an unmatched credit',
  newerCopy: 'Review revised evidence',
  prepareAgain: 'Refresh the action review',
  stopped: 'Inspect a blocked action',
  approved: 'Record the approved action',
  prepared: 'Review the prepared action',
  matchCredit: 'Attribute available credit',
  needsInvoice: 'Obtain invoice application evidence',
  strings: 'Review conditional terms',
  chase: 'Follow up the outstanding promise',
  notDue: 'Await the promised date',
};

/** Which of the day book's kinds each event type belongs to. */
export const EVENT_KIND = {
  VENDOR_ADDED: 'companies',
  SOURCE_ADDED: 'papers',
  SOURCE_REVISED: 'papers',
  COMMITMENT_CREATED: 'promises',
  CREDIT_REGISTERED: 'credits',
  CREDIT_APPLIED: 'credits',
  CREDIT_ALLOCATED: 'credits',
  ALLOCATION_CREATED: 'credits',
  CREDIT_REVERSED: 'credits',
  CREDIT_RESOLVED: 'credits',
  AMENDMENT_PROPOSED: 'offers',
  AMENDMENT_ACCEPTED: 'offers',
  AMENDMENT_DISMISSED: 'offers',
  ACTION_PROPOSED: 'decisions',
  ACTION_APPROVED: 'decisions',
  ACTION_EXECUTED: 'decisions',
  POLICY_SET: 'rules',
  WORKSPACE_RESET: 'rules',
};
