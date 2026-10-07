import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
const source = path.resolve('assets/source-reference/saju-b-evolving-light-v002');
const sha = data => createHash('sha256').update(data).digest('hex');
let verified = 0, checkoutTextFiles = 0;
for (const line of fs.readFileSync(path.join(source,'SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/)) {
  const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line); assert(match);
  const file = match[2].replace(/^\.\//,''); const bytes = fs.readFileSync(path.join(source,file));
  if (sha(bytes) !== match[1] && /\.(txt|md|mjs|glsl|json|py)$/.test(file)) {
    // git.autocrlf on Windows changes checkout text endings; verify canonical LF without editing sources.
    assert.equal(sha(Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'))),match[1],file); checkoutTextFiles++;
  } else assert.equal(sha(bytes),match[1],file);
  verified++;
}
const png = fs.readFileSync(path.join(source,'runtime/textures/jade_fields_atlas_128.png'));
assert.equal(png.readUInt32BE(16),2048); assert.equal(png.readUInt32BE(20),1024);
assert.equal(png[24],8); assert.equal(png[25],6); assert.equal(png[28],0);
let at=8; const parts=[];
while(at<png.length) { const length=png.readUInt32BE(at),kind=png.toString('ascii',at+4,at+8); if(kind==='IDAT')parts.push(png.subarray(at+8,at+8+length)); at+=length+12; }
const filtered=inflateSync(Buffer.concat(parts)), stride=2048*4, decoded=Buffer.alloc(1024*stride);
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
for(let row=0;row<1024;row++) {
  const start=row*(stride+1),filter=filtered[start]; assert(filter<=4);
  for(let x=0;x<stride;x++) {
    const index=row*stride+x,left=x>=4?decoded[index-4]:0,above=row?decoded[index-stride]:0,corner=row&&x>=4?decoded[index-stride-4]:0;
    const predict=filter===0?0:filter===1?left:filter===2?above:filter===3?Math.floor((left+above)/2):paeth(left,above,corner);
    decoded[index]=(filtered[start+x+1]+predict)&255;
  }
}
const raw=fs.readFileSync(path.join(source,'runtime/textures/jade_fields_atlas_128.rgba8'));
assert.equal(decoded.length,8388608); assert(decoded.equals(raw),'PNG differs from native raw RGBA8 fields');
for(let i=3;i<raw.length;i+=4)assert.equal(raw[i],255);
const restored=fs.readFileSync('public/models/porcelain-hero-blink-v1.glb');
assert.equal(sha(restored),'57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2');
console.log(JSON.stringify({status:'PASS',sourceFilesVerified:verified,checkoutTextFilesVerifiedAsCanonicalLF:checkoutTextFiles,pngRawExactMatch:true,alphaAlways255:true,pixelFormat:'RGBA8_UNORM',atlasSize:[2048,1024],atlasBytes:raw.length,restoredGLBBytes:restored.length,restoredGLBSHA256:sha(restored)},null,2));
