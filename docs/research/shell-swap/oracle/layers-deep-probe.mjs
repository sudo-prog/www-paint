import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
const out = {};
for (const [w,h] of [[1440,900],[390,844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8096/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  out[`${w}x${h}`] = await page.evaluate(() => {
    const cs = el => el ? getComputedStyle(el) : null;
    const rect = el => { if(!el) return null; const b=el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
    const q = s => document.querySelector(s);
    const card = q('#canvas-card'), body = q('.canvas-body'), frame = q('#frame'), head = q('.canvas-head');
    const bar = q('.radius-bar'), pill = q('.insert-bar');
    const cardR = rect(card), bodyR = rect(body), frameR = rect(frame);
    return {
      cardRect: cardR, bodyRect: bodyR, frameRect: frameR, headRect: rect(head),
      frameAreaPctOfBody: frameR && bodyR ? +(100*frameR.w*frameR.h/(bodyR.w*bodyR.h)).toFixed(1) : null,
      frameMarginsInBody: frameR && bodyR ? {l:frameR.x-bodyR.x, r:(bodyR.x+bodyR.w)-(frameR.x+frameR.w), t:frameR.y-bodyR.y, b:(bodyR.y+bodyR.h)-(frameR.y+frameR.h)} : null,
      cardBg: cs(card)?.backgroundImage?.slice(0,120),
      bodyBg: cs(body)?.backgroundImage?.slice(0,200),
      frameBg: cs(frame)?.backgroundColor, frameBorder: cs(frame)?.border, frameRadius: cs(frame)?.borderRadius, frameShadow: cs(frame)?.boxShadow,
      headFont: cs(head)?.fontSize, headColor: cs(head)?.color, headPad: cs(head)?.padding, headBorderBottom: cs(head)?.borderBottom,
      radiusBar: rect(bar), radiusBarBg: cs(bar)?.backgroundColor, radiusBarRadius: cs(bar)?.borderRadius,
      pill: rect(pill), pillBg: cs(pill)?.backgroundColor, pillRadius: cs(pill)?.borderRadius, pillBlur: cs(pill)?.backdropFilter,
      panelTitleFont: cs(q('.panel-title'))?.fontSize, panelTitleSpacing: cs(q('.panel-title'))?.letterSpacing, panelTitleColor: cs(q('.panel-title'))?.color,
      bodyFont: cs(document.body)?.fontFamily?.slice(0,80), bodyFontSize: cs(document.body)?.fontSize,
      stripPad: cs(q('.panel-strip'))?.padding, headPadPanel: cs(q('.panel-head'))?.padding,
      collapsedLeft: q('#rail-left')?.classList.contains('is-collapsed'),
      navPressed: [...document.querySelectorAll('.nav-btn')].map(b=>b.getAttribute('data-nav')+'='+b.getAttribute('aria-pressed')),
      radiusPressed: [...document.querySelectorAll('.radius-btn')].map(b=>b.getAttribute('data-radius')+'='+b.getAttribute('aria-pressed')),
      rCanvasVar: cs(document.documentElement)?.getPropertyValue('--r-canvas'),
      treeRowFont: cs(q('.tree-row'))?.fontSize, treeRowPad: cs(q('.tree-row'))?.padding, treeRowRadius: cs(q('.tree-row'))?.borderRadius,
      sectionHeadFont: cs(q('.section-head'))?.fontSize,
      ctlMinH: cs(q('.ctl'))?.minHeight, ctlLabelW: cs(q('.ctl-label'))?.flexBasis,
    };
  });
  await ctx.close();
}
await browser.close();
fs.writeFileSync('layers-deep-probe.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
