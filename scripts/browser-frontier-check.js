async page=>{
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const require=(condition,message)=>{if(!condition)throw new Error(message);checks.push(message);};
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await page.setViewportSize({width:1440,height:960});
 await click('Assurance');await page.getByRole('combobox',{name:'Demo actor role'}).selectOption('admin');
 await click('Reset demo workspace');await click('Confirm reset');await click('Execution lab');
 await click('Explore schedules');await page.getByText('Unsafe effect found',{exact:true}).waitFor();
 require((await page.locator('.execution-result-heading').first().innerText()).includes('4 steps'),'BFS retains the four-step unsafe credit witness');
 await page.locator('.trace-program button').filter({hasText:'Unsafe effect'}).click();
 require((await page.getByRole('region',{name:'Selected transition'}).innerText()).includes('$1,800.00'),'Unsafe reference trace actually overallocates one $900 credit to $1,800');
 await page.locator('.search-verdict').nth(1).click();await page.locator('.trace-program button').last().click();
 require((await page.getByRole('region',{name:'Selected transition'}).innerText()).includes('INSUFFICIENT_CREDIT'),'The actual reducer rejects the raced second allocation');
 await click('Replay report');await page.getByText('Report, trace, and bounded search replay agree.',{exact:true}).waitFor();
 const witness=page.waitForEvent('download');await click('Export witness');await(await witness).saveAs('output/playwright/frontier-exploration.json');
 checks.push('Exploration witness replays and downloads from the real UI');
 await click('Inspect repaired plan');
 require((await page.locator('.exploration-search-facts').innerText()).includes('2/2'),'Atomic repair preserves both distinct intents and completes safely in both orders');
 await page.getByRole('combobox',{name:'Exploration state budget'}).selectOption('10');await click('Explore schedules');
 await page.locator('.search-verdict.inconclusive').first().waitFor();
 require(await page.locator('.search-verdict.safe').count()===0,'A resource cutoff is inconclusive rather than a green safety claim');
 await page.getByRole('combobox',{name:'Exploration state budget'}).selectOption('2000');
 await page.getByRole('combobox',{name:'Exploration scenario'}).selectOption('deadline-drift');await click('Explore schedules');await click('Inspect repaired plan');
 require((await page.locator('.exploration-search-facts').innerText()).includes('1/2'),'Deadline repair retains the losing clock order and reports partial completion');
 require(await page.getByText(/Some allowed schedules do not finish/).isVisible(),'Unfinished legitimate work is explicit');
 await page.getByText('Inspect or edit the proposed program',{exact:true}).click();await click('Edit scenario JSON');
 const editor=page.getByRole('textbox',{name:'Finite scenario JSON'}),plan=JSON.parse(await editor.inputValue());plan.name='Edited deadline program';await editor.fill(JSON.stringify(plan));
 await click('Explore schedules');await page.getByText(/No automatic repair is defined for this custom program/).waitFor();
 checks.push('Edited custom JSON executes without inventing a template repair');
 await page.getByRole('tab',{name:'Race explorer',exact:true}).focus();await page.keyboard.press('End');
 require(await page.getByRole('tab',{name:'Signed authority',exact:true}).getAttribute('aria-selected')==='true','Execution tabs support End navigation');
 await page.getByText(/^(SQLite execution boundary|Isolated browser authority)$/).waitFor();
 const mode=await page.getByText(/^(SQLite execution boundary|Isolated browser authority)$/).innerText();
 await click('Prepare fresh action');await click('Approve exact action');await click('Issue signed grant');
 await page.getByText('Issued; current checks still apply',{exact:true}).waitFor();
 checks.push('Actual finance approval issues an Ed25519 grant to an ephemeral agent key');
 await page.getByText('Delegate a narrower scope',{exact:true}).click();await click('Delegate to worker');
 require((await page.locator('.authority-scope-facts').innerText()).includes('Delegation depth\n1'),'A signed child delegation narrows the parent lifetime');
 await click('Record delegated action');await page.getByText('Verifier-signed receipt recorded.',{exact:true}).waitFor();
 const receiptText=await page.locator('.authority-receipt').innerText();
 await click('Retry identical request');
 require(await page.locator('.authority-receipt').innerText()===receiptText,'Exact idempotent retry returns the same receipt and revision');
 if(mode==='SQLite execution boundary'){
  await page.evaluate(async()=>{
   const session=await fetch('/api/session').then(r=>r.json()),snapshot=await fetch('/api/workspace').then(r=>r.json());
   const suffix=crypto.randomUUID(),sourceId=`external-${suffix}`,creditId=`external-credit-${suffix}`;
   const response=await fetch('/api/batch',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedRevision:snapshot.revision,commands:[
    {type:'ADD_SOURCE',source:{id:sourceId,vendorId:'pipeline',title:'Synthetic other-tab invoice',kind:'invoice',text:'SYNTHETIC: another tab records USD100 applied for PC-SEATS-2026 on a new invoice.'}},
    {type:'REGISTER_CREDIT',credit:{id:creditId,invoiceId:`EXTERNAL-${suffix}`,lineId:'one',vendorId:'pipeline',currency:'USD',reference:'PC-SEATS-2026',amountCents:10000,status:'applied',sourceIds:[sourceId]}},
    {type:'ALLOCATE_CREDIT',allocationId:`external-allocation-${suffix}`,creditId,commitmentId:'pipeline-seats',amountCents:10000}
   ]})});if(!response.ok)throw new Error('External-tab fixture write failed.');
  });
  await click('Retry identical request');
  await page.locator('.authority-financial-context').getByText('$1,400.00',{exact:true}).waitFor();
  require((await page.locator('.authority-financial-context').innerText()).includes('$1,400.00'),'Historical receipt retry refreshes current state instead of restoring an old snapshot');
  require(await page.locator('.authority-receipt').innerText()===receiptText,'Historical receipt identity remains unchanged after an independent ledger write');
 }
 await click('Attempt another execution');await page.getByRole('alert').filter({hasText:'AUTHORITY_CONSUMED'}).waitFor();
 checks.push('A fresh attempt cannot consume the root nonce twice');
 const trust=page.waitForEvent('download');await click('Download public trust key');await(await trust).saveAs('output/playwright/frontier-trust.json');
 const packet=page.waitForEvent('download');await click('Export signed evidence');await(await packet).saveAs('output/playwright/frontier-authority.json');
 await click('Verify signed packet');await page.getByText('Verification rejected this packet.',{exact:true}).waitFor();
 checks.push('A bundled key is not automatically trusted');
 await click('Pin this demo issuer');await click('Verify signed packet');await page.getByText('Pinned signatures and recorded effects verify.',{exact:true}).waitFor();
 checks.push('Pinned issuer verification checks the actual signed lifecycle and financial effect');
 await click('Alter checkpoint signature');await click('Verify signed packet');await page.getByText('Verification rejected this packet.',{exact:true}).waitFor();
 checks.push('Actual signature mutation fails cryptographic verification');
 await click('Prepare fresh action');await click('Approve exact action');await click('Issue signed grant');
 await page.getByText('Issued; current checks still apply',{exact:true}).waitFor();await click('Revoke root grant');await click('Record delegated action');
 await page.getByRole('alert').filter({hasText:'AUTHORITY_REVOKED'}).waitFor();checks.push('Current root revocation blocks execution');
 await click('Prepare fresh action');await click('Approve exact action');await click('Issue signed grant');await click('Revise supporting source');await click('Record delegated action');
 await page.getByRole('alert').filter({hasText:'STALE_APPROVAL'}).waitFor();checks.push('A source revision makes the signed action authorization unusable');
 require(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop execution lab has no horizontal overflow');
 await page.setViewportSize({width:390,height:844});require(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile signed-authority workflow has no horizontal overflow');
 await page.getByRole('tab',{name:'Race explorer',exact:true}).click();require(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile counterexample explorer has no horizontal overflow');
 await page.setViewportSize({width:1440,height:960});
 require(errors.length===0,`No browser runtime exceptions: ${errors.join('; ')}`);
 return {mode,passed:checks.length,checks};
}
