import { createRequire } from 'node:module';
const require=createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const {chromium}=require('playwright-core');
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2000);
await p.evaluate(()=>document.getElementById('btn-library-mode')?.click());
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(()=>{
 const row=document.querySelector('.library-import-row');
 const info=el=>{const b=el.getBoundingClientRect();const cs=getComputedStyle(el);return {tag:el.tagName,id:el.id,type:el.type||'',text:(el.textContent||'').trim().slice(0,30),value:(el.value||'').slice(0,30),cls:String(el.className).slice(0,40),x:Math.round(b.x),w:Math.round(b.width),h:Math.round(b.height),display:cs.display,bg:cs.backgroundColor,color:cs.color,appearance:cs.appearance};};
 return {row:info(row),children:row?[...row.children].map(info):[],allFiles:[...document.querySelectorAll('#style-library-root input[type=file], .library-import input')].map(info)};
}),null,1));
await b.close();
