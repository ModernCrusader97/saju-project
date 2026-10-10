import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/source-reference/saju-b-evolving-light-v002');
const output = path.join(root, 'public/spirits/jade-v002');
const files = [
  ['reference/SaJu_Jade_Approved_Static_Material.glb', 'body.glb'],
  ['runtime/textures/jade_fields_atlas_128.png', 'fields.png'],
  ['runtime/textures/Jade_OriginalBaseColor_1024.png', 'base-color.png'],
  ['preview_keyframes/001.png', 'still.png'],
];
const hashes = new Map(readFileSync(path.join(source, 'SHA256SUMS.txt'), 'utf8')
  .trim().split(/\r?\n/).map(line => {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/);
    if (!match) throw new Error('Invalid approved asset checksum manifest.');
    return [match[2].replace(/^\.\//, ''), match[1]];
  }));
// Verify every source before writing any runtime assets. Only this v002 package is used.
for (const [relative] of files) {
  const bytes = readFileSync(path.join(source, relative));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (!hashes.has(relative) || hashes.get(relative) !== actual) {
    throw new Error(`Approved v002 asset checksum mismatch: ${relative}`);
  }
}
mkdirSync(output, { recursive: true });
for (const [relative, target] of files) copyFileSync(path.join(source, relative), path.join(output, target));
console.log('Approved jade v002: 4 runtime assets copied after SHA-256 verification.');

// New skin derivative is separate from body.glb and the original v002 package.
const rigSource = path.join(root,'assets/source-reference/saju-b-rigged-greeting-v001');
const rigName = 'SaJu_B_Rigged_Greeting_v001.glb';
const rigHash = readFileSync(path.join(rigSource,'SHA256SUMS.txt'),'utf8').trim().match(/^([a-f0-9]{64})\s+SaJu_B_Rigged_Greeting_v001\.glb$/)?.[1];
if (!rigHash || createHash('sha256').update(readFileSync(path.join(rigSource,rigName))).digest('hex') !== rigHash) throw new Error('Approved B rig derivative checksum mismatch.');
const rigOutput = path.join(root,'public/spirits/jade-rig-v001'); mkdirSync(rigOutput,{recursive:true});
copyFileSync(path.join(rigSource,rigName),path.join(rigOutput,'body.glb'));
console.log('Approved B rig v001: separate skin asset copied after SHA-256 verification.');

// The README Python restoration remains available. Clean portable builds also
// restore the same preserved GLB using Node's gzip and the identical two hashes.
const archive = readFileSync(path.join(root, 'preservation-archives/porcelain-hero-blink-v1.glb.gz'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha(archive) !== '09f11f913f4853ea2050a007618ec607e7a6e4350403f7e4bdd91a68e542f3a1') throw new Error('Preserved GLB archive checksum mismatch.');
const restored = gunzipSync(archive);
if (sha(restored) !== '57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2') throw new Error('Restored GLB checksum mismatch.');
mkdirSync(path.join(root, 'public/models'), { recursive: true });
const restoredPath = path.join(root, 'public/models/porcelain-hero-blink-v1.glb');
if (existsSync(restoredPath) && sha(readFileSync(restoredPath)) !== sha(restored)) throw new Error('Refusing to replace a different preserved GLB.');
writeFileSync(restoredPath, restored);
console.log('Preserved porcelain GLB: restored with both SHA-256 checks.');
