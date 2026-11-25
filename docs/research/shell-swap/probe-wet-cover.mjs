import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
await p.evaluate(()=>document.getElementById('btn-media-mode').click());
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(()=>{
  const mr=document.getElementById('media-root');
  const wet=[...mr.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='WET MEDIA');
  const wb=wet.getBoundingClientRect();
  const stack=document.elementsFromPoint(wb.left+wb.width/2,wb.top+wb.height/2).slice(0,6).map(e=>e.tagName+(e.id?'#'+e.id:'')+'.'+String(e.className).split(' ').slice(0,2).join('.'));
  // what is the radius-bar / insert-bar / motion doing now?
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),display:getComputedStyle(el).display};};
  return {wetRect:{x:Math.round(wb.x),y:Math.round(wb.y),w:Math.round(wb.width),h:Math.round(wb.height)},stack,
    radiusBar:rect(document.querySelector('.radius-bar')),
    insertBar:rect(document.getElementById('insert-bar')),
    motion:rect(document.getElementById('motion-controls')),
    mediaZ:getComputedStyle(mr).zIndex, mediaPos:getComputedStyle(mr).position,
    canvasZ:getComputedStyle(document.getElementById('canvas-area')).zIndex};
}),null,1));
await b.close();
