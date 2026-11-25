import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});

async function audit(url,label){
  const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  await p.goto(url,{waitUntil:'networkidle'});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const cs=el=>getComputedStyle(el);
    const rect=el=>{const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),r:Math.round(b.right),bt:Math.round(b.bottom)};};
    const groups={
      actionPill:[...document.querySelectorAll('#insert-bar button')],
      radiusBar:[...document.querySelectorAll('.radius-bar button')],
      motionPill:[...document.querySelectorAll('#motion-controls button')],
    };
    const out={};
    for (const [name,btns] of Object.entries(groups)) {
      const parent=btns[0]?.parentElement;
      const pr=parent?rect(parent):null;
      const rows=btns.map(el=>{
        const s=cs(el); const br=rect(el);
        const outside = pr ? (br.x<pr.x-1||br.r>pr.r+1||br.y<pr.y-1||br.bt>pr.bt+1) : false;
        return {text:(el.textContent||'').trim().slice(0,14)||el.getAttribute('aria-label')?.slice(0,14)||'',
          h:Math.round(parseFloat(s.height)),radius:s.borderRadius,font:s.fontSize,weight:s.fontWeight,
          pad:s.padding,transform:s.textTransform,tracking:s.letterSpacing,
          icon:!!el.querySelector('svg'),outside, w:br.w};
      });
      const uniq=k=>[...new Set(rows.map(r=>r[k]))];
      out[name]={parent:pr,count:rows.length,rows,
        distinct:{heights:uniq('h'),radii:uniq('radius'),fonts:uniq('font'),weights:uniq('weight'),pads:uniq('pad'),transforms:uniq('transform'),tracking:uniq('tracking')},
        outsideCount:rows.filter(r=>r.outside).length};
    }
    return out;
  });
  console.log('=== '+label+' ===');
  for (const [name,g] of Object.entries(r)) {
    console.log(name,'parent',g.parent,'btns',g.count,'outside',g.outsideCount);
    console.log('  distinct:',JSON.stringify(g.distinct));
    for (const row of g.rows) console.log('   ',JSON.stringify(row));
  }
  await p.context().close();
}
await audit('http://127.0.0.1:8096/','LAYERS reference');
await audit('http://127.0.0.1:8099/index.html','WWW_PAINT current');
await b.close();
