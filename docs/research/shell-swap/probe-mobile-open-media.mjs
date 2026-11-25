import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const out={};
  const ib=document.getElementById('insert-bar');
  out.insertBar=ib?{rect:ib.getBoundingClientRect(),display:getComputedStyle(ib).display,vis:getComputedStyle(ib).visibility}:null;
  const open=document.getElementById('btn-load-image');
  if(open){const b=open.getBoundingClientRect();const lbl=open.querySelector('.insert-btn-label');const lb=lbl?lbl.getBoundingClientRect():null;
    out.open={rect:{x:b.x,y:b.y,w:b.width,h:b.height},labelText:lbl?lbl.textContent:null,labelRect:lb?{x:lb.x,y:lb.y,w:lb.width,h:lb.height}:null,labelDisplay:lbl?getComputedStyle(lbl).display:null,inViewport:b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight};
    const t=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    out.open.hit=t?(t===open||open.contains(t)):false; out.open.top=t?t.tagName+'.'+String(t.className).slice(0,25):null;}
  // media toggle
  const mm=document.getElementById('btn-media-mode');
  out.mediaBtn=mm?{rect:mm.getBoundingClientRect(),hit:(()=>{const b=mm.getBoundingClientRect();const t=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return t?(t===mm||mm.contains(t)):false;})()}:null;
  return out;
});
console.log('BEFORE media tap:',JSON.stringify(r,null,1));
await p.evaluate(()=>document.getElementById('btn-media-mode').click());
await p.waitForTimeout(800);
const r2=await p.evaluate(()=>{
  const mr=document.getElementById('media-root');
  const b=mr.getBoundingClientRect();
  const wet=[...mr.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='WET MEDIA');
  const wb=wet?wet.getBoundingClientRect():null;
  return {mediaRect:{x:b.x,y:b.y,w:b.width,h:b.height},pos:getComputedStyle(mr).position,z:getComputedStyle(mr).zIndex,
    closed:mr.classList.contains('panel--mobile-closed'),hidden:mr.classList.contains('panel--hidden'),
    wetMedia:wb?{y:Math.round(wb.y),x:Math.round(wb.x),vis:getComputedStyle(wet).visibility,inViewport:wb.top>=0&&wb.bottom<=innerHeight}:null,
    controlsRootHidden:document.getElementById('controls-root').classList.contains('panel--hidden')};
});
console.log('AFTER media tap:',JSON.stringify(r2,null,1));
await b.close();
