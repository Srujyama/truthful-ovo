async page => {
  const checks = [], errors = [], pageErrors = [], base = new URL(page.url()).origin;
  let mode = null, failure = null, packet = null, resolutionPacket = null, failedWrite = null, delayedWrite = null;
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const onError = error => pageErrors.push(error.message); page.on('pageerror', onError);
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const ledger = () => page.getByRole('region', { name: 'Credits workspace', exact: true });
  const detail = () => page.locator('.followups-detail:visible');
  const confirm = () => page.getByRole('region', { name: 'Credit change preview', exact: true }).getByRole('button', { name: 'Record applied credit', exact: true });
  const chooseNorthstar = async () => {
    if (!await detail().getByRole('heading', { name: 'Northstar Review', exact: true }).isVisible().catch(() => false)) {
      const back = page.getByRole('button', { name: 'Back to cases', exact: true }); if (await back.isVisible().catch(() => false)) await back.click();
      const search = page.getByRole('textbox', { name: 'Search follow-ups', exact: true }); await search.fill('Northstar Review');
      const row = page.locator('.portfolio-row:visible').filter({ hasText: 'Northstar Review' });
      assert(await row.count() === 1, 'Recovery requires the Northstar case created by the preceding UI workflow'); await row.click();
    }
  };
  const showCredits = async () => { await page.getByRole('group', { name: 'Case information', exact: true }).getByRole('button', { name: /^Credits/ }).click(); await ledger().waitFor(); };
  const form = async (invoice, amount) => {
    await click('Record credit'); await page.getByRole('combobox', { name: 'Credit status', exact: true }).selectOption('applied');
    await page.getByRole('textbox', { name: 'Credit invoice reference', exact: true }).fill(invoice);
    await page.getByRole('textbox', { name: 'Credit line identity', exact: true }).fill('line-01');
    await page.getByRole('textbox', { name: 'Credit amount', exact: true }).fill(amount);
    await page.getByRole('textbox', { name: 'Initial credit attribution', exact: true }).fill(amount);
    await page.getByRole('textbox', { name: 'Supporting credit source text', exact: true }).fill(`SYNTHETIC supplied invoice ${invoice} applies USD ${amount} for NR-CREDIT-2026. No external settlement is asserted.`);
    await ledger().getByRole('button', { name: 'Review change', exact: true }).click(); await page.getByRole('region', { name: 'Credit change preview', exact: true }).waitFor();
  };
  const moneyIs=(text,cents)=>/^\$[\d,]+(?:\.\d{2})?$/.test(text.trim())&&Math.round(Number(text.trim().replace(/[$,]/g,''))*100)===cents;
  const caseAmount=async label=>{const note=detail().locator('.financial-record-details');if(!await note.evaluate(node=>node.open))await note.locator(':scope > summary').click();return note.locator('.case-financial-ledger > div').filter({has:page.locator('dt',{hasText:new RegExp(`^${label}$`)})}).locator('dd').innerText();};
  const amount = expected => detail().locator('.assurance-amount > strong').getByText(expected.replace(/\.00$/, ''), { exact: true }).waitFor();
  const role = async value => {
    const options = page.locator('.workspace-options'); if (!await options.evaluate(node => node.open)) await options.locator(':scope > summary').click();
    await page.getByRole('combobox', { name: 'Demo actor role', exact: true }).selectOption(value);
    await page.waitForFunction(value => { const node = document.querySelector('[aria-label="Demo actor role"]'); return node && node.value === value && !node.disabled; }, value);
    await page.keyboard.press('Escape'); await page.getByRole('heading', { name: 'Cases', level: 1, exact: true }).waitFor();
  };
  const chooseClarity = async (id = 'clarity-a') => {
    const heading = detail().getByRole('heading', { name: 'Clarity Labs', exact: true });
    if (!await heading.isVisible().catch(() => false) || new URL(page.url()).searchParams.get('case') !== id) {
      const back = page.getByRole('button', { name: 'Back to cases', exact: true }); if (await back.isVisible().catch(() => false)) await back.click();
      const search = page.getByRole('textbox', { name: 'Search follow-ups', exact: true }); await search.fill('Clarity Labs');
      await page.locator(`.portfolio-row:visible[data-case="${id}"]`).click();
    }
    await showCredits();
    const resolution = ledger().locator('.credit-resolution'); if (!await resolution.evaluate(node => node.open)) await resolution.locator(':scope > summary').click();
    return resolution;
  };

  const exportPacket = async (stage = 'completed') => {
    await page.evaluate(() => { if (window.__creditRecoveryDownloads) return; const original = URL.createObjectURL; window.__creditRecoveryDownloads = { original, blobs: new Map() }; URL.createObjectURL = function(blob) { const address = original.call(URL, blob); window.__creditRecoveryDownloads.blobs.set(address, blob); return address; }; });
    const options = page.locator('.workspace-options'); if (!await options.evaluate(node => node.open)) await options.locator(':scope > summary').click();
    const pending = page.waitForEvent('download'); await click('Export records'); const file = await pending;
    await file.saveAs(`output/playwright/${mode}-credit-${stage}.json`);
    const text = await page.evaluate(address => window.__creditRecoveryDownloads.blobs.get(address).text(), file.url());
    await page.keyboard.press('Escape'); return JSON.parse(text);
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${base}/?view=assurance`);
    await page.getByRole('heading', { name: 'Cases', level: 1, exact: true }).waitFor();
    await page.locator('.product-root[data-runtime="server"], .product-root[data-runtime="browser"]').waitFor(); mode = await page.locator('.product-root').getAttribute('data-runtime');
    await chooseNorthstar(); await amount('$250.00'); await showCredits();
    assert(await ledger().locator('.ledger-credit').count() === 1 && (await ledger().locator('.ledger-credit').innerText()).includes('NR-MEMO-001'), 'Recovery starts with exactly the one conserved physical credit from the UI lifecycle');
    assert(moneyIs(await caseAmount('Accepted amount'),40000) && moneyIs(await caseAmount('Applied to invoices'),15000), 'Recovery starts from the accepted400/applied150/outstanding250 agreement');
    await form('NR-RECOVERY-001', '10');
    if (mode === 'server') {
      failedWrite = intercepted => intercepted.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_UNAVAILABLE', message: 'The local ledger is temporarily unavailable.' } }) });
      await page.route('**/api/batch', failedWrite);
      try {
        await confirm().click(); await page.locator('.credit-error').getByText('The local ledger is temporarily unavailable.', { exact: true }).waitFor(); await amount('$250.00');
        assert(await ledger().locator('.ledger-credit').count() === 1, 'Failed service writes leave no orphan credit or partial attribution');
        assert(await page.getByRole('textbox', { name: 'Credit invoice reference', exact: true }).inputValue() === 'NR-RECOVERY-001', 'A failed write retains the exact evidence draft for recovery');
        assert(await page.getByRole('region', { name: 'Credit change preview', exact: true }).count() === 0, 'A failed write requires another current preview');
      } finally { await page.unroute('**/api/batch', failedWrite); failedWrite = null; }
      await ledger().getByRole('button', { name: 'Review change', exact: true }).click();
      await page.getByRole('region', { name: 'Credit change preview', exact: true }).waitFor();
    }
    let requests = 0;
    if (mode === 'server') { delayedWrite = async intercepted => { requests++; await new Promise(resolve => setTimeout(resolve, 250)); await intercepted.continue(); }; await page.route('**/api/batch', delayedWrite); }
    try {
      await confirm().dblclick(); await ledger().locator('.credit-success').waitFor(); await amount('$240.00');
      if (mode === 'server') assert(requests === 1, 'A double click produces exactly one atomic credit write');
    } finally { if (delayedWrite) { await page.unroute('**/api/batch', delayedWrite); delayedWrite = null; } }
    assert(await ledger().locator('.ledger-credit').count() === 2, 'Recovery records exactly one physical credit line');
    await form('NR-CLOSE-001', '240'); await confirm().click(); await amount('$0.00');
    assert(moneyIs(await caseAmount('Accepted amount'),40000) && moneyIs(await caseAmount('Applied to invoices'),40000), 'The operator can fulfill the accepted promise entirely through checked forms');
    assert((await detail().locator('.case-next-action').innerText()).includes('The full credit is on an invoice'), 'The completed case leads to truthful fulfillment inspection rather than another claim');
    await page.reload(); await page.getByRole('heading', { name: 'Cases', level: 1, exact: true }).waitFor(); await chooseNorthstar(); await amount('$0.00');
    assert(true, 'Completed fulfillment persists after reload');
    packet = await exportPacket(); const current = packet.view.commitments.find(c => c.reference === 'NR-CREDIT-2026');
    const physical = packet.view.credits.filter(c => c.vendorId === current.vendorId), first = physical.find(c => c.invoiceId === 'NR-MEMO-001');
    assert(current.originalPromisedCents === 35000 && current.promisedCents === 40000 && current.verifiedCents === 40000 && current.outstandingCents === 0 && current.status === 'verified', 'The actual completion packet preserves original350/accepted400/applied400/outstanding0');
    assert(physical.length === 3 && first.amountCents === 30000 && first.reversedCents === 15000 && first.allocatedCents === 15000 && first.allocations.length === 2, 'The completion packet conserves all three physical lines and the original causal reversal');
    assert(packet.mode === mode && packet.invariantCheck.valid === true, 'The actual downloaded completion packet identifies its runtime and passes financial invariants');
    await showCredits(); await page.screenshot({ path: `output/playwright/${mode}-credit-completed.png`, fullPage: true });
    // This is the existing Clarity fixture from the expanded-workspace journey. Setup
    // uses the product's checked command console; all clarification, approval and
    // assignment operations below use the normal visible financial forms.
    await role('admin');
    await page.locator('.followups-more > summary').click(); await click('Run checks');
    await page.locator('.command-console > summary').click();
    const commands = [
      { type: 'ADD_VENDOR', vendor: { id: 'clarity', name: 'Clarity Labs' } },
      { type: 'ADD_SOURCE', source: { id: 'clarity-promise', vendorId: 'clarity', kind: 'email', title: 'Shared-reference promises', text: 'SYNTHETIC: CLR-SHARED-2026 contains a USD 100 primary and USD 200 supplemental promise. Explicit assignment is required.' } },
      ...['a', 'b'].map((id, index) => ({ type: 'CREATE_COMMITMENT', commitment: { id: `clarity-${id}`, vendorId: 'clarity', reference: 'CLR-SHARED-2026', currency: 'USD', promisedCents: index ? 20000 : 10000, dueDate: '2026-11-01', conditions: [], sourceIds: ['clarity-promise'] } })),
      { type: 'ADD_SOURCE', source: { id: 'clarity-invoice', vendorId: 'clarity', kind: 'invoice', title: 'Clarity invoice with unresolved attribution', text: 'SYNTHETIC INV-CLR-001 line shared USD 300 applied to CLR-SHARED-2026, not yet assigned. Separate line orphan USD 50 has reference CLR-UNMATCHED-2026.' } },
      ...['shared', 'orphan'].map((line, index) => ({ type: 'REGISTER_CREDIT', credit: { id: `clarity-credit-${line}`, vendorId: 'clarity', invoiceId: 'INV-CLR-001', lineId: line, reference: index ? 'CLR-UNMATCHED-2026' : 'CLR-SHARED-2026', currency: 'USD', amountCents: index ? 5000 : 30000, status: 'applied', sourceIds: ['clarity-invoice'] } })),
    ];
    await page.getByRole('textbox', { name: 'Structured command', exact: true }).fill(JSON.stringify(commands)); await click('Run command');
    await page.locator('.command-result.allowed').waitFor();
    assert(true, 'The existing shared-reference Clarity fixture is created through the checked UI command boundary');
    await page.getByRole('group', { name: 'Follow-up views', exact: true }).getByRole('button', { name: 'Conversations', exact: true }).click();
    let resolution = await chooseClarity(); await amount('$100.00');
    assert(await resolution.getByRole('textbox', { name: /^Maximum assignment USD for clarity-/ }).count() === 2, 'Ambiguous credit exposes both exact candidate follow-up identities');
    assert(await ledger().locator('.ledger-credit').getByRole('button', { name: 'Assign to follow-up', exact: true }).isDisabled(), 'Unresolved identity prevents assigning the shared physical credit');
    await role('analyst'); resolution = await chooseClarity();
    await resolution.locator('.credit-resolution-evidence > summary').click();
    const clarification = 'SYNTHETIC issuer clarification: INV-CLR-001 shared line under CLR-SHARED-2026 may fund clarity-a up to USD 100 and clarity-b up to USD 200. No other reference is authorized.';
    await resolution.getByLabel('Clarification title', { exact: true }).fill('Explicit Clarity assignment');
    await resolution.getByLabel('Clarification document text', { exact: true }).fill(clarification);
    await click('Review clarification'); const review = page.getByRole('region', { name: 'Credit resolution preview', exact: true }); await review.waitFor();
    await review.locator('.credit-resolution-source > summary').click();
    const bound = (await review.locator('.credit-resolution-source').innerText()).match(/Bound revision (\d+)/);
    assert(Boolean(bound), 'Clarification review identifies the exact source revision to be recorded');
    const revision = Number(bound[1]); await click('Record clarification'); await resolution.locator('.credit-resolution-notice').waitFor();
    assert((await resolution.innerText()).includes('An approver can now') && await ledger().locator('.ledger-credit').getByRole('button', { name: 'Assign to follow-up', exact: true }).isDisabled(), 'Analyst clarification records evidence without resolving ownership or assigning money');
    assert(await resolution.getByRole('button', { name: 'Review assignment limits', exact: true }).isDisabled(), 'Analyst cannot approve credit ownership limits');
    await amount('$100.00');
    await role('approver'); resolution = await chooseClarity();
    const selectClarification = async () => {
      await resolution.getByRole('combobox', { name: 'Clarification document', exact: true }).selectOption({ label: `Explicit Clarity assignment · Revision ${revision}` });
      const source = resolution.locator('.credit-resolution-assignment .credit-resolution-source'); await source.locator(':scope > summary').click();
      assert((await source.locator('blockquote').innerText()) === clarification && (await source.innerText()).includes(`Bound revision ${revision}`), 'Approver inspects the exact analyst clarification text and revision');
    };
    await selectClarification();
    await resolution.getByRole('textbox', { name: 'Maximum assignment USD for clarity-a', exact: true }).fill('100.01');
    await resolution.getByRole('textbox', { name: 'Maximum assignment USD for clarity-b', exact: true }).fill('200');
    await resolution.getByRole('button', { name: 'Review assignment limits', exact: true }).click();
    await resolution.locator('.credit-resolution-error').getByText(/exceed/).waitFor(); await amount('$100.00');
    assert(true, 'Assignment limits above the shared credit capacity are refused without a financial effect');
    await resolution.getByRole('textbox', { name: 'Maximum assignment USD for clarity-a', exact: true }).fill('100');
    await resolution.getByRole('button', { name: 'Review assignment limits', exact: true }).click(); await review.waitFor();
    await role('viewer'); resolution = await chooseClarity();
    assert(await page.getByRole('region', { name: 'Credit resolution preview', exact: true }).count() === 0 && await resolution.getByRole('button', { name: 'Review assignment limits', exact: true }).isDisabled(), 'Viewer handoff discards the ownership preview and cannot approve assignment limits');
    await role('approver'); resolution = await chooseClarity();
    assert(await page.getByRole('region', { name: 'Credit resolution preview', exact: true }).count() === 0, 'Returning to approver cannot revive the discarded assignment-limit preview');
    await selectClarification();
    await resolution.getByRole('textbox', { name: 'Maximum assignment USD for clarity-a', exact: true }).fill('100');
    await resolution.getByRole('textbox', { name: 'Maximum assignment USD for clarity-b', exact: true }).fill('200');
    await resolution.getByRole('button', { name: 'Review assignment limits', exact: true }).click(); await review.waitFor();
    assert((await review.innerText()).includes('changes by $0.00'), 'Ownership resolution preview creates no applied or assigned credit automatically');
    await review.getByRole('button', { name: 'Record assignment limits', exact: true }).click();
    await resolution.locator('.credit-resolution-notice').getByText(/Assignment limits recorded/).waitFor(); await amount('$100.00');
    assert((await ledger().locator('.credit-record-amounts').innerText()).includes('$300.00'), 'Approver resolution releases quarantine while preserving the original credit balance');
    await role('analyst'); resolution = await chooseClarity();
    await ledger().locator('.ledger-credit').getByRole('button', { name: 'Assign to follow-up', exact: true }).click();
    await page.getByRole('textbox', { name: 'Credit amount', exact: true }).fill('100.01');
    await page.getByRole('textbox', { name: 'Supporting credit source text', exact: true }).fill('SYNTHETIC attempt to exceed clarity-a limit; must refuse.');
    await ledger().getByRole('button', { name: 'Review change', exact: true }).click(); await page.locator('.credit-error').getByText(/resolution limit/).waitFor(); await amount('$100.00');
    assert(true, 'Analyst assignment stays constrained by the approver limit even when the physical line has more capacity');
    await page.getByRole('textbox', { name: 'Credit amount', exact: true }).fill('100');
    await ledger().getByRole('button', { name: 'Review change', exact: true }).click(); await page.getByRole('region', { name: 'Credit change preview', exact: true }).waitFor(); await click('Record assignment');
    await ledger().locator('.credit-success').waitFor(); await amount('$0.00');
    assert((await detail().locator('.case-next-action').innerText()).includes('The full credit is on an invoice'), 'Legitimate assignment fulfills only the selected authorized promise');
    await detail().locator('.case-next-action').getByRole('button', { name: 'View history', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'Recorded history', exact: true }).isVisible(), 'Fulfillment inspection opens actual history without preparing another claim');
    await showCredits(); resolutionPacket = await exportPacket('resolved');
    const shared = resolutionPacket.view.credits.find(c => c.id === 'clarity-credit-shared');
    const orphan = resolutionPacket.view.credits.find(c => c.id === 'clarity-credit-orphan');
    assert(shared.availableCents === 30000 && shared.allocatedCents === 10000 && shared.unallocatedCents === 20000 && !shared.quarantined, 'Downloaded resolution evidence conserves physical300/assigned100/unassigned200');
    assert(shared.resolution.assignments.find(row => row.commitmentId === 'clarity-a').limitCents === 10000 && shared.resolution.assignments.find(row => row.commitmentId === 'clarity-b').limitCents === 20000, 'Downloaded resolution retains the exact separate100/200 assignment limits');
    assert(shared.resolution.sourceLinks.some(link => link.revision === revision) && orphan.quarantined && orphan.unallocatedCents === 5000, 'Exact clarification revision is retained while the unmatched orphan remains quarantined and unassigned');
    assert(resolutionPacket.view.commitments.find(c => c.id === 'clarity-a').verifiedCents === 10000 && resolutionPacket.view.commitments.find(c => c.id === 'clarity-b').verifiedCents === 0, 'Resolving one case never fabricates fulfillment of the other candidate');
    await page.screenshot({ path: `output/playwright/${mode}-credit-resolved.png`, fullPage: true });
    await page.reload(); await page.getByRole('heading', { name: 'Cases', level: 1, exact: true }).waitFor(); await chooseClarity(); await amount('$0.00');
    assert((await ledger().locator('.credit-record-amounts').innerText()).includes('$200.00'), 'Resolved identity, explicit bounds and remaining credit survive reload');
    assert(pageErrors.length === 0, 'Credit write recovery and fulfillment have no uncaught browser exceptions');
  } catch (error) { failure = error; errors.push(error.message); await page.screenshot({ path: `output/playwright/${mode || 'unknown'}-credit-recovery-failure.png`, fullPage: true }).catch(() => {}); }
  finally {
    if (failedWrite) await page.unroute('**/api/batch', failedWrite).catch(() => {});
    if (delayedWrite) await page.unroute('**/api/batch', delayedWrite).catch(() => {});
    page.off('pageerror', onError);
    await page.evaluate(() => { const capture = window.__creditRecoveryDownloads; if (capture) { URL.createObjectURL = capture.original; delete window.__creditRecoveryDownloads; } }).catch(() => {});
  }
  errors.push(...pageErrors.map(message => `Browser: ${message}`));
  const result = { base, mode, ok: !failure && errors.length === 0, passed: checks.length, checks, errors, pageErrors, packet, resolutionPacket, precondition: 'Run browser-credit-workflow-check.js first in this same demo database/browser-local profile. No direct API fixture writes are used.' };
  const artifact = page.waitForEvent('download'); await page.evaluate(value => { const link = document.createElement('a'), address = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); link.href = address; link.download = 'credit-recovery-result.json'; link.click(); setTimeout(() => URL.revokeObjectURL(address), 1000); }, result);
  await (await artifact).saveAs('output/playwright/credit-recovery-result.json');
  return { base, mode, ok: result.ok, passed: result.passed, checks, errors };
}
