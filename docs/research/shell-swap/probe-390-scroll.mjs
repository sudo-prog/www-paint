import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('toggle-controls').click());
await p.waitForTimeout(1200);
const r = await p.evaluate(async ()=>{
  const panel=document.getElementById('controls-root');
  const scroll=panel.querySelector('.controls-scroll');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const test=()=>{
    let fails=0,occluded=0,outside=0; const samples=[];
    for(const el of panel.querySelectorAll('button,input,select')){
      const b=el.getBoundingClientRect(); const st=getComputedStyle(el);
      if(b.width<2||b.height<2||st.display==='none'||st.visibility==='hidden') continue;
      const sr=scroll.getBoundingClientRect();
      // only count controls inside the scroll viewport (others are chrome or below fold)
      const cx=b.left+b.width/2, cy=b.top+b.height/2;
      if(cy<sr.top||cy>sr.bottom){ outside++; continue; }
      if(cx<0||cy<0||cx>innerWidth||cy>innerHeight){ fails++; continue; }
      const top=document.elementFromPoint(cx,cy);
      if(!(top&&(el===top||el.contains(top)||top.contains(el)))){ fails++; occluded++; if(samples.length<5)samples.push({text:(el.textContent||'').trim().slice(0,15),top:top?String(top.className).slice(0,30):null}); }
    }
    return {fails,occluded,outside,samples};
  };
  const atTop=test();
  scroll.scrollTop=scroll.scrollHeight; await sleep(400);
  const atBottom=test();
  // STROKE MIN reachable by scrolling?
  scroll.scrollTop=0; await sleep(200);
  let strokeMinFound=null;
  for(let y=0;y<=scroll.scrollHeight;y+=300){
    scroll.scrollTop=y; await sleep(120);
    const els=[...panel.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='STROKE MIN');
    if(els.length){ const b=els[0].getBoundingClientRect(); const sr=scroll.getBoundingClientRect();
      if(b.top>=sr.top&&b.bottom<=sr.bottom){ strokeMinFound={scrollTop:y,y:Math.round(b.y)}; break; } }
  }
  // style picker dropdown opens over the panel?
  scroll.scrollTop=0; await sleep(200);
  const trig=panel.querySelector('.style-picker__trigger');
  trig?.click(); await sleep(400);
  const dd=panel.querySelector('.style-picker__dropdown')||document.querySelector('.style-picker__dropdown');
  let ddState=null;
  if(dd){ const b=dd.getBoundingClientRect(); const cs=getComputedStyle(dd);
    const cat=[...dd.querySelectorAll('*')].find(e=>(e.textContent||'').trim()==='Drawing');
    let catHit=null;
    if(cat){ const cb=cat.getBoundingClientRect(); const top=document.elementFromPoint(cb.left+cb.width/2,cb.top+cb.height/2); catHit=!!top&&(cat===top||cat.contains(top)||top.contains(cat)); }
    ddState={rect:{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)},display:cs.display,vis:cs.visibility,z:cs.zIndex,drawingHit:catHit};
  }
  return {atTop,atBottom,strokeMinFound,ddState,scrollH:scroll.scrollHeight,clientH:scroll.clientHeight};
});
console.log(JSON.stringify(r,null,1));
await b.close();
