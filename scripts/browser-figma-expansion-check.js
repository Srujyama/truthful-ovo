async page => {
  // Run only in the dedicated static-gallery session. No application or native
  // Figma state is changed. Gallery scrolling and viewport sizing are local QA.
  if (!page.url().includes('/design/figma/generated/preview.html')) throw new Error('Open the generated Figma preview before running this check.');
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(async () => {
    const model = typeof spec === 'object' ? spec : null;
    if (!model?.screens) throw new Error('The gallery screen specification is missing.');
    const modelResponse=await fetch(new URL('models.json',location.href));
    if(!modelResponse.ok)throw new Error('The generated model trees are unavailable for exact-content verification.');
    const modelTrees=await modelResponse.json();
    const expectedFrames=new Map([...modelTrees.screens,...modelTrees.boards].map(node=>[node.name,node]));
    const expectedTexts=node=>node.type==='Text'?[node.text]:(node.children||[]).flatMap(expectedTexts);
    const screenIds = new Set(model.screens.map(screen => screen.id));
    const frames = [...document.querySelectorAll('body>section')].map(section => ({ section, root: section.querySelector(':scope>.frame-scroll>div') })).filter(item => item.root);
    const selectedFrames = frames.filter(item => screenIds.has(item.section.id) || item.section.id.startsWith('board-'));
    const missingScreens = model.screens.filter(screen => !selectedFrames.some(item => item.section.id === screen.id)).map(screen => screen.id);
    const clipping = [], textOverflow = [], frameOverflow = [], missingContent = [], fontFailures = [], missingActions = [], summaries = [];
    for (const {section, root} of selectedFrames) {
      const rootBounds = root.getBoundingClientRect();
      const scaleX = rootBounds.width / root.offsetWidth, scaleY = rootBounds.height / root.offsetHeight;
      const relative = rect => ({ x: +((rect.x-rootBounds.x)/scaleX).toFixed(2), y:+((rect.y-rootBounds.y)/scaleY).toFixed(2), width:+(rect.width/scaleX).toFixed(2), height:+(rect.height/scaleY).toFixed(2) });
      const elements = [root, ...root.querySelectorAll('[data-layer]')];
      const bounds = new Map(elements.map(element => [element, element.getBoundingClientRect()]));
      const styles = new Map(elements.map(element => [element, getComputedStyle(element)]));
      const path = element => { const names = []; for (let current=element;current&&current!==root.parentElement;current=current.parentElement) names.unshift(current.dataset.layer || current.tagName); return names.join(' / '); };
      let texts = 0, chars = 0;
      const actualTexts=[];
      for (const element of elements) {
        const content = [...element.childNodes].filter(node => node.nodeType===Node.TEXT_NODE && node.textContent.trim());
        if (!content.length) continue;
        const text = content.map(node => node.textContent).join('');
        actualTexts.push(text);
        chars += text.length; texts++;
        const elementBounds = bounds.get(element), style = styles.get(element);
        if (!elementBounds.width || !elementBounds.height || style.display==='none' || style.visibility==='hidden' || +style.opacity===0) missingContent.push({id:section.id,layer:path(element),text:text.slice(0,160),reason:'Text has no visible geometry.'});
        if (!document.fonts.check(`${style.fontSize} ${style.fontFamily}`)) fontFailures.push({id:section.id,layer:path(element),font:`${style.fontSize} ${style.fontFamily}`});
        const range = document.createRange(); range.selectNodeContents(element);
        const textBounds = range.getBoundingClientRect();
        const ownOverflow = {left:Math.max(0,elementBounds.left-textBounds.left),top:Math.max(0,elementBounds.top-textBounds.top),right:Math.max(0,textBounds.right-elementBounds.right),bottom:Math.max(0,textBounds.bottom-elementBounds.bottom)};
        if (Object.values(ownOverflow).some(value=>value>1.1)) textOverflow.push({id:section.id,layer:path(element),text:text.slice(0,160),bounds:relative(textBounds),ownBounds:relative(elementBounds),overflow:ownOverflow});
        let visible = {left:textBounds.left,top:textBounds.top,right:textBounds.right,bottom:textBounds.bottom};
        const clippedBy=[];
        for (let ancestor=element;ancestor&&ancestor!==root.parentElement;ancestor=ancestor.parentElement) {
          const clipStyle=styles.get(ancestor)||getComputedStyle(ancestor), box=bounds.get(ancestor)||ancestor.getBoundingClientRect();
          const clipsX=['hidden','clip','auto','scroll'].includes(clipStyle.overflowX),clipsY=['hidden','clip','auto','scroll'].includes(clipStyle.overflowY);
          if ((clipsX&&(visible.left<box.left-1.1||visible.right>box.right+1.1))||(clipsY&&(visible.top<box.top-1.1||visible.bottom>box.bottom+1.1))) clippedBy.push({layer:ancestor.dataset.layer,bounds:relative(box)});
          if(clipsX){visible.left=Math.max(visible.left,box.left);visible.right=Math.min(visible.right,box.right);}
          if(clipsY){visible.top=Math.max(visible.top,box.top);visible.bottom=Math.min(visible.bottom,box.bottom);}
        }
        if(clippedBy.length) clipping.push({id:section.id,layer:path(element),text:text.slice(0,160),bounds:relative(textBounds),clippedBy,visibleWidth:Math.max(0,(visible.right-visible.left)/scaleX),visibleHeight:Math.max(0,(visible.bottom-visible.top)/scaleY)});
      }
      for (const child of [...root.children]) {
        const box=child.getBoundingClientRect();
        if (box.left<rootBounds.left-1.1||box.right>rootBounds.right+1.1||box.top<rootBounds.top-1.1||box.bottom>rootBounds.bottom+1.1) frameOverflow.push({id:section.id,layer:path(child),bounds:relative(box),root:{width:root.offsetWidth,height:root.offsetHeight}});
      }
      const actions = new Set([...root.querySelectorAll('[data-action]')].map(element=>element.dataset.action));
      const screen = model.screens.find(screen=>screen.id===section.id);
      for(const action of screen?.actions||[]) if(!actions.has(action.label)) missingActions.push({id:section.id,label:action.label,target:action.targetId});
      if(!texts||chars<20)missingContent.push({id:section.id,reason:'Frame has no substantive text.',texts,chars});
      const expected=expectedFrames.get(section.id);
      if(!expected)missingContent.push({id:section.id,reason:'Rendered frame has no matching model tree.'});
      else {
        const wanted=expectedTexts(expected).filter(text=>String(text).trim());
        if(wanted.length!==actualTexts.length||wanted.some((text,index)=>text!==actualTexts[index]))missingContent.push({id:section.id,reason:'Rendered leaf text differs from the generated model.',expectedTexts:wanted.length,actualTexts:actualTexts.length,firstMismatch:wanted.findIndex((text,index)=>text!==actualTexts[index])});
      }
      summaries.push({id:section.id,type:screen?'screen':'board',width:root.offsetWidth,height:root.offsetHeight,texts,characters:chars,actions:actions.size});
    }
    return {screenCount:model.screens.length,boardCount:summaries.filter(frame=>frame.type==='board').length,checkedFrames:summaries.length,fontLoaded:document.fonts.check('13px "Public Sans"'),missingScreens,clipping,textOverflow,frameOverflow,missingContent,fontFailures,missingActions,summaries};
  });
  const representatives = [...new Set(['operations-queue','financial-report','credit-issued-preview','credit-reversal-preview','amendment-approval','credit-resolution-review','mobile-credit-form','mobile-credit-preview','mobile-credit-reversal','mobile-resolution','mobile-amendment-preview','mobile-vendors','mobile-library','mobile-report','mobile-activity',...geometry.clipping.map(item=>item.id)])];
  const captures=[];
  for(const id of representatives) {
    const root=page.locator(`section[id="${id}"] > .frame-scroll > div`).first();
    await root.scrollIntoViewIfNeeded();
    const filename=`output/figma-expansion/${id}.png`;
    await root.screenshot({path:filename,animations:'disabled'});
    captures.push({id,path:filename});
  }
  // Pre-wrap ranges can include a few pixels of trailing space beyond a text
  // box. Preserve those measurements as advisories; actual hidden ink is
  // detected against every clipping ancestor through the matching frame root.
  return {target:page.url(),scope:'Generated static gallery only; does not establish native Figma persistence.',passed:!geometry.missingScreens.length&&!geometry.clipping.length&&!geometry.frameOverflow.length&&!geometry.missingContent.length&&!geometry.fontFailures.length&&!geometry.missingActions.length,textOverflowPolicy:'Own-range overhang is advisory unless a clipping ancestor hides it.',...geometry,captures};
}
