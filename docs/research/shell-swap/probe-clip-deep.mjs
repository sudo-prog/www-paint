import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const scroll=document.querySelector('.controls-scroll');
  const sr=scroll.getBoundingClientRect();
  const seg=[...scroll.querySelectorAll('.segmented__btn')].find(x=>x.getBoundingClientRect().top>sr.bottom);
  const sb=seg.getBoundingClientRect();
  // elementsFromPoint (plural) — full paint stack at the seg centre
  const stack=document.elementsFromPoint(sb.left+sb.width/2,sb.top+sb.height/2).slice(0,8).map(e=>e.tagName+(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]);
  // is seg actually a descendant of scroll in the DOM?
  const inDom=scroll.contains(seg);
  // offsetParent chain
  let e=seg,op=[];while(e){op.push(e.tagName+(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ')[0]+'(pos:'+getComputedStyle(e).position+')');e=e.offsetParent;}
  // check scroll's own overflow clip via a test: temporarily hide the pinned row + footer
  const pinned=document.querySelector('.audit-pinned-actions');
  const footer=document.getElementById('status-bar');
  const pd=pinned?getComputedStyle(pinned).display:null, fd=footer?getComputedStyle(footer).display:null;
  if(pinned)pinned.style.display='none'; if(footer)footer.style.display='none';
  const hitNoPinned=document.elementFromPoint(sb.left+sb.width/2,sb.top+sb.height/2);
  if(pinned)pinned.style.display=''; if(footer)footer.style.display='';
  return {segY:Math.round(sb.y),scrollBottom:Math.round(sr.bottom),inDom,stack,offsetParentChain:op,
    hitWithPinnedHidden:hitNoPinned?String(hitNoPinned.className).slice(0,30):null,
    pinnedDisplay:pd,footerDisplay:fd};
}),null,1));
await b.close();
