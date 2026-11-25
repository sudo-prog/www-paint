import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const gen=document.querySelector('.generate-btn');
  const cont=gen?.parentElement;
  const cs=el=>el?getComputedStyle(el):null;
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
  return {
    gen:{...rect(gen),flex:cs(gen)?.flex,width:cs(gen)?.width,minW:cs(gen)?.minWidth,maxW:cs(gen)?.maxWidth,whiteSpace:cs(gen)?.whiteSpace,display:cs(gen)?.display,text:gen?.textContent},
    cont:{...rect(cont),cls:String(cont?.className),display:cs(cont)?.display,flexDir:cs(cont)?.flexDirection,width:cs(cont)?.width},
    contParent:{...rect(cont?.parentElement),cls:String(cont?.parentElement?.className).slice(0,30),display:cs(cont?.parentElement)?.display},
    siblings:cont?[...cont.children].map(c=>({cls:String(c.className).slice(0,25),...rect(c),flex:cs(c)?.flex})):null
  };
}),null,1));
await b.close();
