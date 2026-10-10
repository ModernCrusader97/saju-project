import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const base='c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573';
const git=args=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=git(['ls-tree','-r','--name-only','-z',base]).toString().split('\0').filter(Boolean);
const allowed=new Set(['.gitignore','lib/planet/approved-jade-spirit.ts','lib/planet/approved-spirit-motion.ts',
 'lib/planet/fashion-surface-projector.ts','lib/planet/mesh-surface.ts','lib/planet/render-resources.ts',
 'lib/planet/surface-creeping-vines.ts','lib/planet/surface-fissure-sand.ts','lib/planet/surface-sliding-dew.ts',
 'lib/planet/surface-stem-accents.ts','lib/planet/surface-woody-branches.ts','scripts/sync-approved-jade-assets.mjs']);
const rows=[];
for(const file of files.filter(f=>!f.startsWith('docs/')&&!f.startsWith('scripts/qa/'))){
 const before=git(['cat-file','blob',`${base}:${file}`]),after=await fs.readFile(file),same=before.equals(after);
 assert(same||allowed.has(file),'Unexpected production change: '+file);
 rows.push({file,beforeSHA256:sha(before),afterSHA256:sha(after),unchanged:same});
}
assert(rows.filter(r=>r.file.startsWith('assets/')||r.file.startsWith('public/')).every(r=>r.unchanged));
const source=await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(source.equals(await fs.readFile('public/spirits/jade-v002/body.glb')));
assert((await fs.readFile('assets/source-reference/saju-b-rigged-greeting-v001/SaJu_B_Rigged_Greeting_v001.glb')).equals(await fs.readFile('public/spirits/jade-rig-v001/body.glb')));
const report={status:'PASS',baseline:base,originalProductionFiles:rows.length,
 unchangedProductionFiles:rows.filter(r=>r.unchanged).length,changedExistingProductionFiles:rows.filter(r=>!r.unchanged).map(r=>r.file),
 originalSourceAssetsPreserved:true,sourceGLBSHA256:sha(source),
 preserved:'Approved B source, UV/depth, source morph, facial transforms, zodiac generation, planet/galaxy recipes, dependency lock, auth/payment/API/DB/schema/hosting/access source.',files:rows};
const output=path.resolve('outputs/rigged-greeting');await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'preservation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined}));
