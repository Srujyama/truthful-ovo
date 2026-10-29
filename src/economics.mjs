import { moneyToCents } from './engine/index.mjs';

export function compareRenewal({baselineMonthly,proposedMonthly,months,creditCents}) {
  const period=Number(months);
  if(!Number.isInteger(period) || period < 1 || period > 120) throw new Error('Use a comparison period between 1 and 120 whole months.');
  if(!Number.isSafeInteger(creditCents) || creditCents < 0) throw new Error('Credit must be nonnegative integer cents.');
  const baselineCents=moneyToCents(baselineMonthly)*period;
  const proposedCents=moneyToCents(proposedMonthly)*period;
  if(!Number.isSafeInteger(baselineCents) || !Number.isSafeInteger(proposedCents)) throw new Error('The comparison exceeds the supported amount.');
  const incrementalCents=proposedCents-baselineCents;
  const netValueCents=creditCents-incrementalCents;
  const netOutlayCents=proposedCents-creditCents;
  if(![incrementalCents,netValueCents,netOutlayCents].every(Number.isSafeInteger)) throw new Error('The comparison exceeds the supported amount.');
  return {baselineCents,proposedCents,incrementalCents,netValueCents,netOutlayCents,months:period};
}
