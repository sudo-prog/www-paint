const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const widths = (args.find(a=>a.startsWith('--widths=')) || '--widths=1440,390').split('=')[1].split(',').map(Number);
const url = (args.find(a=>a.startsWith('--url=')) || '--url=http://127.0.0.1:8099/index.html').split('=')[1];

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-gpu'] });
  for (const w of widths) {
    const h = w === 390 ? 844 : 900;
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const measure = async (mode) => {
      if (mode === 'navbar') {
        await page.evaluate(() => {
          document.querySelectorAll('.nav-btn').forEach(b => { if (b.getAttribute('data-nav')==='collapsed') b.click(); });
        });
      } else {
        await page.evaluate(() => {
          document.querySelectorAll('.nav-btn').forEach(b => { if (b.getAttribute('data-nav')==='expanded') b.click(); });
        });
      }
      await page.waitForTimeout(500);
      return page.evaluate(() => {
        const app = document.querySelector('#app') || document.querySelector('.app');
        const base = document.querySelector('.base');
        const left = document.querySelector('.panel--controls');
        const right = document.querySelector('.panel--layers');
        const card = document.querySelector('#canvas-area');
        const head = document.querySelector('.canvas-head');
        const frame = document.querySelector('#canvas-frame');
        const body = document.querySelector('.canvas-body');
        const rb = document.querySelector('.radius-bar');
        const getRect = (el) => el ? el.getBoundingClientRect() : null;
        const lr = getRect(left), rr = getRect(right), cr = getRect(card), hr = getRect(head), fr = getRect(frame), br = getRect(body), rbr = getRect(rb);
        const baseBg = base ? getComputedStyle(base).backgroundColor : null;
        const panelBg = left ? getComputedStyle(left).backgroundColor : null;
        const rightBg = right ? getComputedStyle(right).backgroundColor : null;
        const shellRadius = app ? getComputedStyle(app).borderRadius : null;
        const canvasRadius = card ? getComputedStyle(card).borderRadius : null;
        const frameArea = (fr && br) ? (fr.width*fr.height)/(br.width*br.height) : null;
        const controls = [...document.querySelectorAll('button,[role="button"],a,input,select,[tabindex]')]
        .filter(el => { const b=el.getBoundingClientRect(); const st=getComputedStyle(el);
          return b.width>=2 && b.height>=2 && st.display!=='none' && st.visibility!=='hidden' && b.right>0 && b.left<innerWidth && b.bottom>0 && b.top<innerHeight; });
      let hitFails=0, past=0;
      for (const el of controls) {
        const b=el.getBoundingClientRect(); const cx=b.left+b.width/2, cy=b.top+b.height/2;
        if (cx<0||cy<0||cx>innerWidth||cy>innerHeight){past++;continue;}
        const top=document.elementFromPoint(cx,cy);
        const hit=!!top&&(el===top||el.contains(top)||top.contains(el));
        if(!hit){hitFails++;}
        if(b.right>innerWidth+1||b.left<-1) past++;
      }
        return {
          shellRadius, canvasRadius, baseBg, panelBg, rightPanelBg: rightBg,
          leftRect: lr, rightRect: rr, cardRect: cr, headH: hr ? hr.height : null,
          frameArea, frameRect: fr, bodyRect: br, radiusBarRect: rbr,
          docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hitFails, past,
          leftCollapsed: left ? left.classList.contains('is-collapsed') : null,
          rightCollapsed: right ? right.classList.contains('is-collapsed') : null,
          cardNavLeft: card ? card.classList.contains('nav-left') : null,
          cardNavRight: card ? card.classList.contains('nav-right') : null,
        };
      });
    };
    for (const mode of ['expanded', 'navbar']) {
      const m = await measure(mode);
      console.log(`=== ${w}x${h} ${mode} ===`);
      console.log(JSON.stringify(m, null, 2));
      const shotPath = path.join('docs/research/shell-swap', `after-${mode}-${w}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
    }
    await page.close();
  }
  // Summary
  let totalHitFails = 0;
  // (re-measure not needed; rely on printed JSON)
  console.log('\\n=== SUMMARY ===');
  console.log('Probe complete. Check hitFails/past in JSON above; non-zero hitFails = FAIL.');
  await browser.close();
})();