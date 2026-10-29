async (page) => {
  await page.setViewportSize({width:1440,height:960});
  await page.getByRole('button',{name:'Assurance',exact:true}).click();
  await page.getByText(/^(Local SQLite service|Browser workspace)$/).waitFor();
  await page.getByRole('combobox',{name:'Demo actor role'}).selectOption('admin');
  await page.getByRole('button',{name:'Reset demo workspace',exact:true}).click();
  await page.getByRole('button',{name:'Confirm reset',exact:true}).click();
  await page.getByRole('button',{name:'Portfolio',exact:true}).click();
  const evidence=[];
  for(const surface of ['assurance','decision','lab']){
    if(surface==='decision'){
      await page.getByRole('button',{name:/^Decision room/}).click();
      await page.locator('.decision-row').filter({hasText:'Pipeline CRM'}).filter({hasText:'Accept proposed amendment'}).click();
    }
    if(surface==='lab'){
      await page.getByRole('button',{name:'Failure lab',exact:true}).click();
      await page.getByRole('button',{name:'Run all cases',exact:true}).click();
      await page.getByText('9/9 authored cases passed',{exact:true}).waitFor();
    }
    for(const [label,width,height] of [['desktop',1440,960],['mobile',390,844]]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(300);
      await page.screenshot({path:`.impeccable/review/${surface}-${label}.png`,fullPage:true});
      evidence.push({surface,viewport:label,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,statusSizes:[...document.querySelectorAll('.assurance-status,.portfolio-row small,.case-financial-ledger span,.lineage-node small,.record-meta')].map(e=>getComputedStyle(e).fontSize)}))});
    }
    await page.setViewportSize({width:1440,height:960});
  }
  await page.getByRole('button',{name:'Portfolio',exact:true}).click();
  return evidence;
}
