import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const panel=document.getElementById('controls-root');
  const cs=getComputedStyle(panel);
  const kids=[...panel.children].map(k=>{
    const b=k.getBoundingClientRect(); const s=getComputedStyle(k);
    return {cls:String(k.className).slice(0,40)||k.tagName, y:Math.round(b.y), h:Math.round(b.height), pos:s.position, flex:s.flex, z:s.zIndex, overflowY:s.overflowY};
  });
  const scroll=panel.querySelector('.controls-scroll');
  const sr=scroll.getBoundingClientRect();
  // where do the failing controls sit relative to the scroll box?
  const fails=['ctrl-structureAlign','ctrl-alignJitter'];
  const failInfo=fails.map(id=>{const el=document.getElementById(id);if(!el)return{id,missing:true};const b=el.getBoundingClientRect();return{id,y:Math.round(b.y),h:Math.round(b.height),insideScroll:scroll.contains(el),belowScrollBottom:b.top>sr.bottom};});
  const seg=[...panel.querySelectorAll('.segmented__btn')].slice(0,4).map(el=>{const b=el.getBoundingClientRect();return{text:el.textContent.trim(),y:Math.round(b.y),belowScrollBottom:b.top>sr.bottom};});
  const pinned=panel.querySelector('.audit-pinned-actions')||panel.querySelector('.generate-btn-container');
  const footer=panel.querySelector('#status-bar');
  return {panelDisplay:cs.display,panelFlexDir:cs.flexDirection,panelH:Math.round(panel.getBoundingClientRect().height),
    kids, scrollRect:{y:Math.round(sr.y),h:Math.round(sr.height),bottom:Math.round(sr.bottom)}, scrollH:scroll.scrollHeight, clientH:scroll.clientHeight,
    failInfo, seg, pinned:pinned?{y:Math.round(pinned.getBoundingClientRect().y),h:Math.round(pinned.getBoundingClientRect().height),parent:pinned.parentElement.className||pinned.parentElement.tagName}:null,
    footer:footer?{y:Math.round(footer.getBoundingClientRect().y),h:Math.round(footer.getBoundingClientRect().height),parent:footer.parentElement.id}:null};
}),null,1));
await b.close();
