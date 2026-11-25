import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const pts=[[120,450],[120,300],[696,30],[696,150],[320,450],[696,450],[696,800],[1300,300],[400,200],[1000,700]];
  const out=pts.map(([x,y])=>{
    const el=document.elementFromPoint(x,y);
    const chain=[]; let e=el;
    while(e&&chain.length<5){chain.push(e.tagName+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ').slice(0,2).join('.'):''));e=e.parentElement;}
    const cs=el?getComputedStyle(el):null;
    return {x,y,chain,bg:cs?.backgroundColor,bgImg:cs?.backgroundImage?.slice(0,60)};
  });
  const card=document.getElementById('canvas-area');
  const body=document.querySelector('.canvas-body');
  const frame=document.getElementById('canvas-frame');
  const ph=document.getElementById('canvas-placeholder');
  const r=el=>{const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
  return {points:out,card:r(card),cardBg:getComputedStyle(card).backgroundImage.slice(0,90),
    body:r(body),bodyBg:getComputedStyle(body).backgroundImage.slice(0,140),
    frame:r(frame),frameBg:getComputedStyle(frame).backgroundColor,
    ph:ph?{...r(ph),display:getComputedStyle(ph).display,bg:getComputedStyle(ph).backgroundColor}:null};
}),null,1));
await b.close();
