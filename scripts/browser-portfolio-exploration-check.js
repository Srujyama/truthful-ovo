async page=>{
 const checks=[];const assert=(condition,label)=>{if(!condition)throw new Error(label);checks.push(label);};
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await page.setViewportSize({width:1440,height:960});await click('Assurance');
 await page.getByRole('combobox',{name:'Demo actor role'}).selectOption('admin');await click('Reset demo workspace');await click('Confirm reset');
 await page.getByRole('button',{name:/^Decision room/}).click();await page.locator('.decision-row').filter({hasText:'Pipeline CRM'}).filter({hasText:'Preserve original terms'}).click();await click('Approve exact action');
 await page.getByRole('button',{name:'Record approved action',exact:true}).waitFor();
 const before=await page.evaluate(async()=>{
  if(location.port==='5173'){const result=await fetch('/api/workspace').then(r=>r.json());return JSON.stringify(result.workspace);}
  return localStorage.getItem('truthful.assurance.v1');
 });
 await click('Execution lab');
 await page.getByRole('combobox',{name:'Exploration scenario'}).selectOption('portfolio:action-pipeline-preserve');await click('Explore schedules');
 await page.locator('.portfolio-snapshot-note').waitFor();
 assert((await page.locator('.portfolio-snapshot-note').innerText()).includes('PC-SEATS-2026'),'Exploration retains the actual selected portfolio reference');
 assert((await page.locator('.exploration-search-facts').innerText()).includes('1/1'),'The unchanged actual approval safely completes in its copied model');
 await page.getByRole('combobox',{name:'Portfolio simulated adversary'}).selectOption('source_revision');await click('Explore schedules');
 await page.getByText('Unsafe effect found',{exact:true}).waitFor();
 assert((await page.locator('.execution-result-heading').first().innerText()).includes('3 steps'),'An actual portfolio basis yields a three-step hypothetical stale-source counterexample');
 await page.locator('.trace-program button').last().click();
 assert((await page.getByRole('region',{name:'Selected transition'}).innerText()).includes('STALE_APPROVAL'),'Copied approval is checked by the real reducer after the hypothetical revision');
 await click('Replay report');await page.getByText('Report, trace, and bounded search replay agree.',{exact:true}).waitFor();checks.push('A portfolio-derived report replays as a portable contained scenario');
 const after=await page.evaluate(async()=>{
  if(location.port==='5173'){const result=await fetch('/api/workspace').then(r=>r.json());return JSON.stringify(result.workspace);}
  return localStorage.getItem('truthful.assurance.v1');
 });
 assert(before===after,'Exploration creates no live approval, event, source revision or financial change');
 await page.getByRole('combobox',{name:'Portfolio simulated adversary'}).selectOption('deadline');
 await page.getByRole('alert').filter({hasText:/Deadline exploration requires|no recorded claim deadline/}).waitFor();
 assert(await page.getByRole('button',{name:'Explore schedules',exact:true}).isDisabled(),'A missing/inapplicable actual deadline is not invented');
 await page.getByRole('combobox',{name:'Portfolio simulated adversary'}).selectOption('source_revision');await click('Explore schedules');await page.getByText('Unsafe effect found',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Portfolio-derived exploration has no mobile horizontal overflow');
 await page.setViewportSize({width:1440,height:960});return{passed:checks.length,checks};
}
