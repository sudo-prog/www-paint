import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const out={};
for (const [w,h] of [[390,844],[1440,900]]) {
  const p = await (await b.newContext({viewport:{width:w,height:h}})).newPage();
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(2500);
  out[`${w}`]=await p.evaluate(()=>{
    const vis=el=>{const b=el.getBoundingClientRect();const s=getComputedStyle(el);return b.width>=2&&b.height>=2&&s.display!=='none'&&s.visibility!=='hidden'&&b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight;};
    // every visible text-bearing control: check label clipping (scrollWidth>clientWidth) and wrap
    const labels=[];
    for(const el of document.querySelectorAll('button, .btn-label, .strip-chip, .strip-name, .radius-btn, .nav-btn, .panel-title, .status-label, .status-value')){
      if(!vis(el))continue;
      const b=el.getBoundingClientRect();
      const txt=(el.textContent||'').trim();
      if(!txt)continue;
      const clip=el.scrollWidth-el.clientWidth;
      const lh=parseFloat(getComputedStyle(el).lineHeight)||16;
      const lines=Math.round(b.height/lh);
      const past=b.right>innerWidth+1||b.left<-1;
      if(clip>1||past||lines>2) labels.push({txt:txt.slice(0,20),cls:String(el.className).slice(0,25),clip,past,lines,w:Math.round(b.width),x:Math.round(b.x),right:Math.round(b.right)});
    }
    // horizontal scroll check
    const docX=Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth);
    // any element wider than viewport?
    const wide=[...document.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>innerWidth+2&&vis(e);}).slice(0,5).map(e=>e.tagName+'.'+String(e.className).slice(0,25));
    return {clippedOrPastLabels:labels, docOverflowX:docX, wideElements:wide, innerWidth};
  });
  await p.context().close();
}
await b.close();
console.log(JSON.stringify(out,null,1));
