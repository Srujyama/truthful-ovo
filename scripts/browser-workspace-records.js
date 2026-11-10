async page => {
  page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(20000);
  const start = new URL(page.url());
  const base = `${start.origin}${start.pathname}`;
  const today = new Date().toISOString().slice(0, 10);
  const checks = [], errors = [], pageErrors = [], screenshots = [], downloads = [];
  let baseline = null, refreshRoute = null;
  const onPageError = error => pageErrors.push(error.message);
  page.on('pageerror', onPageError);
  const check = (value, label) => { if (!value) throw new Error(label); if(!checks.includes(label))checks.push(label); };
  const url = (view, params = {}) => { const next = new URL(base); next.search = new URLSearchParams({ view, ...params }).toString(); return next.href; };
  const pageTitles={'Follow-ups':'Cases','Tasks':'Needs attention','Credits':'Credit notes','Activity':'History','Workflow tests':'Developer tools'};
  const heading = name => page.getByRole('heading', { name:pageTitles[name]||name, level: 1, exact: true });
  const route = async (view, title, params = {}) => { await page.goto(url(view, params)); await heading(title).waitFor({ state: 'visible' }); await page.locator('.product-root[data-runtime="server"]').waitFor();if(view==='credits')await page.locator('.credit-statement-row').first().waitFor({state:'attached'}); };
  const hasMoney=(text,expected)=>(String(text).match(/(?:−|-)?\$[\d,]+(?:\.\d{2})?/g)||[]).map(value=>value.replace(/^−/,'-').replace(/\.00$/,'')).includes(expected.replace(/\.00$/,''));
  const showRecordNote=async(container,title)=>{const details=container.locator('details').filter({has:page.locator('summary',{hasText:new RegExp(`^${title}$`)})});if(!await details.evaluate(node=>node.open))await details.locator(':scope > summary').click();};
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const selectedSource = () => page.getByRole('article', { name: 'Exact document version' });
  const originalSource = async () => { await selectedSource().getByRole('group', { name: 'Document view', exact: true }).getByRole('button', { name: 'Original text', exact: true }).click(); const text=selectedSource().getByLabel('Exact source text', { exact: true }); await text.waitFor({state:'visible'}); return text; };
  const documentFilters = () => showRecordNote(page.locator('.document-library'), 'Filters & history');
  const sourceRow = (id,revision) => page.locator(`.ops-document-row[data-source-id="${id}"][data-source-revision="${revision}"]`);
  const sourceFixture = (id,revision) => baseline.view.sourceVersions.find(source=>source.id===id&&source.revision===revision);
  const companyDetail = () => page.getByRole('article', { name: 'Selected company' });
  const nav = async name => {
    name=pageTitles[name]||name;
    const menu=page.getByRole('navigation',{name:'Main navigation',exact:true});
    const showMenu=async()=>{const toggle=page.locator('.mobile-toggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();};
    await showMenu();
    if(name==='Needs attention'&&!await menu.getByRole('button',{name,exact:true}).isVisible()){await menu.getByRole('button',{name:'Cases',exact:true}).click();await showMenu();}
    if(name==='Credit notes'&&!await menu.getByRole('button',{name,exact:true}).isVisible()){await menu.getByRole('button',{name:'Documents',exact:true}).click();await showMenu();}
    if(['History','Developer tools','Office map'].includes(name)){const more=menu.locator('details.nav-secondary');if(!await more.evaluate(node=>node.open))await more.locator(':scope > summary').click();}
    await menu.getByRole('button',{name,exact:true}).click();
  };
  const checkRoute = (view, params = {}) => {
    const current = new URL(page.url());
    check(current.searchParams.get('view') === view && Object.entries(params).every(([key, value]) => current.searchParams.get(key) === String(value)), `URL retains ${view}${Object.keys(params).length ? ` and exact ${Object.keys(params).join('/')}` : ''}`);
  };
  const noOverflow = async label => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: content stays inside the viewport`);
  const screenshot = async name => {
    await page.evaluate(async () => { scrollTo(0, 0); await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const path = `output/playwright/redesign-${name}.png`;
    await page.screenshot({ path, fullPage: true }); screenshots.push(path);
  };
  const journey = async (name, work) => {
    try { await work(); }
    catch (error) { errors.push({ journey: name, message: error.message }); await screenshot(`failure-${name}`).catch(() => {}); }
  };
  const workspace = async () => {
    const response = await page.request.get(new URL('api/workspace', base).href);
    if (!response.ok()) throw new Error(`Read-only workspace inspection failed (${response.status()}).`);
    return response.json();
  };
  const captureDownloads = async () => page.evaluate(() => {
    if (window.__recordsDownloadCapture) return;
    const original = URL.createObjectURL;
    window.__recordsDownloadCapture = { original, blobs: new Map() };
    URL.createObjectURL = function (blob) { const address = original.call(URL, blob); window.__recordsDownloadCapture.blobs.set(address, blob); return address; };
  });
  const downloaded = async (buttonName, filename) => {
    await captureDownloads();
    const pending = page.waitForEvent('download', { timeout: 20000 });
    await click(buttonName); const download = await pending;
    const path = `output/playwright/${filename}`; await download.saveAs(path);
    const text = await page.evaluate(async address => {
      const blob = window.__recordsDownloadCapture?.blobs.get(address);
      if (!blob) throw new Error('The actual download Blob was not captured.');
      return blob.text();
    }, download.url());
    downloads.push({ path, suggestedFilename: download.suggestedFilename(), bytes: text.length });
    return text;
  };
  const parseCsv = text => {
    const rows = []; let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(value); value = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(cell => cell !== '')) rows.push(row); row = []; value = ''; }
      else value += c;
    }
    if (value || row.length) { row.push(value); rows.push(row); } return rows;
  };

  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await route('operations', 'Tasks');
    baseline = await workspace();
    check(baseline.view?.vendors.length === 4 && baseline.view?.sources.length === 9 && baseline.view?.credits.length === 2, 'Read-only run starts from the nine-document, four-company, two-credit demo fixture');
    check(baseline.view.commitments.length === 4, 'The fixture contains all four follow-up identities');

    const routes = [
      ['assurance', 'Cases', 'followups'], ['credits', 'Credit notes', 'credits'], ['operations', 'Needs attention', 'tasks'],
      ['vendors', 'Companies', 'companies'], ['library', 'Documents', 'documents'], ['audit', 'History', 'activity'],
      ['reports', 'Reports', 'reports'], ['execution', 'Developer tools', 'workflow-tests'], ['evidence', 'Document review', 'document-review'],
    ];
    for (const [size, width, height] of [['desktop', 1440, 1000], ['intermediate', 900, 1000], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const [view, title, name] of routes) await journey(`${name}-${size}`, async () => {
        await route(view, title); check(await heading(title).isVisible(), `${size}: ${title} opens its actual route`);
        check(!/ledger|assurance|operations queue|evidence lab/i.test(await heading(title).innerText()), `${size}: ${title} uses a plain primary heading`);
        if (view !== 'evidence') {if(size==='mobile')await page.getByRole('button',{name:'Toggle navigation',exact:true}).click();check(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: title, exact: true }).getAttribute('aria-current') === 'page', `${size}: ${title} has the current-page navigation state`);if(size==='mobile')await page.keyboard.press('Escape');}
        if (view === 'assurance' && size === 'mobile') {
          await page.evaluate(()=>document.fonts.ready);
          const reading=await page.evaluate(()=>{const subtitle=document.querySelector('.casebook-cover h2').getBoundingClientRect(),index=document.querySelector('.casebook-index').getBoundingClientRect(),first=document.querySelector('.correspondence-entry').getBoundingClientRect();return {subtitleBottom:subtitle.bottom,indexTop:index.top,firstBottom:first.bottom,viewport:innerHeight};});
          check(reading.indexTop>=reading.subtitleBottom+12,'Phone introduction and conversation paper never overlap');
          check(reading.firstBottom<reading.viewport,'The first complete company story and next action fit in the phone’s first viewport');
        }
        if (view === 'credits') check(await page.locator('.credit-statement-row').count() === 2, `${size}: both credit records render`);
        if (view === 'operations') check(await page.locator('.ops-task-row').count() === 4, `${size}: all four actionable case rows render`);
        if (view === 'vendors') check(await page.locator('.ops-company-row').count() === 4, `${size}: all companies remain in the visible record list`);
        if (view === 'library') {
          const identities=await page.locator('.ops-document-row').evaluateAll(nodes=>nodes.map(node=>`${node.dataset.sourceId}@${node.dataset.sourceRevision}`).sort());
          check(JSON.stringify(identities)===JSON.stringify(baseline.view.sources.map(source=>`${source.id}@${source.revision}`).sort()), `${size}: document rows retain all nine actual source identities`);
          check(await page.locator('.ops-document-row .document-row-copy > strong').count()===9 && await page.locator('.ops-document-row .ops-source-text,.ops-document-row dl').count()===0, `${size}: all nine documents use compact company, title and date rows`);
          if(size==='mobile') {
            check(!await selectedSource().isVisible() && await sourceRow('pipeline-promise',6).isVisible(), 'Phone Documents starts with the actual document list');
            await sourceRow('pipeline-promise',6).click(); await selectedSource().waitFor({state:'visible'});
            check(!await page.locator('.ops-document-list').isVisible() && await selectedSource().getByRole('heading',{name:'Promised invoice credit',exact:true}).isVisible(), 'Phone selection opens the correct document in its reading room');
            check(await (await originalSource()).textContent()===sourceFixture('pipeline-promise',6).text, 'Phone reading room retains the exact original source bytes');
            await noOverflow('Phone document reading room'); await screenshot('documents-mobile-reader');
            await selectedSource().getByRole('button',{name:'Back to documents',exact:true}).click(); await sourceRow('pipeline-promise',6).waitFor({state:'visible'});
            check(await sourceRow('pipeline-promise',6).evaluate(node=>node===document.activeElement) && !await selectedSource().isVisible(), 'Phone Back to documents restores the selected row and keyboard focus');
          } else check(await selectedSource().isVisible(), `${size}: documents retain both a real list and exact reader`);
        }
        if (view === 'audit') check(await page.locator('.ops-activity-row').count() === 24 && await page.getByRole('button', { name: 'Next records', exact: true }).isVisible(), `${size}: activity exposes its first page and next-page control`);
        if (view === 'reports') check(hasMoney(await page.locator('.ops-report-measures').innerText(),'$900.00'), `${size}: the statement shows the actual verified $900`);
        await noOverflow(`${size} ${title}`); await screenshot(`${name}-${size}`);
      });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await journey('plain-case-history-and-existing-note-task', async () => {
      await route('assurance','Cases',{case:'pipeline-seats'});
      await page.getByRole('group',{name:'Case information',exact:true}).getByRole('button',{name:'History',exact:true}).click();
      const history=page.locator('.assurance-history:visible');
      check((await history.innerText()).includes('Prepared a review of Pipeline CRM’s renewal offer')&&(await history.innerText()).includes('$1,500 of credit would require $2,400 in extra spending'),'Case History explains the actual company, offer and spending instead of a raw event name');
      await history.locator('details').first().locator('summary').click();
      check((await history.locator('details').first().innerText()).includes('Action proposed'),'Case History retains exact event identity behind its plain explanation');
      await route('operations','Needs attention');
      const nimbus=page.locator('.ops-task-row').filter({hasText:'Nimbus Cloud'});
      check((await nimbus.innerText()).includes('Check the credit note against an invoice')&&!(await nimbus.innerText()).includes('Check the claim deadline'),'The existing Nimbus credit note leads to an invoice check rather than an expired new claim');
      await nimbus.click();
      check((await page.locator('.ops-task-expanded').innerText()).includes('new claim passed Oct 30, 2026'),'Nimbus task distinguishes the real new-claim deadline from the expected invoice date');
    });

    await journey('followups-filters-history-and-source-focus', async () => {
      await route('assurance', 'Follow-ups');
      const filters=page.getByRole('group',{name:'Filter follow-ups by status',exact:true}), search=page.getByRole('textbox',{name:'Search follow-ups',exact:true}), rows=page.locator('.portfolio-row:visible');
      check(await rows.count()===4&&await page.locator('.followups-inline-balances,.followups-table-heading').count()===0,'The case file opens with four conversations instead of an unexplained KPI taxonomy or accounting table');
      check((await rows.filter({hasText:'Pipeline CRM'}).innerText()).includes('$900 of $2,400 on the invoice')&&(await rows.filter({hasText:'Pipeline CRM'}).locator('.correspondence-row-art svg').count())===1&&(await rows.filter({hasText:'Pipeline CRM'}).innerText()).includes('$1,500 short'),'Pipeline’s opening visual pairs the invoice preview with exact promised, applied and missing amounts');
      check((await rows.filter({hasText:'Nimbus Cloud'}).innerText()).includes('$2,000 credit note')&&(await rows.filter({hasText:'Nimbus Cloud'}).innerText()).includes('Invoice confirmation still needed'),'Nimbus’s opening story distinguishes the existing credit note from a reduced invoice');
      const filterDisclosure=page.locator('.casebook-filters');await filterDisclosure.locator(':scope > summary').click();
      check((await filters.locator('[data-filter=all] > span').innerText()).trim()==='4','Follow-up status counts start with the actual four cases');
      await filters.locator('[data-filter=owed]').click();
      check(await rows.count()===3&&await rows.filter({hasText:'Nimbus Cloud'}).count()===1&&await rows.filter({hasText:'Orbit Design'}).count()===0,'Still owed includes the expired claim and excludes conditional offers');
      await search.fill('Pipeline');
      check((await filters.locator('[data-filter=all] > span').innerText()).trim()==='1'&&(await filters.locator('[data-filter=issued] > span').innerText()).trim()==='0','Follow-up counts follow the current company search');
      await filters.locator('[data-filter=issued]').click();await page.getByRole('heading',{name:'No matching follow-ups',exact:true}).waitFor();await click('Clear filters');
      await page.getByRole('combobox',{name:'Sort follow-ups',exact:true}).selectOption('owed-desc');
      check(JSON.stringify(await rows.evaluateAll(nodes=>nodes.map(node=>node.dataset.case)))===JSON.stringify(['nimbus-sla','pipeline-seats','parcel-waiver','orbit-renewal']),'Money sorting keeps a conditional offer separate from actual amounts owed');
      const orbit=rows.filter({hasText:'Orbit Design'}),orbitText=await orbit.innerText();check(/\$480 offer/.test(orbitText)&&orbitText.includes('$2,400 extra spending')&&!/owed|recovered|received/.test(await orbit.locator('.correspondence-copy > strong').innerText()),'Conditional offer value never appears as an amount still owed');
      await search.fill('Pipeline');await rows.click();await page.locator('.followups-detail:visible').waitFor();checkRoute('assurance',{case:'pipeline-seats'});
      await page.goBack();await page.locator('.followups-list:visible').waitFor();
      check(await search.inputValue()==='Pipeline','Browser Back preserves the follow-up company search');await page.waitForFunction(()=>document.activeElement?.dataset.case==='pipeline-seats');check(await rows.evaluate(node=>node===document.activeElement),'Browser Back restores the filtered results and selected row focus');
      await page.goForward();await page.locator('.followups-detail:visible').waitFor();checkRoute('assurance',{case:'pipeline-seats'});
      check(true,'Browser Forward restores the exact selected case');
      const info=page.getByRole('group',{name:'Case information',exact:true});await info.getByRole('button',{name:/^Credits/}).click();await click('Record credit');
      await page.getByRole('textbox',{name:'Credit invoice reference',exact:true}).fill('UNSAVED-CONTINUITY');await click('Back to cases');await rows.click();await info.getByRole('button',{name:/^Credits/}).click();
      check(await page.getByRole('textbox',{name:'Credit invoice reference',exact:true}).inputValue()==='UNSAVED-CONTINUITY','An unsaved credit draft survives returning to results and reopening its case');
      await info.getByRole('button',{name:/^Documents/}).click();
      const source=page.locator('.followup-document:visible').first();await source.click();
      const reader=page.getByRole('region',{name:'Selected evidence record',exact:true}), title=reader.getByRole('heading',{level:3});await reader.waitFor();
      check(await title.evaluate(node=>node===document.activeElement&&node.getBoundingClientRect().top>=60&&node.getBoundingClientRect().top<innerHeight),'Opening a case document moves focus and the viewport to its exact source heading');
      await reader.getByRole('button',{name:'Close evidence record',exact:true}).click();check(await source.evaluate(node=>node===document.activeElement),'Closing the source reader restores focus to its originating document');
      await screenshot('followup-detail-desktop-operated');
      await page.setViewportSize({width:390,height:844});await source.click();await reader.waitFor();
      check(await title.evaluate(node=>node===document.activeElement&&node.getBoundingClientRect().top>=60&&node.getBoundingClientRect().top<innerHeight),'A phone source link reveals and focuses its source instead of appearing inert below the document list');
      await noOverflow('Phone exact case source');await page.screenshot({path:'output/playwright/redesign-followup-source-mobile.png',fullPage:false});screenshots.push('output/playwright/redesign-followup-source-mobile.png');
      await reader.getByRole('button',{name:'Return to this document',exact:true}).click();check(await source.evaluate(node=>node===document.activeElement),'The phone source return action restores its original document control');
      await page.setViewportSize({width:1440,height:1000});
    });

    await journey('same-case-paper-motion', async () => {
      await route('assurance','Cases');await page.emulateMedia({reducedMotion:'no-preference'});
      const row=page.locator('[data-case="pipeline-seats"]');await row.click();
      await page.locator('.case-moving-paper').first().waitFor();
      check((await page.locator('.case-moving-paper').allTextContents()).some(text=>text.includes('Pipeline CRM')),'Opening a case carries that actual company into its reader');
      await page.evaluate(()=>new Promise(resolve=>{let n=0;const frame=()=>++n===5?resolve():requestAnimationFrame(frame);requestAnimationFrame(frame)}));
      check(await page.locator('.case-moving-paper').evaluateAll(nodes=>nodes.some(node=>node.getAnimations().some(animation=>animation.currentTime>0&&animation.currentTime<420))),'The selected case object moves through an actual normal-motion intermediate state');
      await page.getByRole('button',{name:'Back to cases',exact:true}).click();
      check(await page.locator('.case-moving-paper').evaluateAll(nodes=>nodes.some(node=>node.getAnimations().some(animation=>animation.playbackRate<0))),'Returning mid-open reverses the same case object from its current position');
      await page.locator('.case-moving-paper').first().waitFor({state:'detached'});await page.locator('.followups-list:visible').waitFor();
      check(await row.evaluate(node=>node===document.activeElement),'Interrupted case opening restores its originating company and keyboard focus');
      await page.emulateMedia({reducedMotion:'reduce'});await row.click();await page.locator('.followups-detail:visible').waitFor();
      check(await page.locator('.case-moving-paper').count()===0,'Reduced motion opens the complete case without moving paper');
      await page.getByRole('button',{name:'Back to cases',exact:true}).click();await page.emulateMedia({reducedMotion:'no-preference'});
    });

    await journey('tasks-operated', async () => {
      await route('operations', 'Tasks');
      const tabs = page.getByRole('group', { name: 'Task type', exact: true });
      check(await page.locator('.ops-filter-tabs').evaluate(node => node.scrollHeight <= node.clientHeight + 1), 'Task filters do not create a spurious vertical scrollbar');
      await tabs.getByRole('button', { name: /^Missing evidence/ }).click();
      check(await page.locator('.ops-task-row').count() === 1 && (await page.locator('.ops-task-row').innerText()).includes('Add proof the credit was applied'), 'Missing evidence promotes its actual invoice-proof task');
      const task = page.locator('.ops-task-row').first(); await task.click();
      check(await task.getAttribute('aria-expanded') === 'true' && await page.locator('.ops-task-expanded').isVisible(), 'A task opens its work and next action inside the same row');
      await page.locator('.ops-task-expanded').getByRole('button', { name: 'Open case', exact: true }).click();
      await heading('Follow-ups').waitFor(); checkRoute('assurance', { case: 'nimbus-sla', destination: 'ledger' });
      await nav('Tasks'); await heading('Tasks').waitFor();
      await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill('not-a-real-company');
      await page.getByRole('heading', { name: 'No tasks match your filters', exact: true }).waitFor(); await click('Clear filters');
      check(await page.locator('.ops-task-row').count() === 4, 'Clearing an empty task search restores the complete queue');
      await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill('Pipeline');
      await page.locator('.ops-task-row').click();
      check((await page.locator('.ops-task-expanded').innerText()).includes('more than one change'), 'The selected task shows the actual competing-terms reason');
      await screenshot('tasks-expanded-desktop');
      await page.locator('.ops-task-expanded').getByRole('button', { name: 'Open case', exact: true }).click();
      await heading('Follow-ups').waitFor(); checkRoute('assurance', { case: 'pipeline-seats', destination: 'decisions', action: 'action-pipeline-renewal' });
      await nav('Tasks'); await heading('Tasks').waitFor();
      check(await page.getByRole('textbox',{name:'Search tasks',exact:true}).inputValue()==='Pipeline','Returning from a selected case preserves the task search');await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill('');
      await page.getByRole('combobox', { name: 'Filter by company', exact: true }).selectOption('orbit');
      check(await page.locator('.ops-task-row').count() === 1 && (await page.locator('.ops-task-row').innerText()).includes('Conditional offer'), 'Conditional task value is visibly distinguished from money owed');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('combobox', { name: 'Filter by company', exact: true }).selectOption('');
      const mobileTask=page.locator('.ops-task-row').filter({hasText:'Pipeline CRM'});if(await mobileTask.getAttribute('aria-expanded')!=='true')await mobileTask.click();
      await noOverflow('Expanded mobile task'); await screenshot('tasks-expanded-mobile');
      await tabs.getByRole('button', { name: /^Scheduled/ }).click();
      check(await page.getByRole('heading', { name: 'No tasks match your filters', exact: true }).isVisible(), 'The horizontal phone filter strip reaches Scheduled and shows an honest empty state');
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await journey('document-reading-room-and-real-terms', async () => {
      await route('library','Documents');
      for(const source of baseline.view.sources){
        const row=sourceRow(source.id,source.revision);
        const rowTitle=await row.locator('.document-row-copy > strong').innerText();
        check(rowTitle.trim().length>0 && (await row.innerText()).includes(baseline.view.vendors.find(vendor=>vendor.id===source.vendorId).name) && (await row.locator('.document-row-copy > small').innerText()).trim().length>0 && !(await row.innerText()).includes(source.text), `Compact document row names its real company and readable title: ${source.id}@${source.revision}`);
        await row.click(); await selectedSource().waitFor({state:'visible'});
        check(await selectedSource().getByRole('heading',{name:rowTitle,level:2,exact:true}).isVisible(), `Document row opens its matching reading-room heading: ${source.id}@${source.revision}`);
        const graphic=selectedSource().getByRole('img');
        if(source.id==='pipeline-renewal'){
          const description=await graphic.getAttribute('aria-label');
          check(description.includes('Extra spending $2,400') && description.includes('offered credit $1,500') && description.includes('$900 more') && description.includes('Not accepted'), 'The renewal illustration explains real $2,400 spending, $1,500 offered credit and $900 extra cost without accepting the offer');
          check((await graphic.textContent()).includes('$2,400') && (await graphic.textContent()).includes('$1,500') && (await graphic.textContent()).includes('$900 more'), 'The visible renewal drawing and its accessible description show the same exact financial comparison');
          await screenshot('documents-renewal-comparison');
        }
        if(['pipeline-promise','parcel-promise','orbit-offer','nimbus-memo'].includes(source.id))check(await graphic.locator('[data-invoice-confirmed="true"]').count()===0 && !(await graphic.getAttribute('aria-label')).includes('Invoice confirms application.'), `An unconfirmed promise or credit note has no invoice-confirmation marker: ${source.id}`);
        if(source.id==='pipeline-invoice')check((await graphic.getAttribute('aria-label')).includes('$900') && (await graphic.getAttribute('aria-label')).includes('Invoice confirms application.') && await graphic.locator('[data-invoice-confirmed="true"]').count()===1, 'Only the actual $900 applied invoice carries its invoice-confirmation marker');
        check(await (await originalSource()).textContent()===source.text && (await selectedSource().locator('.document-original-title').innerText())===source.title, `Original text and original title remain byte-exact: ${source.id}@${source.revision}`);
      }
      const renewal=sourceFixture('pipeline-renewal',23);
      await sourceRow(renewal.id,renewal.revision).click();
      await selectedSource().getByRole('complementary',{name:'Related cases',exact:true}).getByRole('button',{name:'Review the proposed terms',exact:true}).click();
      await heading('Cases').waitFor();checkRoute('assurance',{case:'pipeline-seats',destination:'decisions',action:'action-pipeline-renewal'});
      check(true,'The renewal reading room opens the exact current case and recorded proposal for review');
      await page.setViewportSize({width:900,height:1000});
      await route('library','Documents',{source:'pipeline-renewal',revision:'23'});
      await noOverflow('900px renewal reading room'); await screenshot('documents-renewal-intermediate');
      await originalSource();await noOverflow('900px exact original document');
      await page.setViewportSize({width:390,height:844});
      await route('library','Documents',{source:'pipeline-renewal',revision:'23'});await page.evaluate(()=>scrollTo(0,0));
      const consequence=page.locator('.document-compact-result');
      check((await consequence.innerText()).includes('$900 more')&&await consequence.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),'Phone offer shows the $900 extra cost before the illustration and inside its first viewport');
      const quick=page.locator('.document-compact-action').getByRole('button',{name:'Review the proposed terms',exact:true});
      check(await quick.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),'Phone document review action is reachable before the large illustration');
      await quick.click();await heading('Cases').waitFor();checkRoute('assurance',{case:'pipeline-seats',destination:'decisions',action:'action-pipeline-renewal'});
      await route('library','Documents',{source:'pipeline-proposal',revision:'21'});await page.evaluate(()=>scrollTo(0,0));
      const dateChange=page.locator('.document-compact-dates');
      check((await dateChange.innerText()).includes('Oct 1')&&(await dateChange.innerText()).includes('Nov 15')&&await dateChange.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),'Phone date change shows both original and proposed dates before the artwork');
      await route('assurance','Cases',{case:'nimbus-sla'});await page.evaluate(()=>scrollTo(0,0));
      const next=page.locator('.case-next-action').getByRole('button',{name:'Open the credit note',exact:true});
      check(await next.evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),'Phone case action appears before the reconciliation graphic and inside the first viewport');
      const noteGraphic=page.locator('.case-graphic');
      check((await noteGraphic.getAttribute('aria-label')).includes('On invoices $0')&&(await noteGraphic.getAttribute('aria-label')).includes('$2,000 is matched from credit notes'),'Case artwork separates the existing matched note from actual invoice credit');
      await screenshot('visual-case-phone');
      await page.setViewportSize({width:1440,height:1000});
    });

    await journey('companies-and-exact-documents', async () => {
      await route('vendors', 'Companies');
      const search = page.getByRole('textbox', { name: 'Search companies', exact: true });
      await search.fill('Pipeline'); check(await page.locator('.ops-company-row').count() === 1, 'Company search filters real company rows');
      await page.locator('.ops-company-row').click();
      check(hasMoney(await companyDetail().innerText(),'$1,500.00'), 'Company balances preserve Pipeline’s actual outstanding amount');
      await page.getByRole('group', { name: 'Company records' }).getByRole('button', { name: /^Credit notes/ }).click();
      await showRecordNote(companyDetail(),'Document & record details');
      check((await companyDetail().innerText()).includes('INV-PC-1026') && hasMoney(await companyDetail().innerText(),'$900.00'), 'Company Credits exposes the actual applied invoice line');
      await page.getByRole('group', { name: 'Company records' }).getByRole('button', { name: /^Documents/ }).click();
      await page.locator('.ops-source-link').filter({ hasText: 'Original duplicate-seat correction' }).click();
      await selectedSource().waitFor(); checkRoute('library', { source: 'pipeline-promise', revision: '6' });
      await showRecordNote(selectedSource(),'Version & date details');
      await originalSource();
      check((await selectedSource().innerText()).includes('Version 6') && (await page.getByLabel('Exact source text').innerText()).includes('USD 2,400'), 'The company document opens its exact original text and revision');
      const sourceText = await page.getByLabel('Exact source text').textContent();
      check(sourceText===sourceFixture('pipeline-promise',6).text && (await selectedSource().locator('.document-original-title').innerText())===sourceFixture('pipeline-promise',6).title, 'Original text preserves the exact source bytes and original title behind its human document heading');
      const downloadedText = await downloaded('Download exact document text', 'workspace-exact-source.txt');
      check(downloadedText === sourceText, 'The actual source download contains the displayed exact version text');
      await documentFilters();
      await page.getByLabel('Document knowledge cutoff', { exact: true }).fill('2026-09-01');
      await page.getByRole('heading', { name: 'This exact document version is unavailable', exact: true }).waitFor();
      check(await page.getByLabel('Exact source text').count() === 0, 'An earlier cutoff never substitutes a different document for an unavailable exact version');
      await page.getByLabel('Document knowledge cutoff', { exact: true }).fill(today);
      await selectedSource().waitFor(); check(await (await originalSource()).textContent() === sourceText, 'Restoring the cutoff restores the same requested version and text');
      await page.getByRole('combobox', { name: 'Document versions', exact: true }).selectOption('current');
      check(await (await originalSource()).textContent() === sourceText, 'Showing latest-known versions preserves a selected document that still matches');
      await page.getByRole('combobox', { name: 'Document versions', exact: true }).selectOption('all');
      check(await page.getByRole('combobox', { name: 'Document versions', exact: true }).inputValue() === 'all' && await (await originalSource()).textContent() === sourceText, 'All-version inspection preserves the same selected document identity');
      await page.locator('.document-library-filters > summary').click();
      await selectedSource().getByRole('complementary', { name: 'Related cases', exact: true }).getByRole('button', { name: 'Open the case', exact: true }).click();
      await heading('Follow-ups').waitFor(); checkRoute('assurance', { case: 'pipeline-seats', destination: 'evidence' });
      await route('vendors', 'Companies', { vendor: 'pipeline', vendorTab: 'credits' });
      await showRecordNote(companyDetail(),'Document & record details');
      check((await companyDetail().innerText()).includes('INV-PC-1026') && await page.getByRole('group', { name: 'Company records' }).getByRole('button', { name: /^Credit notes/ }).getAttribute('aria-pressed') === 'true', 'A company deep link selects the exact company and Credits tab');
      await route('library', 'Documents', { source: 'missing-record', revision: '999' });
      await page.getByRole('heading', { name: 'This exact document version is unavailable', exact: true }).waitFor();
      check(await page.getByLabel('Exact source text').count() === 0, 'A missing source ID/revision is reported without substitution');
      await click('Clear filters'); await selectedSource().waitFor();
      await page.getByRole('textbox', { name: 'Search documents', exact: true }).fill('NoSuchDocument-ExactSearch');
      await page.getByRole('heading', { name: 'No documents match your filters', exact: true }).waitFor(); await click('Clear filters');
      check(await page.locator('.ops-document-row').count() === 9, 'Document no-results recovery restores all recorded sources');
      await documentFilters();
      await page.getByRole('combobox', { name: 'Filter document type', exact: true }).selectOption('credit_memo');
      check(await page.locator('.ops-document-row').count() === 1 && await sourceRow('nimbus-memo',18).count()===1 && (await (await originalSource()).textContent())===sourceFixture('nimbus-memo',18).text, 'Document type filtering selects the real credit memo');
    });

    await journey('activity-operated', async () => {
      await route('audit', 'Activity');
      const firstPage = await page.locator('.ops-activity-row').first().innerText();
      await click('Next records'); check(await page.locator('.ops-activity-row').count() === 4 && await page.locator('.ops-activity-row').first().innerText() !== firstPage, 'Activity Next opens the final four actual events');
      await click('Previous records'); check(await page.locator('.ops-activity-row').count() === 24, 'Activity Previous restores the first 24 events');
      await page.locator('.ops-filter-disclosure > summary').click();
      await page.getByRole('combobox', { name: 'Filter activity transition', exact: true }).selectOption('CREDIT_REGISTERED');
      await page.getByRole('combobox', { name: 'Filter by company', exact: true }).selectOption('nimbus');
      check(await page.locator('.ops-activity-row').count() === 1 && (await page.locator('.ops-activity-row').innerText()).includes('Nimbus Cloud') && /\$2,000(?:\.00)?/.test(await page.locator('.ops-activity-row').innerText()) && (await page.locator('.ops-activity-row').innerText()).toLowerCase().includes('credit note'), 'Activity combines company and change-type filters using real event context');
      await page.getByRole('combobox', { name: 'Filter activity actor', exact: true }).selectOption('seed-curator');
      check(await page.locator('.ops-activity-row').count() === 1, 'Recorded actor filtering retains the matching event');
      await page.locator('.ops-activity-row').click();
      await page.locator('.ops-command-details > summary').filter({ hasText: 'Exact recorded data' }).click();
      check((await page.getByLabel('Exact recorded payload').innerText()).includes('credit-nimbus-2000'), 'Activity reveals the exact selected event payload');
      await page.getByLabel('Activity recorded from', { exact: true }).fill('2026-11-01');
      await page.getByLabel('Activity recorded through', { exact: true }).fill('2026-10-01');
      check((await page.getByRole('alert').innerText()).includes('start date'), 'An invalid activity date range gives an actionable inline error');
      await click('Clear filters');
      await page.getByRole('textbox', { name: 'Search activity', exact: true }).fill('not-in-the-recorded-events');
      await page.getByRole('heading', { name: 'No activity matches your filters', exact: true }).waitFor(); await click('Clear filters');
      check(await page.locator('.ops-activity-row').count() === 24, 'Clearing activity filters restores its complete first page');
    });

    await journey('reports-dates-and-downloads', async () => {
      await route('reports', 'Reports');
      await page.getByLabel('Report financial effective date', { exact: true }).fill('2026-10-24');
      const issued = page.locator('.ops-report-measures > div').filter({ has: page.locator('dt', { hasText: /^Credit notes awaiting an invoice/ }) });
      check(hasMoney(await issued.innerText(),'$0.00') && hasMoney(await page.locator('.ops-report-measures').innerText(),'$900.00'), 'Effective-date replay excludes the later issued memo while retaining earlier applied credit');
      await page.getByLabel('Report financial effective date', { exact: true }).fill(today);
      await page.getByLabel('Report knowledge cutoff', { exact: true }).fill('2026-09-01');
      check(hasMoney(await page.locator('.ops-report-measures > div').filter({ has: page.locator('dt', { hasText: /^Confirmed on invoices/ }) }).innerText(),'$0.00'), 'Knowledge cutoff independently excludes application evidence not yet recorded');
      await click('Today');
      check(await page.getByLabel('Report financial effective date', { exact: true }).inputValue() === today && await page.getByLabel('Report knowledge cutoff', { exact: true }).inputValue() === today, 'Today restores both independent report dates');
      await page.getByRole('textbox', { name: 'Search report companies', exact: true }).fill('Pipeline');
      check(await page.locator('.ops-table-scroll tbody tr').count() === 1 && hasMoney(await page.locator('.ops-table-scroll tfoot').innerText(),'$3,850.00'), 'Company search filters report rows while retaining clearly labeled all-company totals');
      const csv = parseCsv(await downloaded('Export CSV', 'workspace-records-report.csv'));
      const header = csv[0], total = csv.find(row => row[2] === 'WORKSPACE TOTAL');
      check(csv.length === 6 && csv.slice(1, -1).length === 4, 'The actual CSV includes every company despite the UI row filter');
      check(Boolean(total) && total[header.indexOf('verified_cents')] === '90000' && total[header.indexOf('outstanding_cents')] === '385000' && total[header.indexOf('issued_cents')] === '200000', 'Downloaded CSV preserves separate verified, outstanding and issued totals in exact integer cents');
      check(csv.slice(1).every(row => row[0] === today && row[1].startsWith(today) && row[4] === 'USD' && row.slice(5).every(value => /^-?\d+$/.test(value))), 'Each downloaded CSV row includes both cutoffs, currency and integer-cent measures');
      const packet = JSON.parse(await downloaded('Export audit packet', 'workspace-records-audit-packet.json'));
      check(packet.format === 'truthful-assurance-packet-v1' && packet.view.asOf === today && packet.view.knownAt.startsWith(today), 'The actual audit download binds the displayed report projection dates');
      check(packet.workspace.events.length === baseline.workspace.events.length && packet.view.totals.verifiedCents === 90000 && packet.invariantCheck.valid === true, 'The actual audit packet includes full recorded history and the verified, valid financial projection');
      await page.locator('.ops-table-scroll tbody').getByRole('button', { name: 'Pipeline CRM', exact: true }).click();
      await heading('Companies').waitFor(); checkRoute('vendors', { vendor: 'pipeline', vendorTab: 'commitments' });
      check((await companyDetail().innerText()).includes('Pipeline CRM'), 'A company report row opens that exact company dossier');
    });

    await journey('credits-operated-and-error-recovery', async () => {
      await route('credits', 'Credits');
      check(await page.locator('.credit-statement-row').count() === 2 && hasMoney(await page.locator('[data-credit="credit-pipeline-900"] .credit-row-amount > strong').innerText(),'$900.00') && hasMoney(await page.locator('[data-credit="credit-nimbus-2000"] .credit-row-amount > strong').innerText(),'$2,000.00'), 'Credits separates the two physical lines into applied $900 and issued $2,000');
      await page.locator('.record-tabs').getByRole('button', { name: /^Invoice still needed/ }).click();
      check(await page.locator('.credit-statement-row').count() === 1 && (await page.locator('.credit-statement-row').innerText()).includes('CM-NC-204'), 'Waiting-for-invoice filter shows the actual issued memo');
      await page.locator('.credit-statement-row').click();
      checkRoute('credits', { credit: 'credit-nimbus-2000' });
      check((await page.getByRole('complementary', { name: 'Selected credit' }).innerText()).includes('A credit note is not yet a reduction on your bill'), 'Issued-credit detail explicitly distinguishes an unapplied memo');
      await page.locator('.record-tabs').getByRole('button', { name: /^All notes/ }).click();
      await page.getByRole('textbox', { name: 'Search credits', exact: true }).fill('INV-PC-1026');
      check(await page.locator('.credit-statement-row').count() === 1, 'Credit search finds the actual invoice identity');
      await page.locator('.credit-statement-row').click();
      checkRoute('credits', { credit: 'credit-pipeline-900' });
      const reader = page.getByRole('complementary', { name: 'Selected credit' });
      await showRecordNote(reader,'Document details');
      check(hasMoney(await reader.innerText(),'$900.00') && (await reader.innerText()).includes('PC-SEATS-2026'), 'Applied-credit detail preserves amount and case reference');
      await reader.locator('.credit-files button').click();
      await selectedSource().waitFor(); checkRoute('library', { source: 'pipeline-invoice', revision: '10' });
      check((await (await originalSource()).textContent())===sourceFixture('pipeline-invoice',10).text && (await page.getByLabel('Exact source text').textContent()).includes('INV-PC-1026'), 'Credit supporting-document link opens its exact invoice text');
      await page.goBack(); await heading('Credits').waitFor();
      checkRoute('credits', { credit: 'credit-pipeline-900' });
      check(await page.getByRole('textbox',{name:'Search credits',exact:true}).inputValue()==='INV-PC-1026','Returning to a credit preserves its invoice filter');
      await page.getByRole('complementary', { name: 'Selected credit' }).locator('.credit-assignment').click();
      await heading('Follow-ups').waitFor(); checkRoute('assurance', { case: 'pipeline-seats', destination: 'ledger' });
      await route('credits', 'Credits');
      refreshRoute = async intercepted => intercepted.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Verification: the refresh service is temporarily unavailable.' } }) });
      await page.route('**/api/workspace', refreshRoute);
      await click('Refresh');
      await page.getByRole('alert').filter({ hasText: 'refresh service is temporarily unavailable' }).waitFor();
      check(await page.locator('.credit-statement-row').count() === 2, 'A failed refresh keeps both existing credit records visible');
      await page.unroute('**/api/workspace', refreshRoute); refreshRoute = null;
      await click('Try again'); await page.getByRole('alert').waitFor({ state: 'hidden' });
      check(await page.locator('.credit-statement-row').count() === 2 && await page.getByRole('button', { name: 'Refresh', exact: true }).isEnabled(), 'Retry clears the refresh error and retains the actual records');
      await page.getByRole('textbox', { name: 'Search credits', exact: true }).fill('no-matching-credit');
      await page.getByRole('heading', { name: 'No matching credit notes', exact: true }).waitFor(); await click('Clear filters');
      check(await page.locator('.credit-statement-row').count() === 2, 'Credit no-results state restores its records through Clear filters');
      await route('credits', 'Credits', { credit: 'missing-credit' });
      await page.getByRole('heading', { name: 'Credit note not found', exact: true }).waitFor();
      check(await page.getByRole('complementary', { name: 'Selected credit' }).count() === 0, 'An unavailable exact credit never substitutes another credit');
      await click('View all notes');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.credit-statement-row').filter({ hasText: 'Pipeline CRM' }).click();
      check(await page.getByRole('complementary', { name: 'Selected credit' }).isVisible() && !await page.locator('.credit-statement').isVisible(), 'Phone credit selection opens the selected readable detail');
      await page.goBack();await page.locator('.credit-statement:visible').waitFor();check(!new URL(page.url()).searchParams.has('credit'),'Phone browser Back returns to the credit list and clears the selected record URL');
      check(await page.locator('[data-credit="credit-pipeline-900"]').evaluate(node=>node===document.activeElement),'Phone browser Back restores the exact originating credit row focus');
      await page.goForward();await page.getByRole('complementary',{name:'Selected credit'}).waitFor();checkRoute('credits',{credit:'credit-pipeline-900'});check(!await page.locator('.credit-statement').isVisible(),'Phone browser Forward restores the same credit detail');
      await click('All notes'); check(await page.locator('.credit-statement').isVisible()&&!new URL(page.url()).searchParams.has('credit'), 'The phone All credits action returns to the list and clears its detail URL');
      await page.reload();await heading('Credits').waitFor();await page.locator('.credit-statement:visible').waitFor();check(await page.locator('.credit-statement-row').count()===2&&!new URL(page.url()).searchParams.has('credit'),'Reload after returning to all credits keeps the phone list open');
      await noOverflow('Operated mobile Credits'); await screenshot('credits-list-mobile-operated');
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await journey('global-search-keyboard-and-history', async () => {
      await route('reports', 'Reports');
      await page.keyboard.press('Meta+k');
      const dialog = page.getByRole('dialog', { name: 'Search this workspace', exact: true }); await dialog.waitFor();
      const input = page.getByRole('textbox', { name: 'Search this workspace', exact: true });
      check(await input.evaluate(node => node === document.activeElement), 'Cmd-K opens workspace search with focus in its input');
      await input.fill('Original duplicate-seat correction'); await input.press('ArrowDown');
      check(await dialog.locator('.command-result').evaluate(node => node === document.activeElement), 'ArrowDown moves from the search input to its actual result');
      await page.keyboard.press('Enter'); await selectedSource().waitFor(); checkRoute('library', { source: 'pipeline-promise', revision: '6' });
      check((await (await originalSource()).textContent())===sourceFixture('pipeline-promise',6).text && (await page.getByLabel('Exact source text').textContent()).includes('USD 2,400'), 'Keyboard search opens the source’s exact identity and text');
      await page.goBack(); await heading('Reports').waitFor(); check(true, 'Browser Back returns from an exact source to its previous report route');
      await page.keyboard.press('Meta+k'); await dialog.waitFor(); await input.fill('INV-PC-1026'); await input.press('ArrowDown'); await page.keyboard.press('Enter');
      await heading('Credits').waitFor(); checkRoute('credits', { credit: 'credit-pipeline-900' });
      check((await page.getByRole('complementary', { name: 'Selected credit' }).innerText()).includes('INV-PC-1026'), 'Keyboard global search can open an exact credit record');
      await page.keyboard.press('Meta+k'); await dialog.waitFor(); await input.fill('definitely-no-workspace-result');
      check((await dialog.locator('.command-empty').innerText()).includes('No results'), 'Global search exposes an honest no-results state');
      await page.keyboard.press('Escape'); check(!await dialog.isVisible(), 'Escape closes the search dialog');
    });

    await journey('office-navigation-and-task-continuity', async () => {
      await route('operations', 'Tasks'); await page.getByRole('textbox', { name: 'Search tasks', exact: true }).fill('Pipeline'); await page.locator('.ops-task-row').click();
      await nav('Office map'); await heading('Office map').waitFor();
      check(await page.getByRole('navigation', { name: 'Office buildings', exact: true }).getByRole('button').count() === 6, 'Office exposes all six ordinary building controls');
      await screenshot('office-desktop');
      await page.getByRole('navigation', { name: 'Workspace presentation', exact: true }).getByRole('button', { name: 'Back to the file', exact: true }).click();
      await heading('Tasks').waitFor();
      check(await page.getByRole('textbox', { name: 'Search tasks', exact: true }).inputValue() === 'Pipeline' && await page.locator('.ops-task-row').getAttribute('aria-expanded') === 'true', 'Office round trip preserves the open task, its company identity and its search');
      await nav('Office map'); await heading('Office map').waitFor();
      await page.getByRole('navigation', { name: 'Office buildings', exact: true }).getByRole('button', { name: /^Archive/ }).click();
      const inspector = page.getByRole('complementary', { name: 'Documents records', exact: true }); await inspector.waitFor();
      await inspector.locator('.world-record').filter({ hasText: 'Original duplicate-seat correction' }).click();
      await selectedSource().waitFor(); checkRoute('library', { source: 'pipeline-promise', revision: '6' });
      check(true, 'An Office document opens that actual source and version');
    });

    await journey('retained-approval-identity', async () => {
      await route('assurance','Follow-ups',{case:'pipeline-seats',destination:'decisions',action:'action-pipeline-renewal'});
      const picker=page.getByRole('combobox',{name:'Request to review',exact:true});await page.locator('.decision-case:visible').waitFor();
      check(await picker.inputValue()==='action-pipeline-renewal'&&(await page.locator('.decision-case header').innerText()).includes('Pipeline CRM'),'Exact Pipeline approval opens its own action');
      await nav('Tasks');await heading('Tasks').waitFor();await page.getByRole('combobox',{name:'Filter by company',exact:true}).selectOption('');await page.getByRole('textbox',{name:'Search tasks',exact:true}).fill('Nimbus');
      const task=page.locator('.ops-task-row:visible');if(await task.getAttribute('aria-expanded')!=='true')await task.click();await page.locator('.ops-task-expanded').getByRole('button',{name:'Open case',exact:true}).click();await heading('Follow-ups').waitFor();
      // The task's current destination can be Credits; its review still must replace the retained Pipeline selection.
      const views=page.getByRole('group',{name:'Follow-up views',exact:true});await views.getByRole('button',{name:/^Reviews/}).click();await picker.waitFor();
      check(await picker.inputValue()==='action-nimbus-claim'&&(await page.locator('.decision-case header').innerText()).includes('Nimbus Cloud'),'Opening a different case review replaces the previously retained approval action');
      await picker.selectOption('action-pipeline-preserve');checkRoute('assurance',{case:'pipeline-seats',destination:'decisions',action:'action-pipeline-preserve'});
      await click('Back to follow-up');await page.locator('.followups-detail:visible').waitFor();checkRoute('assurance',{case:'pipeline-seats',destination:'portfolio'});
      check((await page.locator('.followups-detail header').innerText()).includes('Pipeline CRM'),'Returning from a manually selected action opens that exact follow-up');
      await page.goBack();await page.locator('.decision-case:visible').waitFor();check(await picker.inputValue()==='action-pipeline-preserve','Browser Back restores the exact manually selected approval action');
      await route('assurance','Follow-ups',{case:'nimbus-sla',destination:'decisions',action:'action-pipeline-preserve'});
      check(await page.locator('.decision-case:visible').count()===0&&await page.getByRole('button',{name:'Approve action',exact:true}).count()===0,'A mismatched explicit action and case cannot display or approve another company’s action');
    });

    await journey('role-scope-draft-boundary', async () => {
      await route('assurance','Follow-ups',{case:'pipeline-seats',destination:'ledger'});await click('Record credit');await page.getByRole('textbox',{name:'Credit invoice reference',exact:true}).fill('PRIVATE-OLD-ROLE-DRAFT');
      const options=page.locator('.workspace-options');await options.locator(':scope > summary').click();await page.getByRole('combobox',{name:'Demo actor role',exact:true}).selectOption('viewer');
      await page.waitForFunction(()=>document.querySelector('[aria-label="Demo actor role"]')?.value==='viewer'&&!document.querySelector('[aria-label="Demo actor role"]')?.disabled);
      await page.keyboard.press('Escape');await page.getByRole('group',{name:'Case information',exact:true}).getByRole('button',{name:/^Credits/}).click();await click('Record credit');
      check(await page.getByRole('textbox',{name:'Credit invoice reference',exact:true}).inputValue()==='','Switching the active role discards the previous role’s unsaved credit draft');
      await options.locator(':scope > summary').click();await page.getByRole('combobox',{name:'Demo actor role',exact:true}).selectOption('admin');await page.waitForFunction(()=>document.querySelector('[aria-label="Demo actor role"]')?.value==='admin'&&!document.querySelector('[aria-label="Demo actor role"]')?.disabled);await page.keyboard.press('Escape');
      await page.getByRole('group',{name:'Case information',exact:true}).getByRole('button',{name:/^Credits/}).click();await click('Record credit');check(await page.getByRole('textbox',{name:'Credit invoice reference',exact:true}).inputValue()==='','Returning to a previous role does not revive its discarded draft');
    });

    await journey('mobile-account-and-navigation-access', async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await route('credits', 'Credits');
      const account = page.locator('.topbar .workspace-account-trigger');
      check(await account.getAttribute('aria-label') === 'Demo account' && await account.isVisible(), 'The icon-only phone account control retains a meaningful accessible name');
      await account.click(); const dialog = page.getByRole('dialog', { name: 'Demo workspace', exact: true }); await dialog.waitFor();
      check(await dialog.getByRole('combobox', { name: 'Fictional role', exact: true }).isVisible(), 'Phone account dialog exposes the real demo account controls');
      await noOverflow('Phone account dialog'); await screenshot('account-mobile');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      check(await account.evaluate(node => node === document.activeElement), 'Closing the phone account dialog restores focus to its trigger');
      const toggle = page.locator('.mobile-toggle'); await toggle.click();
      const menu = page.getByRole('dialog', { name: 'Workspace navigation', exact: true }); await menu.waitFor();
      check(await toggle.getAttribute('aria-expanded') === 'true' && await menu.evaluate(node => node.contains(document.activeElement)), 'Phone navigation opens as a modal with focus inside');
      await page.keyboard.press('Tab'); check(await menu.evaluate(node => node.contains(document.activeElement)), 'Tab keeps focus within the open phone navigation');
      await screenshot('navigation-mobile'); await page.keyboard.press('Escape');
      check(await toggle.getAttribute('aria-expanded') === 'false' && await toggle.evaluate(node => node === document.activeElement), 'Escape closes phone navigation and returns focus');
      await nav('Reports'); await heading('Reports').waitFor();
      check(await toggle.getAttribute('aria-expanded') === 'false', 'Choosing a phone destination closes navigation and reveals that route');
      await noOverflow('Operated phone navigation');
    });

    await journey('read-only-completion', async () => {
      const after = await workspace();
      check(baseline && after.revision === baseline.revision && JSON.stringify(after.workspace.events) === JSON.stringify(baseline.workspace.events), 'Every operated journey leaves the financial revision and event history unchanged');
      check(pageErrors.length === 0, 'All routes and operated journeys produce zero uncaught browser exceptions');
    });
  } catch (error) {
    errors.push({ journey: 'setup-or-run', message: error.message });
    await screenshot('failure-setup').catch(() => {});
  } finally {
    if (refreshRoute) await page.unroute('**/api/workspace', refreshRoute).catch(() => {});
    await page.evaluate(() => { const capture = window.__recordsDownloadCapture; if (capture) { URL.createObjectURL = capture.original; delete window.__recordsDownloadCapture; } }).catch(() => {});
    page.off('pageerror', onPageError);
  }
  for (const message of pageErrors) errors.push({ journey: 'uncaught-browser-exception', message });
  const result = { base, ok: errors.length === 0, passed: checks.length, checks, errors, screenshots, downloads, pageErrors };
  const artifact = page.waitForEvent('download');
  await page.evaluate(result => {
    const link = document.createElement('a'), address = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    link.href = address; link.download = 'workspace-records-result.json'; link.click(); setTimeout(() => URL.revokeObjectURL(address), 1000);
  }, result);
  await (await artifact).saveAs('output/playwright/workspace-records-result.json');
  return { base, ok: result.ok, passed: result.passed, checks, errors, screenshots: screenshots.length, downloads };
}
