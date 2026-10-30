async page=>{
 await page.setViewportSize({width:1440,height:960});
 await page.getByRole('button',{name:'Assurance',exact:true}).click();
 await page.getByRole('button',{name:'Reset demo workspace',exact:true}).click();await page.getByRole('button',{name:'Confirm reset',exact:true}).click();
 await page.getByRole('button',{name:'Execution lab',exact:true}).click();
 await page.getByRole('button',{name:'Explore schedules',exact:true}).click();await page.locator('.trace-program button').filter({hasText:'Unsafe effect'}).click();
 const evidence=[];
 for(const surface of ['race','authority']){
  if(surface==='authority'){
   await page.getByRole('tab',{name:'Signed authority',exact:true}).click();
   for(const name of ['Prepare fresh action','Approve exact action','Issue signed grant','Record delegated action','Export signed evidence','Pin this demo issuer','Verify signed packet'])await page.getByRole('button',{name,exact:true}).click();
   await page.getByText('Pinned signatures and recorded effects verify.',{exact:true}).waitFor();
  }
  for(const [label,width,height] of [['desktop',1440,960],['mobile',390,844]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);
   await page.screenshot({path:`.impeccable/review/${surface}-${label}.png`,fullPage:true});
   evidence.push({surface,viewport:label,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,heading:document.querySelector('h1')?.textContent}))});
  }
  await page.setViewportSize({width:1440,height:960});
 }
 return evidence;
}
