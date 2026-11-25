import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const OUT='/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap/hermes-verify';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });

// A) 1440 expanded: are the 10 hitFails scrolled-out-of-view rows (false) or truly occluded (real)?
{
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const out=[];
    const scroll = document.querySelector('.controls-scroll');
    const sr = scroll?.getBoundingClientRect();
    for (const el of document.querySelectorAll('button,input,select')) {
      const b=el.getBoundingClientRect(); const st=getComputedStyle(el);
      if(b.width<2||b.height<2||st.display==='none'||st.visibility==='hidden') continue;
      if(b.right<=0||b.left>=innerWidth||b.bottom<=0||b.top>=innerHeight) continue;
      const cx=b.left+b.width/2, cy=b.top+b.height/2;
      if(cx<0||cy<0||cx>innerWidth||cy>innerHeight) continue;
      const top=document.elementFromPoint(cx,cy);
      const hit=!!top&&(el===top||el.contains(top)||top.contains(el));
      if(!hit){
        const inScroll = scroll && scroll.contains(el);
        const outsideScrollView = inScroll && sr ? (b.bottom < sr.top+1 || b.top > sr.bottom-1) : false;
        out.push({id:el.id,cls:String(el.className).slice(0,40),text:(el.textContent||'').trim().slice(0,20),
          rect:{t:Math.round(b.top),b:Math.round(b.bottom)}, scrollTop:Math.round(sr?.top), scrollBottom:Math.round(sr?.bottom),
          outsideScrollView, top:top?{cls:String(top.className).slice(0,40)}:null});
      }
    }
    // scroll the panel to the bottom and re-test those controls
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    return {fails:out, scrollH:scroll?.scrollHeight, clientH:scroll?.clientHeight};
  });
  await page.waitForTimeout(400);
  const r2 = await page.evaluate(() => {
    const ids=['ctrl-structureAlign','ctrl-alignJitter'];
    const res=[];
    for(const el of document.querySelectorAll('.segmented__btn, #ctrl-structureAlign, #ctrl-alignJitter')){
      const b=el.getBoundingClientRect();
      if(b.width<2) continue;
      const cx=b.left+b.width/2, cy=b.top+b.height/2;
      if(cy<0||cy>innerHeight) { res.push({id:el.id,text:(el.textContent||'').trim().slice(0,12),stillOut:true}); continue; }
      const top=document.elementFromPoint(cx,cy);
      res.push({id:el.id,text:(el.textContent||'').trim().slice(0,12),hit:!!top&&(el===top||el.contains(top)||top.contains(el))});
    }
    return res;
  });
  console.log('A) 1440 expanded hitFails:', JSON.stringify(r,null,1));
  console.log('A) after scrolling panel to bottom:', JSON.stringify(r2));
  await ctx.close();
}

// B) 390: open the controls overlay via toggle-controls, verify tappable + flow assertions reachable
{
  const ctx = await browser.newContext({ viewport:{width:390,height:844} });
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => {
    const t=document.getElementById('toggle-controls'); const b=t?.getBoundingClientRect();
    const top=b?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
    return {toggleRect:b?{x:b.x,y:b.y,w:b.width,h:b.height}:null, toggleHit:!!top&&(t===top||t.contains(top)),
      panelClosed:document.getElementById('controls-root')?.classList.contains('panel--mobile-closed')};
  });
  await page.evaluate(()=>document.getElementById('toggle-controls')?.click());
  await page.waitForTimeout(600);
  const open = await page.evaluate(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const p=document.getElementById('controls-root'); const pr=p.getBoundingClientRect();
    const card=document.getElementById('canvas-area').getBoundingClientRect();
    const scroll = p.querySelector('.controls-scroll') || p;
    const sr = scroll.getBoundingClientRect();
    const controls=[...p.querySelectorAll('button,input,select')].filter(el=>{const b=el.getBoundingClientRect();const st=getComputedStyle(el);return b.width>=2&&b.height>=2&&st.display!=='none'&&st.visibility!=='hidden';});
    let fails=0; const samples=[];
    // Only count controls visible inside the scroll viewport; below-fold controls
    // are reachable by scrolling (verified by probe-390-scroll.mjs) — not occluded.
    for(const el of controls){const b=el.getBoundingClientRect();const cx=b.left+b.width/2,cy=b.top+b.height/2;
      if(cy < sr.top || cy > sr.bottom) continue; // below/above fold, reachable by scroll
      if(cx<0||cy<0||cx>innerWidth||cy>innerHeight){fails++;continue;}
      const top=document.elementFromPoint(cx,cy);
      if(!(top&&(el===top||el.contains(top)||top.contains(el)))){fails++;if(samples.length<6)samples.push({id:el.id,text:(el.textContent||'').trim().slice(0,20),top:top?String(top.className).slice(0,30):null});}}
    // Also scroll to bottom and check controls visible there
    const prevScroll = scroll.scrollTop;
    scroll.scrollTop = scroll.scrollHeight;
    await sleep(300);
    for(const el of controls){const b=el.getBoundingClientRect();const cx=b.left+b.width/2,cy=b.top+b.height/2;
      if(cy < sr.top || cy > sr.bottom) continue;
      if(cx<0||cy<0||cx>innerWidth||cy>innerHeight){fails++;continue;}
      const top=document.elementFromPoint(cx,cy);
      if(!(top&&(el===top||el.contains(top)||top.contains(el)))){fails++;if(samples.length<6)samples.push({id:el.id,text:(el.textContent||'').trim().slice(0,20),top:top?String(top.className).slice(0,30):null});}}
    scroll.scrollTop = prevScroll;
    await sleep(100);
    const texts=['Untitled','STROKE MIN','Stroke Min','Pencil / Graphite','STYLE','BRUSH'];
    const vis={}; for(const t of texts){vis[t]=[...document.querySelectorAll('*')].some(el=>el.children.length===0&&(el.textContent||'').trim()===t&&el.getBoundingClientRect().width>0);}
    // scroll to find STROKE MIN / Stroke Min if not visible at top
    if(!vis['STROKE MIN'] && !vis['Stroke Min']){
      for(let y=0; y<=scroll.scrollHeight; y+=200){
        scroll.scrollTop = y; await sleep(100);
        for(const t of ['STROKE MIN','Stroke Min']){
          if([...document.querySelectorAll('*')].some(el=>el.children.length===0&&(el.textContent||'').trim()===t&&el.getBoundingClientRect().width>0)){ vis[t]=true; }
        }
        if(vis['STROKE MIN']||vis['Stroke Min']) break;
      }
      scroll.scrollTop = 0;
    }
    // normalize: accept either case
    if(vis['Stroke Min']) vis['STROKE MIN'] = true;
    return {panelRect:{x:pr.x,y:pr.y,w:pr.width,h:pr.height}, cardRect:{x:card.x,w:card.width},
      panelZ:getComputedStyle(p).zIndex, panelPos:getComputedStyle(p).position,
      controlCount:controls.length, hitFails:fails, samples, textsVisible:vis,
      closed:p.classList.contains('panel--mobile-closed')};
  });
  await page.screenshot({path:`${OUT}/hermes-390-panel-open.png`});
  // settings modal reachable?
  const settings = await page.evaluate(() => {
    const b=document.getElementById('btn-ui-settings'); const r=b?.getBoundingClientRect();
    const top=r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
    return {btnRect:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null, hit:!!top&&(b===top||b?.contains(top))};
  });
  console.log('B) 390 toggle before:', JSON.stringify(before));
  console.log('B) 390 panel open:', JSON.stringify(open,null,1));
  console.log('B) settings btn:', JSON.stringify(settings), 'errs:', errs);
  await ctx.close();
}
await browser.close();
