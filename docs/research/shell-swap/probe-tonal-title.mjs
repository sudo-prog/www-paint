import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('btn-media-mode').click());
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(()=>{
  const panel=document.getElementById('media-root');
  const titles=[...panel.querySelectorAll('.control-section__title')].map(t=>{
    const cs=getComputedStyle(t); const b=t.getBoundingClientRect();
    return {text:t.textContent, transform:cs.textTransform, y:Math.round(b.y), h:Math.round(b.height), vis:cs.visibility, display:cs.display};
  });
  const scroll=panel.querySelector('.media-scroll');
  return {titles, scrollH:scroll.scrollHeight, clientH:scroll.clientHeight, scrollTop:scroll.scrollTop,
    panelRect:panel.getBoundingClientRect(),
    tonalSection:(()=>{const s=[...panel.querySelectorAll('.control-section')].find(x=>x.textContent.includes('TONAL'));if(!s)return null;const b=s.getBoundingClientRect();return {y:Math.round(b.y),h:Math.round(b.height),id:s.id};})()};
}),null,1));
await b.close();
