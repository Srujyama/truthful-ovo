async page => {
  const checks=[],errors=[];
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const onError=error=>errors.push(error.message);
  page.on('pageerror',onError);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.assurance-case').waitFor({state:'visible'});
  await page.locator('.workspace-options>summary').click();
  await page.getByRole('combobox',{name:'Demo actor role'}).selectOption('admin');
  await page.waitForFunction(()=>{const n=document.querySelector('[aria-label="Demo actor role"]');return n.value==='admin'&&!n.disabled;});
  const before=await page.locator('.assurance-case').innerText();
  await page.route('**/api/demo/reset',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEST_UNAVAILABLE',message:'Local reset temporarily unavailable.'}})}));
  try{
    await page.getByRole('button',{name:'Reset demo workspace',exact:true}).click();
    await page.getByRole('button',{name:'Confirm reset',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Local reset temporarily unavailable.'}).waitFor();
    checks.push('Reset service failure is reported in the interface');
    assert(before===await page.locator('.assurance-case').innerText(),'A failed reset leaves the visible financial record unchanged');
    assert(errors.length===0,'Reset failure produces no unhandled browser exception');
    await page.locator('.workspace-options>summary').click();
    assert(await page.getByRole('button',{name:'Reset demo workspace',exact:true}).isEnabled(),'Reset remains available for an explicit retry');
    await page.keyboard.press('Escape');
  }finally{await page.unroute('**/api/demo/reset');page.off('pageerror',onError);}
  return {passed:checks.length,checks};
}
