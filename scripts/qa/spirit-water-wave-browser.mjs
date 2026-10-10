import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const root=process.cwd(),base=path.resolve('../saju-spirit-dew-coalescence-20261010'),output=path.resolve('outputs/spirit-integration/water/webgl');await fs.mkdir(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={status:'RUNNING',sourceHashes:{before:sha(await fs.readFile(path.join(base,'lib/planet/approved-stem-materials.ts'))),after:sha(await fs.readFile('lib/planet/approved-stem-materials.ts'))},cases:[],field:[],errors:[],outbound:[],limits:['Actual preserved GLB and both original material factories; the same current loader/face routing isolates water amplitude.','Chromium SwiftShader local GPU; no physical device or hosted login.','Broad bump relief halves; original silhouette does not use vertex displacement.']};
const server=await createServer({root,configFile:false,logLevel:'error',resolve:{alias:{'@water-loader':path.join(root,'lib/planet/approved-jade-spirit.ts'),'@water-before':path.join(base,'lib/planet/approved-stem-materials.ts'),'@water-after':path.join(root,'lib/planet/approved-stem-materials.ts'),'@water-environment':path.join(root,'lib/planet/scene-environment.ts')}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,base,'/workspace/saju-project/node_modules']}},optimizeDeps:{noDiscovery:true},plugins:[{name:'water-qa',configureServer(s){s.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__water'))return next();res.setHeader('Content-Type','text/html');res.end('<html><body><script type="module" src="/scripts/qa/spirit-water-wave-page.mjs"></script></body></html>');});}}]});
let browser;
try{
  await server.listen();const origin=server.resolvedUrls.local[0];
  const {chromium}=await import(pathToFileURL('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const quality of ['high','low']){
    const page=await browser.newPage({viewport:{width:480,height:560}});page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(origin).origin||['data:','blob:'].includes(u.protocol))return route.continue();report.outbound.push(u.origin);return route.abort();});
    await page.goto(origin+'__water');await page.waitForFunction(()=>!!window.waterQA);await page.evaluate(q=>window.waterQA.load(q),quality);
    for(const [label,time,angle,close] of [['front',0,0,false],['front-flow',1.25,0,false],['side-flow',1.25,Math.PI/2,false],['close-flow',1.25,.4,true]]){
      const states=[];
      for(const version of [0,1]){
        const s=await page.evaluate(a=>window.waterQA.frame(...a),[version,time,angle,close]);assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);assert.equal(s.depth,1.35);assert(Math.abs(s.materialTime-time)<1e-6);
        const file=`${quality}-${label}-${version?'after':'before'}.png`,bytes=Buffer.from(s.png.split(',')[1],'base64');delete s.png;await fs.writeFile(path.join(output,file),bytes);states.push({file,pngSHA256:sha(bytes),...s});
      }
      for(const key of ['attributes','bodyMatrix','morph','camera','depth','materialTime'])assert.deepEqual(states[0][key],states[1][key],key);
      assert.notEqual(states[0].pixels,states[1].pixels,'actual moving water relief visibly changes under identical pose/lighting');
      report.cases.push({quality,label,time,angle,states});
    }
    if(quality==='high')for(const time of [0,1.25,5.5]){
      await page.evaluate(t=>window.waterQA.frame(0,t,0,false),time);
      const fields=[];for(const version of [0,1])fields.push(await page.evaluate(a=>window.waterQA.field(...a),[version,time]));
      assert(fields.every(f=>f.floatColorSupported&&f.linkedShader));assert.deepEqual(fields[0].errors,[]);assert.deepEqual(fields[1].errors,[]);assert.equal(fields[0].glError,0);assert.equal(fields[1].glError,0);
      assert(fields[0].sample.length>10000);assert.equal(fields[0].sample.length,fields[1].sample.length);
      let broadError=0,detailError=0,totalError=0,sumA=0,sumB=0;
      for(let i=0;i<fields[0].sample.length;i++){
        const a=fields[0].sample[i],b=fields[1].sample[i];assert.equal(a[0],b[0]);broadError=Math.max(broadError,Math.abs(b[2]-a[2]*.5));detailError=Math.max(detailError,Math.abs(b[3]-a[3]));totalError=Math.max(totalError,Math.abs((b[1]-a[1])+a[2]*.5));sumA+=a[2]**2;sumB+=b[2]**2;
      }
      assert(broadError<1e-7);assert(detailError<2e-7);assert(totalError<2e-7);assert(Math.abs(Math.sqrt(sumB/sumA)-.5)<1e-6);
      report.field.push({time,samples:fields[0].sample.length,broadHalfMaxError:broadError,unchangedDetailMaxError:detailError,totalHeightDeltaMaxError:totalError,broadRMSRatio:Math.sqrt(sumB/sumA),fieldBeforeSHA256:sha(Buffer.from(JSON.stringify(fields[0].sample))),fieldAfterSHA256:sha(Buffer.from(JSON.stringify(fields[1].sample)))});
    }
    await page.evaluate(()=>window.waterQA.dispose());await page.close();console.log('PASS water '+quality);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.outbound,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.errors.push(e.stack||String(e));console.error(e);process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
