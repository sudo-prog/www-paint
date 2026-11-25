import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const OUT = '/Users/AIR2K/Data/20_Projects/20.36_WWW_PAINT/docs/research/shell-swap/hermes-verify';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });

const measure = () => {
  const cs = el => el ? getComputedStyle(el) : null;
  const rect = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
  const q = s => document.querySelector(s);
  const app = q('#app') || q('.app');
  const card = q('#canvas-area'), body = q('.canvas-body'), frame = q('#canvas-frame') || q('.canvas-frame');
  const left = q('#controls-root'), right = q('#layers-root'), base = q('.base');
  const fr = frame?.getBoundingClientRect(), br = body?.getBoundingClientRect();
  const controls = [...document.querySelectorAll('button,[role="button"],a,input,select,[tabindex]')]
    .filter(el => { const b=el.getBoundingClientRect(); const st=getComputedStyle(el);
      return b.width>=2 && b.height>=2 && st.display!=='none' && st.visibility!=='hidden' && b.right>0 && b.left<innerWidth && b.bottom>0 && b.top<innerHeight; });
  let hitFails=0, past=0; const samples=[];
  for (const el of controls) {
    const b=el.getBoundingClientRect(); const cx=b.left+b.width/2, cy=b.top+b.height/2;
    if (cx<0||cy<0||cx>innerWidth||cy>innerHeight){past++;continue;}
    const top=document.elementFromPoint(cx,cy);
    const hit=!!top&&(el===top||el.contains(top)||top.contains(el));
    if(!hit){hitFails++; if(samples.length<10) samples.push({id:el.id,cls:String(el.className).slice(0,50),text:(el.textContent||'').trim().slice(0,25),top:top?{tag:top.tagName,id:top.id,cls:String(top.className).slice(0,40)}:null});}
    if(b.right>innerWidth+1||b.left<-1) past++;
  }
  return {
    shellRadius: cs(app)?.borderRadius, canvasRadius: cs(card)?.borderRadius,
    baseBg: cs(base)?.backgroundColor, panelBg: cs(left)?.backgroundColor, rightBg: cs(right)?.backgroundColor,
    cardRect: rect(card), bodyRect: rect(body), frameRect: rect(frame), headRect: rect(q('.canvas-head')),
    leftRect: rect(left), rightRect: rect(right),
    frameAreaPct: fr&&br ? +(100*fr.width*fr.height/(br.width*br.height)).toFixed(1) : null,
    frameMargins: fr&&br ? {l:Math.round(fr.x-br.x), r:Math.round((br.x+br.width)-(fr.x+fr.width)), t:Math.round(fr.y-br.y), b:Math.round((br.y+br.height)-(fr.y+fr.height))} : null,
    cardBg: cs(card)?.backgroundImage?.slice(0,100),
    frameBg: cs(frame)?.backgroundColor, frameRadius: cs(frame)?.borderRadius, frameShadow: cs(frame)?.boxShadow?.slice(0,60),
    radiusBar: rect(q('.radius-bar')), pill: rect(q('.insert-bar')||q('.motion-bar')),
    docOverflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    controlCount: controls.length, hitFails, past, samples,
    collapsedLeft: left?.classList.contains('is-collapsed'), collapsedRight: right?.classList.contains('is-collapsed'),
    navLeft: card?.classList.contains('nav-left'), navRight: card?.classList.contains('nav-right'),
    theme: document.documentElement.getAttribute('data-theme'),
    bodyFont: cs(document.body)?.fontFamily?.slice(0,60),
    statusInLeft: !!left?.querySelector('#status-bar'),
    pageErrors: window.__hermesErrs || [],
  };
};

const results = {};
for (const [w,h] of [[1440,900],[390,844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__hermesErrs = []; });
  const key = `${w}x${h}`;
  results[key] = {};
  // expanded
  await page.evaluate(() => { [...document.querySelectorAll('.nav-btn')].find(b=>b.dataset.nav==='expanded')?.click(); });
  await page.waitForTimeout(600);
  results[key].expanded = await page.evaluate(measure);
  results[key].expanded.pageErrors = errs.slice();
  await page.screenshot({ path: `${OUT}/hermes-expanded-${w}.png`, animations: 'disabled', timeout: 15000 }).catch(e=>console.error('shot-fail',e.message));
  // navbar
  await page.evaluate(() => { [...document.querySelectorAll('.nav-btn')].find(b=>b.dataset.nav==='collapsed')?.click(); });
  await page.waitForTimeout(600);
  results[key].navbar = await page.evaluate(measure);
  await page.screenshot({ path: `${OUT}/hermes-navbar-${w}.png`, animations: 'disabled', timeout: 15000 }).catch(e=>console.error('shot-fail',e.message));
  // theme flip check
  results[key].themeFlip = await page.evaluate(() => {
    const before = document.documentElement.getAttribute('data-theme');
    document.getElementById('toggle-theme')?.click();
    const mid = document.documentElement.getAttribute('data-theme');
    const bg = getComputedStyle(document.querySelector('.base')).backgroundColor;
    document.getElementById('toggle-theme')?.click();
    return { before, mid, lightBaseBg: bg, after: document.documentElement.getAttribute('data-theme') };
  });
  // radius buttons
  results[key].radius = await page.evaluate(() => {
    const b16 = [...document.querySelectorAll('.radius-btn')].find(b=>b.dataset.radius==='16');
    b16?.click();
    const v = getComputedStyle(document.documentElement).getPropertyValue('--r-canvas').trim();
    const b28 = [...document.querySelectorAll('.radius-btn')].find(b=>b.dataset.radius==='28');
    b28?.click();
    return { after16: v, restored: getComputedStyle(document.documentElement).getPropertyValue('--r-canvas').trim() };
  });
  results[key].pageErrorsFinal = errs;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/hermes-verify.json`, JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,1));
