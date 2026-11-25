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
  // pick a control whose centre is below the scroll box bottom
  const seg=[...scroll.querySelectorAll('.segmented__btn')].find(x=>{const b=x.getBoundingClientRect();return b.top>sr.bottom;});
  const sb=seg.getBoundingClientRect();
  const cx=sb.left+sb.width/2, cy=sb.top+sb.height/2;
  const hitBefore=document.elementFromPoint(cx,cy);
  // scroll it into view within the host
  seg.scrollIntoView({block:'center'});
  const after=seg.getBoundingClientRect();
  const hitAfter=document.elementFromPoint(after.left+after.width/2,after.top+after.height/2);
  const inBox=after.top>=sr.top && after.bottom<=sr.bottom;
  // now scroll back to top and check the host clips via a forced reflow read
  scroll.scrollTop=0;
  const seg2=[...scroll.querySelectorAll('.segmented__btn')][0];
  const r2=seg2.getBoundingClientRect();
  return {
    scrollBottom:Math.round(sr.bottom),
    segBeforeY:Math.round(sb.y), hitBefore:hitBefore?String(hitBefore.className).slice(0,30):null,
    afterScrollIntoView:{y:Math.round(after.y),inBox,hit:hitAfter?(hitAfter===seg||seg.contains(hitAfter)):false,hitCls:hitAfter?String(hitAfter.className).slice(0,30):null},
    backAtTop:{segY:Math.round(r2.y),belowBottom:r2.top>sr.bottom},
    scrollScrollTop:scroll.scrollTop
  };
}),null,1));
await b.close();
