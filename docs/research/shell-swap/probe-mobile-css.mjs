import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('toggle-controls').click());
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const el=document.getElementById('controls-root');
  const cs=getComputedStyle(el);
  const card=document.getElementById('canvas-area');
  const ccs=getComputedStyle(card);
  const body=document.querySelector('.body');
  const rules=[];
  for (const s of document.styleSheets) {
    let rs; try { rs=[...s.cssRules]; } catch { continue; }
    const walk=(list,media)=>{ for(const r of list){
      if(r.cssRules){ walk([...r.cssRules], r.conditionText||media); continue; }
      if(!r.selectorText||!r.style) continue;
      if(!(r.style.position||r.style.zIndex||r.style.width)) continue;
      const sels=r.selectorText.split(',');
      let m=false; for(const x of sels){ try{ if(el.matches(x.trim())){m=true;break;} }catch{} }
      if(m) rules.push({sel:r.selectorText.slice(0,70),media:media||'',pos:r.style.position,z:r.style.zIndex,w:r.style.width});
    }};
    walk(rs,'');
  }
  return {
    panel:{pos:cs.position,z:cs.zIndex,top:cs.top,bottom:cs.bottom,width:cs.width,transform:cs.transform,vis:cs.visibility},
    card:{pos:ccs.position,z:ccs.zIndex},
    bodyOverflow:body?getComputedStyle(body).overflow:null,
    bodyPos:body?getComputedStyle(body).position:null,
    headerH:getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
    mq768:matchMedia('(max-width:768px)').matches,
    panelParent:el.parentElement.className,
    matchedRules:rules
  };
}),null,1));
await b.close();
