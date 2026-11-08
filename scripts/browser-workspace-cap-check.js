async page => {
 const base=new URL(page.url()).origin;
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/?view=operations`);
 await page.getByRole('heading',{name:'Operations queue',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Search operations'}).fill('Clarity');
 const records=page.locator('.ops-record');
 if(await records.count()!==2)throw new Error('The fulfilled or cap-exhausted case must not receive another attribution task.');
 await records.filter({hasText:'Attribute available credit'}).click();await page.getByRole('button',{name:'Open this work item',exact:true}).click();
 await page.locator('.assurance-amount>strong').getByText('$200.00',{exact:true}).waitFor();
 return{base,passed:2,checks:['The queue excludes a fulfilled case whose assignment cap is consumed','Available-credit work opens the other case with actual remaining authority']};
}
