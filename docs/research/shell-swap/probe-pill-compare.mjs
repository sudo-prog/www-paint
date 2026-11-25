import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});

async function measure(url, sel, label){
  const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  await p.goto(url,{waitUntil:'networkidle'});
  await p.waitForTimeout(2500);
  const r = await p.evaluate((sel)=>{
    const bar=document.querySelector(sel);
    if(!bar) return {missing:sel};
    const b=bar.getBoundingClientRect(); const cs=getComputedStyle(bar);
    const btns=[...bar.querySelectorAll('button')].map(x=>{const bb=x.getBoundingClientRect();const s=getComputedStyle(x);return {text:(x.textContent||'').trim().slice(0,12),w:Math.round(bb.width),h:Math.round(bb.height),font:s.fontSize,radius:s.borderRadius,pad:s.padding};});
    return {bar:{w:Math.round(b.width),h:Math.round(b.height),x:Math.round(b.x),y:Math.round(b.y)},radius:cs.borderRadius,pad:cs.padding,gap:cs.gap,bg:cs.backgroundColor,btnCount:btns.length,btns:btns.slice(0,8)};
  }, sel);
  console.log(label, JSON.stringify(r,null,1));
  await p.context().close();
}
// LAYERS reference insert-bar
await measure('http://127.0.0.1:8096/', '.insert-bar', 'LAYERS insert-bar:');
// WWW_PAINT action insert-bar AND motion pill
await measure('http://127.0.0.1:8099/index.html', '#insert-bar', 'WWW_PAINT #insert-bar (action):');
await measure('http://127.0.0.1:8099/index.html', '#motion-controls', 'WWW_PAINT #motion-controls (playback):');
await b.close();
