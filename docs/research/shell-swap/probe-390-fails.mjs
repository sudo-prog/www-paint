import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('toggle-controls').click());
await p.waitForTimeout(1200);
const r = await p.evaluate(()=>{
  const panel=document.getElementById('controls-root');
  const out=[];
  for(const el of panel.querySelectorAll('button,input,select')){
    const b=el.getBoundingClientRect(); const st=getComputedStyle(el);
    if(b.width<2||b.height<2||st.display==='none'||st.visibility==='hidden') continue;
    const cx=b.left+b.width/2, cy=b.top+b.height/2;
    if(cx<0||cy<0||cx>innerWidth||cy>innerHeight){ out.push({id:el.id,text:(el.textContent||'').trim().slice(0,18),reason:'center-outside-viewport',rect:{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}}); continue; }
    const top=document.elementFromPoint(cx,cy);
    const hit=!!top&&(el===top||el.contains(top)||top.contains(el));
    if(!hit) out.push({id:el.id,text:(el.textContent||'').trim().slice(0,18),reason:'occluded',rect:{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)},top:top?{tag:top.tagName,id:top.id,cls:String(top.className).slice(0,40)}:null});
  }
  const scroll=panel.querySelector('.controls-scroll');
  return {fails:out, scrollRect:scroll?scroll.getBoundingClientRect():null, scrollH:scroll?.scrollHeight, clientH:scroll?.clientHeight,
    panelRect:panel.getBoundingClientRect(),
    strokeMin:(()=>{const els=[...panel.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='STROKE MIN');return els.map(e=>{const b=e.getBoundingClientRect();return {y:Math.round(b.y),h:Math.round(b.height),vis:getComputedStyle(e).visibility};});})()};
});
console.log(JSON.stringify(r,null,1));
await b.close();
