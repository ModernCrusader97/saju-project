// Complete tracked production preservation boundary for the integrated release.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='9ec0150bf7f595f28541d91355bf64143bd137e8';
const git=args=>execFileSync('git',args,{maxBuffer:128*1024*1024});
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=git(['ls-tree','-r','--name-only','-z',base]).toString().split('\0').filter(Boolean);
const allowed=new Set(['app/planet/page.tsx','components/planet/ElementalSpiritCanvas.tsx','lib/planet/approved-jade-spirit.ts','lib/planet/elemental-spirit.ts',
  'lib/planet/approved-stem-materials.ts','lib/planet/approved-spirit-motion.ts','lib/planet/surface-sliding-dew.ts','lib/planet/surface-attachment-exclusions.ts','lib/planet/surface-fissure-sand.ts']);
const rows=[];
for(const file of files.filter(f=>!f.startsWith('docs/')&&!f.startsWith('scripts/qa/'))){
  const a=git(['cat-file','blob',`${base}:${file}`]),b=await fs.readFile(file),same=a.equals(b);
  assert(same||allowed.has(file),'Unexpected production modification: '+file);
  rows.push({file,beforeSHA256:sha(a),afterSHA256:sha(b),unchanged:same});
}
assert(rows.filter(r=>r.file.startsWith('assets/')||r.file.startsWith('public/')).every(r=>r.unchanged));
const source=await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(source.equals(await fs.readFile('public/spirits/jade-v002/body.glb')));
const newPaths=git(['ls-files','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean);
const report={status:'PASS',baseline:base,originalProductionFiles:rows.length,unchangedProductionFiles:rows.filter(r=>r.unchanged).length,
  changedExistingProductionFiles:rows.filter(r=>!r.unchanged).map(r=>r.file),originalSourceAssetsPreserved:true,bodyGLBSHA256:sha(source),
  protected:'Original B, UV/depth, zodiac generator+manifest, planet/galaxy recipes, dependency lock, auth/payment/API/DB/schema/hosting/access source preserved.',
  newUntrackedPathsAtCheck:newPaths,files:rows};
const output=path.resolve('outputs/spirit-integration');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'preservation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined,newUntrackedPathsAtCheck:undefined}));
