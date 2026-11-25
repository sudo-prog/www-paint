import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const scroll=document.querySelector('.controls-scroll');
  const cs=getComputedStyle(scroll);
  const seg=[...scroll.querySelectorAll('.segmented__btn')].find(x=>x.getBoundingClientRect().top>scroll.getBoundingClientRect().bottom);
  const before=seg?{y:Math.round(seg.getBoundingClientRect().y),pos:getComputedStyle(seg).position}:null;
  // check every ancestor between seg and scroll for position/transform/contain
  let e=seg, chain=[];
  while(e && e!==scroll){ const s=getComputedStyle(e); chain.push({cls:String(e.className).slice(0,30),pos:s.position,transform:s.transform,contain:s.contain,willChange:s.willChange}); e=e.parentElement; }
  // is the scroll host a scroll container that clips? test by setting overflow hidden explicitly
  const sr=scroll.getBoundingClientRect();
  scroll.style.overflow='hidden';
  const afterHidden=seg?document.elementFromPoint(seg.getBoundingClientRect().left+5,seg.getBoundingClientRect().top+5):null;
  scroll.style.overflow='';
  // check clip-path / mask on scroll or panel
  const panel=document.getElementById('controls-root');
  return {scrollOverflow:cs.overflow,scrollOverflowY:cs.overflowY,scrollClipPath:cs.clipPath,scrollContain:cs.contain,scrollPosition:cs.position,
    panelOverflow:getComputedStyle(panel).overflow, panelClipPath:getComputedStyle(panel).clipPath,
    segBefore:before, chain,
    hitAfterOverflowHidden:afterHidden?String(afterHidden.className).slice(0,30):null,
    scrollRect:{y:Math.round(sr.y),h:Math.round(sr.height),bottom:Math.round(sr.bottom)},
    segY:seg?Math.round(seg.getBoundingClientRect().y):null};
}),null,1));
await b.close();
