import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
const r = await p.evaluate(async ()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // nearest scrollable ancestor
  const scrollAnc=el=>{let e=el.parentElement;while(e){const s=getComputedStyle(e);if(/(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+2)return e;e=e.parentElement;}return null;};
  const inScrollBox=(el,sa)=>{if(!sa)return true;const b=el.getBoundingClientRect(),s=sa.getBoundingClientRect();const cy=b.top+b.height/2;return cy>=s.top-1&&cy<=s.bottom+1;};
  const hit=el=>{const b=el.getBoundingClientRect();const cx=b.left+b.width/2,cy=b.top+b.height/2;if(cx<0||cy<0||cx>innerWidth||cy>innerHeight)return false;const t=document.elementFromPoint(cx,cy);return !!t&&(el===t||el.contains(t)||t.contains(el));};
  const vis=el=>{const b=el.getBoundingClientRect();const s=getComputedStyle(el);return b.width>=2&&b.height>=2&&s.display!=='none'&&s.visibility!=='hidden'&&b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight;};
  const controls=[...document.querySelectorAll('button,[role="button"],a,input,select,[tabindex]')].filter(vis);
  // PASS 1: as-found, but EXCLUDE controls outside their scroll host's visible box (below/above fold = reachable by scroll, not occluded)
  let realOccluded=0, belowFold=0; const occ=[];
  for(const el of controls){const sa=scrollAnc(el);if(!inScrollBox(el,sa)){belowFold++;continue;}if(!hit(el)){realOccluded++;if(occ.length<8)occ.push({id:el.id,cls:String(el.className).slice(0,30),text:(el.textContent||'').trim().slice(0,15)});}}
  // PASS 2: scroll every scroll host to bottom, re-test the previously below-fold controls
  const hosts=[...new Set(controls.map(scrollAnc).filter(Boolean))];
  for(const h of hosts){h.scrollTop=h.scrollHeight;}
  await sleep(400);
  let stillOccluded=0; const occ2=[];
  for(const el of controls){const sa=scrollAnc(el);if(!inScrollBox(el,sa))continue;if(!hit(el)){stillOccluded++;if(occ2.length<8)occ2.push({id:el.id,cls:String(el.className).slice(0,30),text:(el.textContent||'').trim().slice(0,15)});}}
  // PASS 3: scroll hosts back to top, confirm toggle-theme strip chip (the one non-scroll hitFail)
  for(const h of hosts){h.scrollTop=0;}
  await sleep(300);
  const tt=document.getElementById('toggle-theme');
  const ttHit=tt?hit(tt):null;
  const ttInfo=tt?(()=>{const b=tt.getBoundingClientRect();const t=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {rect:{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)},top:t?t.tagName+'.'+String(t.className).slice(0,25):null,inScroll:!!scrollAnc(tt)};})():null;
  return {totalControls:controls.length, asFound:{realOccluded,belowFold,occ}, afterScrollToBottom:{stillOccluded,occ2}, toggleTheme:{hit:ttHit,info:ttInfo}};
});
console.log(JSON.stringify(r,null,1));
await b.close();
