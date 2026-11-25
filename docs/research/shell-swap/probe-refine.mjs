import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});

async function scan(url,label){
  const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  await p.goto(url,{waitUntil:'networkidle'});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const cs=el=>el?getComputedStyle(el):null;
    const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
    const q=s=>document.querySelector(s);
    const radius=s=>{const el=q(s);return el?{radius:cs(el).borderRadius,...rect(el)}:null;};
    // find "Choose file" button anywhere
    const choose=[...document.querySelectorAll('button,input[type=file],label')].filter(el=>(el.textContent||'').trim()==='Choose file'||(el.value||'')==='Choose file'||(el.getAttribute('aria-label')||'')==='Choose file');
    const chooseInfo=choose.map(el=>({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,40),...rect(el),
      display:cs(el).display,color:cs(el).color,bg:cs(el).backgroundColor,border:cs(el).border,radius:cs(el).borderRadius,
      parentCls:String(el.parentElement?.className).slice(0,40),parentRect:rect(el.parentElement)}));
    // top selection buttons (radius-bar area)
    const rb=q('.radius-bar');
    const rbBtns=rb?[...rb.querySelectorAll('button')].map(x=>({text:(x.textContent||'').trim().slice(0,12),cls:String(x.className).slice(0,30),font:cs(x).fontSize,radius:cs(x).borderRadius,pad:cs(x).padding,...rect(x)})):[];
    return {
      radii:{
        shell:radius('#app')||radius('.app'),
        panelLeft:radius('#controls-root'),
        panelRight:radius('#layers-root'),
        canvasCard:radius('.canvas-card'),
        canvasBody:radius('.canvas-body'),
        frame:radius('.canvas-frame'),
        insertBar:radius('#insert-bar'),
        radiusBar:radius('.radius-bar'),
        motionBar:radius('#motion-controls'),
        controlSection:radius('.control-section'),
        insertBtn:radius('.insert-btn'),
        panelHead:radius('.panel-head'),
      },
      glassTokens:{
        blur:getComputedStyle(document.documentElement).getPropertyValue('--glass-blur'),
        alpha:getComputedStyle(document.documentElement).getPropertyValue('--panel-alpha'),
        bright:getComputedStyle(document.documentElement).getPropertyValue('--glass-brightness'),
      },
      radiusBar:{...rect(rb),bg:cs(rb)?.backgroundColor,border:cs(rb)?.border,shadow:cs(rb)?.boxShadow,backdrop:cs(rb)?.backdropFilter},
      radiusBarBtns:rbBtns,
      chooseFile:chooseInfo,
    };
  });
  console.log('=== '+label+' ===');
  console.log(JSON.stringify(r,null,1));
  await p.context().close();
}
await scan('http://127.0.0.1:8096/','LAYERS');
await scan('http://127.0.0.1:8099/index.html','WWW_PAINT');
await b.close();
