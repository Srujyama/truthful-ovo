async page=>{
 const checks=[];
 await page.goto('http://127.0.0.1:5173/');
 await page.getByRole('combobox',{name:'Exploration scenario'}).selectOption('portfolio:action-pipeline-preserve');
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 for(const change of ['budget','editor']){
  await page.getByRole('combobox',{name:'Exploration state budget'}).selectOption('2000');
  let arrive,release;const arrived=new Promise(r=>arrive=r),held=new Promise(r=>release=r);
  await page.route('**/api/workspace',async route=>{const response=await route.fetch();arrive();await held;await route.fulfill({response});},{times:1});
  await click('Explore schedules');await Promise.race([arrived,page.waitForTimeout(10000).then(()=>{throw new Error('Portfolio refresh did not arrive');})]);
  if(change==='budget')await page.getByRole('combobox',{name:'Exploration state budget'}).selectOption('300');
  else{await page.locator('.execution-plan summary').click();await click('Edit scenario JSON');}
  const responded=page.waitForResponse(r=>r.url().endsWith('/api/workspace'));release();await responded;await page.waitForTimeout(750);
  if(await page.locator('.trace-workbench').count())throw new Error('Superseded '+change+' run retained result');
  if(await page.getByText('Not explored',{exact:true}).count()!==2)throw new Error('Superseded '+change+' run retained verdict');
  if(await page.getByRole('button',{name:'Explore schedules',exact:true}).isDisabled())throw new Error('Cancelled run left busy flag');
  checks.push('Changing '+change+' during held server refresh discards the superseded result and clears busy');
 }
 return{passed:checks.length,checks};
}
