import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('btn-media-mode').click());
await p.waitForTimeout(800);
const r = await p.evaluate(async ()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const panel=document.getElementById('media-root');
  const scroll=panel.querySelector('.media-scroll');
  const pr=panel.getBoundingClientRect();
  const out={panelRect:{x:Math.round(pr.x),y:Math.round(pr.y),w:Math.round(pr.width),h:Math.round(pr.height)},
    panelPos:getComputedStyle(panel).position,panelZ:getComputedStyle(panel).zIndex,
    scrollH:scroll?.scrollHeight,clientH:scroll?.clientHeight};
  // find TONAL MASKS + band labels by scrolling
  const targets=['TONAL MASKS','Background','Shadows','Midtones','Highlights'];
  const found={};
  for(let y=0;y<=(scroll?.scrollHeight||0);y+=250){
    scroll.scrollTop=y; await sleep(120);
    for(const t of targets){
      if(found[t]) continue;
      const els=[...panel.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()===t);
      if(els.length){ const b=els[0].getBoundingClientRect(); const sr=scroll.getBoundingClientRect();
        if(b.top>=sr.top-1&&b.bottom<=sr.bottom+1&&b.width>0){
          const top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
          found[t]={scrollTop:y,y:Math.round(b.y),hit:!!top&&(els[0]===top||els[0].contains(top)||top.contains(els[0]))};
        } }
    }
  }
  out.found=found;
  // band toggle ids + masks-lo/preview reachable?
  scroll.scrollTop=scroll.scrollHeight; await sleep(300);
  const ids=['media-masks-lo','media-masks-preview','media-masks-band-background','media-masks-band-shadows','media-masks-band-midtones','media-masks-band-highlights'];
  out.ids={};
  for(const id of ids){ const el=document.getElementById(id);
    if(!el){ out.ids[id]='MISSING'; continue; }
    const b=el.getBoundingClientRect(); const sr=scroll.getBoundingClientRect();
    const inView=b.top>=sr.top-1&&b.bottom<=sr.bottom+1;
    const top=inView?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
    out.ids[id]={inView,hit:!!top&&(el===top||el.contains(top)||top.contains(el)),y:Math.round(b.y)};
  }
  return out;
});
console.log(JSON.stringify(r,null,1));
await b.close();
