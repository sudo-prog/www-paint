import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
for (const [w,h,mode] of [[1440,900,'expanded'],[1440,900,'navbar'],[390,844,'navbar']]) {
  const p = await (await b.newContext({viewport:{width:w,height:h}})).newPage();
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(2000);
  if(mode==='navbar') await p.evaluate(()=>[...document.querySelectorAll('.nav-btn')].find(x=>x.dataset.nav==='collapsed')?.click());
  await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{
    const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom),right:Math.round(b.right)};};
    const motion=document.getElementById('motion-controls');
    const insert=document.getElementById('insert-bar');
    const rb=document.querySelector('.radius-bar');
    const overlap=(a,b)=>a&&b&&a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
    return {motion:rect(motion),insert:rect(insert),radiusBar:rect(rb),
      motionOverInsert:overlap(rect(motion),rect(insert)),
      motionOverRadius:overlap(rect(motion),rect(rb)),
      insertOverRadius:overlap(rect(insert),rect(rb)),
      motionDisplay:motion?getComputedStyle(motion).display:null,
      motionChildren:motion?motion.children.length:null};
  });
  console.log(w,mode,JSON.stringify(r));
  await p.context().close();
}
await b.close();
