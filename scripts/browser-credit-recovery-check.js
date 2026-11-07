async page => {
  const checks=[],base=new URL(page.url()).origin;
  const assert=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
  const click=name=>page.getByRole('button',{name,exact:true}).click();
  const ledger=page.getByRole('region',{name:'Credit fulfillment workspace'});
  const confirm=()=>page.getByRole('region',{name:'Credit change preview'}).getByRole('button',{name:'Record applied credit',exact:true});
  const form=async(invoice,amount)=>{await click('Record credit');await page.getByRole('combobox',{name:'Credit status'}).selectOption('applied');await page.getByRole('textbox',{name:'Credit invoice reference'}).fill(invoice);await page.getByRole('textbox',{name:'Credit line identity'}).fill('line-01');await page.getByRole('textbox',{name:'Credit amount',exact:true}).fill(amount);await page.getByRole('textbox',{name:'Initial credit attribution'}).fill(amount);await page.getByRole('textbox',{name:'Supporting credit source text'}).fill(`SYNTHETIC supplied invoice ${invoice} applies USD ${amount} for NR-CREDIT-2026. No external settlement is asserted.`);await click('Preview credit change');await page.getByRole('region',{name:'Credit change preview'}).waitFor();};
  const amount=expected=>page.locator('.assurance-amount>strong').getByText(expected,{exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1000});await page.goto(base);await page.locator('.portfolio-row').filter({hasText:'Northstar Review'}).click();await amount('$250.00');await click('Shared ledger');
  const server=await page.locator('.runtime-indicator.server').count()>0;
  await form('NR-RECOVERY-001','10');
  if(server) {
  await page.route('**/api/batch',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEST_UNAVAILABLE',message:'The local ledger is temporarily unavailable.'}})}));
  try {
    await confirm().click();await page.locator('.credit-error').getByText('The local ledger is temporarily unavailable.',{exact:true}).waitFor();await amount('$250.00');
    assert(await ledger.locator('.ledger-credit').count()===1,'Failed service writes leave no orphan credit or partial attribution');
    assert(await page.getByRole('textbox',{name:'Credit invoice reference'}).inputValue()==='NR-RECOVERY-001','A failed write retains the exact evidence draft for recovery');
    assert(await page.getByRole('region',{name:'Credit change preview'}).count()===0,'A failed write requires another current preview');
  } finally { await page.unroute('**/api/batch'); }
  }
  await click('Preview credit change');let requests=0;
  if(server)await page.route('**/api/batch',async route=>{requests++;await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
  try { await confirm().dblclick();await ledger.getByRole('status').waitFor();await amount('$240.00');if(server)assert(requests===1,'A double click produces exactly one atomic credit write'); }
  finally { await page.unroute('**/api/batch'); }
  assert(await ledger.locator('.ledger-credit').count()===2,'Recovery records exactly one physical credit line');
  await form('NR-CLOSE-001','240');await confirm().click();await amount('$0.00');
  assert((await page.locator('.case-financial-ledger').innerText()).includes('$400.00'),'The operator can fulfill the accepted promise entirely through checked forms');
  await page.reload();await page.locator('.portfolio-row').filter({hasText:'Northstar Review'}).click();await amount('$0.00');assert(true,'Completed fulfillment persists after reload');
  await page.locator('.workspace-options>summary').click();const packet=page.waitForEvent('download');await click('Export audit packet');await(await packet).saveAs('output/playwright/credit-completed.json');await page.keyboard.press('Escape');
  return {base,passed:checks.length,checks};
}
