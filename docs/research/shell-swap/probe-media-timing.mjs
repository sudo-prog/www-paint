import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
const box=await p.evaluate(()=>{const el=document.getElementById('btn-media-mode');const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});
await p.mouse.click(box.x,box.y);
for (const wait of [50,150,300,500,800,1200]) {
  await p.waitForTimeout(wait===50?50:wait-([50,150,300,500,800][[50,150,300,500,800,1200].indexOf(wait)-1]||0));
  const r=await p.evaluate(()=>{
    const mr=document.getElementById('media-root');
    const wet=[...mr.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim()==='WET MEDIA');
    const wb=wet?wet.getBoundingClientRect():null;
    const cs=getComputedStyle(mr);
    return {t:performance.now(),closed:mr.classList.contains('panel--mobile-closed'),transform:cs.transform,
      wetY:wb?Math.round(wb.y):null,wetX:wb?Math.round(wb.x):null,
      wetInViewport:wb?(wb.top>=0&&wb.bottom<=innerHeight&&wb.left>=0&&wb.right<=innerWidth):false,
      rbDisplay:getComputedStyle(document.querySelector('.radius-bar')).display};
  });
  console.log(wait+'ms',JSON.stringify(r));
}
await b.close();
