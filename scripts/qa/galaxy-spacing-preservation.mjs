import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const base='c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573';
const allowed=new Set(['components/planet/GalaxyCanvas.tsx','lib/planet/asteroid-belt.ts','lib/planet/galaxy-helper.ts','lib/planet/galaxy-motion.ts']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=execFileSync('git',['ls-tree','-rz','--name-only',base],{encoding:'utf8'}).split('\0').filter(Boolean);
const changed=[],unexpected=[];let unchanged=0;
for(const file of files){
 const before=execFileSync('git',['show',`${base}:${file}`],{maxBuffer:128*1024*1024}),after=await fs.readFile(file).catch(()=>Buffer.alloc(0));
 if(before.equals(after)){unchanged++;continue;}
 const record={file,beforeSha256:sha(before),afterSha256:sha(after)};
 changed.push(record);if(!allowed.has(file))unexpected.push(record);
}
const source='assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb';
const originalSourceSha256=sha(await fs.readFile(source));
assert.equal(originalSourceSha256,'0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const output=path.resolve('outputs/galaxy-spacing-directions/preservation.json');
const report={status:unexpected.length===0?'PASS':'FAIL',base,originalFiles:files.length,unchanged,changed,unexpected,
 originalSourceSha256,publicBodySha256:sha(await fs.readFile('public/spirits/jade-v002/body.glb')),
 preserved:['Every pre-existing file except four explicitly allowed galaxy placement/motion files has identical bytes.','All original approved source/public models, UV/depth/morphs, pet/planet recipes, APIs, auth, database schema, dependencies/lock and hosting code.','The independently committed actual B-rig candidate is not merged into this separate galaxy branch.']};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
assert.deepEqual(unexpected,[]);console.log(JSON.stringify({status:report.status,originalFiles:files.length,unchanged,allowedChanges:changed.length}));
