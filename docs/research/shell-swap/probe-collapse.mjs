import { createRequire } from 'node:module';
const require=createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const {chromium}=require('playwright-core');
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>[...document.querySelectorAll('.nav-btn')].find(x=>x.dataset.nav==='collapsed')?.click());
await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(()=>{
 const el=document.getElementById('controls-root');
 const cs=getComputedStyle(el);
 const rules=[];
 for(const s of document.styleSheets){let rs;try{rs=[...s.cssRules]}catch{continue}
  const walk=(list,media)=>{for(const r of list){if(r.cssRules){walk([...r.cssRules],r.conditionText||media);continue}
   if(!r.selectorText||!r.style||!r.style.width)continue;
   let m=false;for(const sel of r.selectorText.split(',')){try{if(el.matches(sel.trim())){m=true;break}}catch{}}
   if(m)rules.push({sel:r.selectorText.slice(0,80),media:media||'',width:r.style.width,imp:r.style.getPropertyPriority('width')});
  }};walk(rs,'');
 }
 return {width:cs.width,minWidth:cs.minWidth,maxWidth:cs.maxWidth,classes:el.className,
  varNavW:getComputedStyle(document.documentElement).getPropertyValue('--nav-w'),rules};
}),null,1));
await b.close();
