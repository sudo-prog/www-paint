import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const scroll=document.querySelector('.controls-scroll');
  const rules=[];
  const walk=(list,media,href)=>{for(const r of list){
    if(r.cssRules){walk([...r.cssRules],r.conditionText||media,href);continue;}
    if(!r.selectorText||!r.style)continue;
    if(!(r.style.overflow||r.style.overflowY||r.style.position||r.style.display))continue;
    let m=false;for(const s of r.selectorText.split(',')){try{if(scroll.matches(s.trim())){m=true;break;}}catch{}}
    if(m)rules.push({href:(href||'').split('/').pop(),media:media||'',sel:r.selectorText.slice(0,60),overflow:r.style.overflow,overflowY:r.style.overflowY,pos:r.style.position,display:r.style.display});
  }};
  for(const s of document.styleSheets){let rs;try{rs=[...s.cssRules];}catch{continue;}walk(rs,'',s.href);}
  const cs=getComputedStyle(scroll);
  return {computed:{overflow:cs.overflow,overflowY:cs.overflowY,display:cs.display,position:cs.position,height:cs.height,maxHeight:cs.maxHeight,flex:cs.flex},rules};
}),null,1));
await b.close();
