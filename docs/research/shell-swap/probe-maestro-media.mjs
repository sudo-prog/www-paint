import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
// simulate Maestro: assertVisible btn-media-mode, btn-paint-mode, then REAL mouse tap on btn-media-mode centre
const box=await p.evaluate(()=>{const el=document.getElementById('btn-media-mode');const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};});
await p.mouse.click(box.x+box.w/2, box.y+box.h/2);
await p.waitForTimeout(1000);
const r=await p.evaluate(()=>{
  const mr=document.getElementById('media-root');
  const wet=[...mr.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='WET MEDIA');
  const wb=wet?wet.getBoundingClientRect():null;
  const cs=getComputedStyle(mr);
  return {mediaMode:window.__app?window.__app._mediaMode:null,
    mediaRect:{x:Math.round(mr.getBoundingClientRect().x),y:Math.round(mr.getBoundingClientRect().y),w:Math.round(mr.getBoundingClientRect().width)},
    pos:cs.position,z:cs.zIndex,vis:cs.visibility,display:cs.display,
    closed:mr.classList.contains('panel--mobile-closed'),hidden:mr.classList.contains('panel--hidden'),
    wet:wb?{y:Math.round(wb.y),inViewport:wb.top>=0&&wb.bottom<=innerHeight,vis:getComputedStyle(wet).visibility}:null,
    wetHit:wb?(()=>{const t=document.elementFromPoint(wb.left+wb.width/2,wb.top+wb.height/2);return t?(t===wet||wet.contains(t)||t.contains(wet)):false;})():null};
});
console.log('mouse-tap result:',JSON.stringify(r,null,1),'errs:',errs);
await b.close();
