import { createRequire } from 'node:module';
const require=createRequire('/Users/AIR2K/.npm/_npx/af752b90495482d7/node_modules/');
const {chromium}=require('playwright-core');
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const p=await (await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})).newPage();
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/look-full.png',timeout:120000,animations:'disabled'});
// bottom-centre crop
await p.screenshot({path:'/tmp/look-pill.png',clip:{x:150,y:720,width:900,height:180},timeout:120000,animations:'disabled'});
// open library panel, then crop the choose-file area
await p.evaluate(()=>document.getElementById('btn-library-mode')?.click());
await p.waitForTimeout(800);
await p.screenshot({path:'/tmp/look-library.png',timeout:120000,animations:'disabled'});
const info = await p.evaluate(()=>{
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),r:Math.round(b.right),bt:Math.round(b.bottom),cx:Math.round(b.x+b.width/2),cy:Math.round(b.y+b.height/2)};};
  const cs=el=>el?getComputedStyle(el):null;
  const pill=document.getElementById('insert-bar');
  const motion=document.getElementById('motion-controls');
  const canvas=document.getElementById('canvas-area');
  const cf=document.getElementById('library-import-file-btn');
  const cfRow=cf?.closest('.library-import-row') || cf?.parentElement;
  const kids=pill?[...pill.children].map(k=>({txt:(k.textContent||'').trim().slice(0,14),cls:String(k.className).slice(0,30),...rect(k),display:cs(k).display,pos:cs(k).position})):null;
  return {canvas:rect(canvas),pill:rect(pill),pillPos:cs(pill)?.position,pillLeft:cs(pill)?.left,pillTransform:cs(pill)?.transform,
    motion:rect(motion),motionPos:cs(motion)?.position,motionLeft:cs(motion)?.left,motionTransform:cs(motion)?.transform,
    kids,
    chooseFile:cf?{...rect(cf),display:cs(cf).display,bg:cs(cf).backgroundColor,color:cs(cf).color,border:cs(cf).borderColor,borderStyle:cs(cf).borderStyle,justifySelf:cs(cf).justifySelf}:null,
    chooseRow:cfRow?{...rect(cfRow),justify:cs(cfRow).justifyContent,display:cs(cfRow).display}:null,
  };
});
const canvasCx=info.canvas?.cx;
const pillCx=info.pill?.cx;
const motionCx=info.motion?.cx;
const cfCx=info.chooseFile?.cx;
const rowCx=info.chooseRow?.cx;
const bg=info.chooseFile?.bg || '';
const isDark = (c)=>{ const m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if(!m) return false; const [r,g,bv]=[+m[1],+m[2],+m[3]]; return (r+g+bv)/3 < 128; };
const assertions = {
  insertBarCentreDelta: canvasCx!=null&&pillCx!=null ? Math.abs(pillCx-canvasCx) : null,
  motionCentreDelta: canvasCx!=null&&motionCx!=null ? Math.abs(motionCx-canvasCx) : null,
  chooseFileCentreDelta: rowCx!=null&&cfCx!=null ? Math.abs(cfCx-rowCx) : null,
  insertBarCentred: canvasCx!=null&&pillCx!=null ? Math.abs(pillCx-canvasCx) <= 4 : false,
  motionCentred: canvasCx!=null&&motionCx!=null ? Math.abs(motionCx-canvasCx) <= 4 : false,
  chooseFileCentred: rowCx!=null&&cfCx!=null ? Math.abs(cfCx-rowCx) <= 4 : false,
  chooseFileDark: isDark(bg),
};
console.log(JSON.stringify({info,assertions},null,1));
if (!assertions.insertBarCentred || !assertions.motionCentred || !assertions.chooseFileCentred || !assertions.chooseFileDark) {
  console.error('LOOK-PROBE: FAIL', assertions);
  process.exitCode=1;
} else {
  console.log('LOOK-PROBE: PASS');
}
await b.close();
