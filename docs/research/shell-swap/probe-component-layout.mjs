import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const cs=el=>el?getComputedStyle(el):null;
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
  const slider=document.querySelector('.control-slider');
  const label=slider?.querySelector('.slider-label');
  const row=slider?.querySelector('.slider-row');
  const input=slider?.querySelector('input[type=range]');
  const val=slider?.querySelector('.slider-value');
  const gen=document.querySelector('.generate-btn');
  const genContainer=document.querySelector('.generate-btn-container');
  const layer=document.querySelector('.layer-row');
  const layerKids=layer?[...layer.children].map(k=>({cls:String(k.className).slice(0,30),...rect(k)})):null;
  const body=document.querySelector('.control-section__body');
  return {
    slider:{...rect(slider),display:cs(slider)?.display,cols:cs(slider)?.gridTemplateColumns},
    label:rect(label), row:{...rect(row),display:cs(row)?.display}, input:rect(input), value:rect(val),
    bodyWidth:rect(body)?.w,
    gen:{...rect(gen),font:cs(gen)?.fontSize,pad:cs(gen)?.padding,minH:cs(gen)?.minHeight,lineH:cs(gen)?.lineHeight},
    genContainer:{...rect(genContainer),display:cs(genContainer)?.display,flex:cs(genContainer)?.flexDirection},
    layer:{...rect(layer),display:cs(layer)?.display,gap:cs(layer)?.gap}, layerKids,
    pill:rect(document.getElementById('insert-bar')), motion:rect(document.getElementById('motion-controls')), radiusBar:rect(document.querySelector('.radius-bar')),
  };
}),null,1));
await b.close();
