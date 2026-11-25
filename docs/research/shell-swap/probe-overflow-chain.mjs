import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const el=document.getElementById('ctrl-structureAlign');
  const chain=[]; let e=el;
  while(e && e!==document.documentElement){
    const cs=getComputedStyle(e); const b=e.getBoundingClientRect();
    chain.push({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,35),overflow:cs.overflow,overflowY:cs.overflowY,contain:cs.contain,clipPath:cs.clipPath,y:Math.round(b.y),h:Math.round(b.height),scrollH:e.scrollHeight,clientH:e.clientHeight});
    e=e.parentElement;
  }
  // does the scroll host actually clip? compare a child below its bottom
  const scroll=document.querySelector('.controls-scroll');
  const sr=scroll.getBoundingClientRect();
  const seg=[...scroll.querySelectorAll('.segmented__btn')].find(x=>x.getBoundingClientRect().top>sr.bottom);
  let segHit=null;
  if(seg){const b=seg.getBoundingClientRect();const top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);segHit={text:seg.textContent.trim(),y:Math.round(b.y),top:top?String(top.className).slice(0,30):null};}
  return {chain, scrollRect:{y:Math.round(sr.y),bottom:Math.round(sr.bottom)}, segHit};
}),null,1));
await b.close();
