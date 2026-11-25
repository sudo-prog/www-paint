import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const b = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});

async function grab(url, fn, label){
  const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
  await p.goto(url,{waitUntil:'networkidle'});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(fn);
  console.log('=== '+label+' ===');
  console.log(JSON.stringify(r,null,1));
  await p.context().close();
}

// LAYERS component inventory: tree rows, prop sections, ctl rows, inspector controls
await grab('http://127.0.0.1:8096/', ()=>{
  const cs=el=>el?getComputedStyle(el):null;
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height)};};
  const q=s=>document.querySelector(s);
  const treeRow=q('.tree-row');
  const sectionHead=q('.section-head');
  const ctl=q('.ctl');
  const ctlLabel=q('.ctl-label');
  const ctlRange=q('.ctl-range');
  const ctlSelect=q('.ctl-select');
  const inspTitle=q('.insp-title');
  const panelTitle=q('.panel-title');
  return {
    treeRow:{...rect(treeRow),font:cs(treeRow)?.fontSize,pad:cs(treeRow)?.padding,radius:cs(treeRow)?.borderRadius,gap:cs(treeRow)?.gap},
    sectionHead:{...rect(sectionHead),font:cs(sectionHead)?.fontSize,pad:cs(sectionHead)?.padding,transform:cs(sectionHead)?.textTransform,spacing:cs(sectionHead)?.letterSpacing},
    ctl:{...rect(ctl),minH:cs(ctl)?.minHeight,gap:cs(ctl)?.gap},
    ctlLabel:{...rect(ctlLabel),font:cs(ctlLabel)?.fontSize,basis:cs(ctlLabel)?.flexBasis},
    ctlRange:{...rect(ctlRange),h:cs(ctlRange)?.height},
    ctlSelect:{...rect(ctlSelect),font:cs(ctlSelect)?.fontSize,pad:cs(ctlSelect)?.padding,radius:cs(ctlSelect)?.borderRadius},
    inspTitle:{font:cs(inspTitle)?.fontSize,weight:cs(inspTitle)?.fontWeight},
    panelTitle:{font:cs(panelTitle)?.fontSize,weight:cs(panelTitle)?.fontWeight,spacing:cs(panelTitle)?.letterSpacing,transform:cs(panelTitle)?.textTransform},
    panelLeftW:Math.round(q('#rail-left').getBoundingClientRect().width),
    panelRightW:Math.round(q('#rail-right').getBoundingClientRect().width),
  };
}, 'LAYERS components');

// WWW_PAINT component inventory: control sections, slider rows, segmented, layer rows, generate btn
await grab('http://127.0.0.1:8099/index.html', ()=>{
  const cs=el=>el?getComputedStyle(el):null;
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height)};};
  const q=s=>document.querySelector(s);
  const sec=q('.control-section');
  const secTitle=q('.control-section__title');
  const sliderRow=q('.slider-row');
  const sliderLabel=q('.slider-label');
  const sliderInput=q('.slider-row input[type=range]');
  const seg=q('.segmented__btn');
  const gen=q('.generate-btn');
  const layerRow=q('.layer-row');
  const panelTitle=q('.panel-title');
  const styleTrigger=q('.style-picker__trigger');
  return {
    controlSection:{...rect(sec),pad:cs(sec)?.padding,margin:cs(sec)?.margin},
    sectionTitle:{...rect(secTitle),font:cs(secTitle)?.fontSize,pad:cs(secTitle)?.padding,transform:cs(secTitle)?.textTransform,spacing:cs(secTitle)?.letterSpacing,weight:cs(secTitle)?.fontWeight},
    sliderRow:{...rect(sliderRow),minH:cs(sliderRow)?.minHeight,gap:cs(sliderRow)?.gap,pad:cs(sliderRow)?.padding},
    sliderLabel:{...rect(sliderLabel),font:cs(sliderLabel)?.fontSize,basis:cs(sliderLabel)?.flexBasis},
    sliderInput:{...rect(sliderInput),h:cs(sliderInput)?.height},
    segmentedBtn:{...rect(seg),font:cs(seg)?.fontSize,pad:cs(seg)?.padding,radius:cs(seg)?.borderRadius,minH:cs(seg)?.minHeight},
    generateBtn:{...rect(gen),font:cs(gen)?.fontSize,pad:cs(gen)?.padding,radius:cs(gen)?.borderRadius,h:cs(gen)?.height},
    layerRow:{...rect(layerRow),font:cs(layerRow)?.fontSize,pad:cs(layerRow)?.padding,radius:cs(layerRow)?.borderRadius},
    panelTitle:{font:cs(panelTitle)?.fontSize,weight:cs(panelTitle)?.fontWeight,spacing:cs(panelTitle)?.letterSpacing,transform:cs(panelTitle)?.textTransform},
    styleTrigger:{...rect(styleTrigger),font:cs(styleTrigger)?.fontSize,pad:cs(styleTrigger)?.padding,radius:cs(styleTrigger)?.borderRadius},
    panelLeftW:Math.round(q('#controls-root').getBoundingClientRect().width),
    panelRightW:Math.round(q('#layers-root').getBoundingClientRect().width),
  };
}, 'WWW_PAINT components');
await b.close();
