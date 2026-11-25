const { chromium } = require('playwright-core');
const fs=require('fs'),os=require('os'),path=require('path');
const ROOT='/home/thinkpad/Data/20_Projects/20.36_WWW_PAINT';
function findChromium(){
  const base=path.join(os.homedir(),'.cache','ms-playwright');
  const dirs=fs.readdirSync(base).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>parseInt(b.split('-')[1],10)-parseInt(a.split('-')[1],10));
  for(const d of dirs)for(const sub of [['chrome-linux64','chrome'],['chrome-linux','chrome']]){const p=path.join(base,d,...sub);if(fs.existsSync(p))return p;}
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:findChromium(),
    args:['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:800,height:600}});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERROR: '+String(e).slice(0,200)));
  page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text().slice(0,200));});
  await page.goto('http://localhost:8099/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  let appReady=false;
  try{ await page.waitForFunction(()=>window.__app&&window.__app.engine,{timeout:30000}); appReady=true; }catch(e){}
  const out={appReady,errs:errs.slice(0,12)};
  if(appReady){
    out.hasCanvas=await page.evaluate(()=>!!document.querySelector('canvas'));
    out.hasFileInput=await page.evaluate(()=>!!document.querySelector('#image-file-input'));
    out.importMap=await page.evaluate(()=>{
      const m=document.querySelector('script[type="importmap"]');
      return m?m.textContent.length:0;
    });
    // Try importing the dli backend module directly from the page
    out.dliImport=await page.evaluate(async()=>{
      try{ const m=await import('/js/engine/dli-paint-backend.js'); return {ok:true,keys:Object.keys(m)}; }
      catch(e){ return {ok:false,err:String(e).slice(0,200)}; }
    });
    // Try importing the renderer and check renderAll is async
    out.rendererAsync=await page.evaluate(async()=>{
      try{ const m=await import('/js/engine/renderer.js');
        const c=document.createElement('canvas');c.width=64;c.height=64;
        const r=new m.Renderer(c,{width:64,height:64});
        return {ok:true, renderAllIsAsync: r.renderAll.constructor.name==='AsyncFunction'};
      }catch(e){ return {ok:false,err:String(e).slice(0,200)}; }
    });
    // Check the oil style's render is async
    out.oilAsync=await page.evaluate(async()=>{
      try{ const m=await import('/js/styles/oil.js');
        const o=new m.default();
        return {ok:true, renderIsAsync:o.render.constructor.name==='AsyncFunction'};
      }catch(e){ return {ok:false,err:String(e).slice(0,200)}; }
    });

    // RENDER THROUGH THE REAL APP PATH with 3 strokes.
    await page.setInputFiles('#image-file-input', path.join(ROOT,'test-images/frog-source.jpg'));
    await page.waitForTimeout(1500);
    out.appRender=await page.evaluate(async()=>{
      const t0=performance.now();
      try{
        await window.__app.generate({style:'oil',count:2});
        const strokes=window.__app.engine.getTotalStrokes();
        await window.__app.engine.render();
        const ms=Math.round(performance.now()-t0);
        const c=document.querySelector('canvas');
        const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let ink=0,distinct=new Set();
        for(let i=0;i<d.length;i+=4){
          if(d[i+3]>8){ink++;distinct.add(d[i]+','+d[i+1]+','+d[i+2]);}
        }
        // Is the dli backend actually being used?
        const mod=await import('/js/engine/dli-paint-backend.js');
        return {ok:true,ms,strokes,inkPixels:ink,distinctColours:distinct.size,
                total:d.length/4, dliIsReady: mod.getDliPaintBackend ? 'exported' : 'missing'};
      }catch(e){ return {ok:false,err:String(e).slice(0,300),ms:Math.round(performance.now()-t0)}; }
    });
    // Save the canvas PNG
    const png=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(path.join(ROOT,'docs/research/dli-app-path.png'),Buffer.from(png.split(',')[1],'base64'));
    out.png='docs/research/dli-app-path.png';
  }
  console.log(JSON.stringify(out,null,2));
  await browser.close();
})().catch(e=>{console.error('FAIL',e);process.exit(2);});
