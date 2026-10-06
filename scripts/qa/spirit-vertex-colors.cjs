const assert=require('node:assert/strict');
const THREE=require('three');
const {createLoader}=require('./load-ts.cjs');
const loader=createLoader({three:THREE});
const {getThemePreset,SIXTY_GANZI_KEYS}=loader.load('lib/planet/theme-library.ts');
const {createSpiritGeometry}=loader.load('lib/planet/spirit-geometry.ts');
let meshes=0;
for(const quality of ['low','high'])for(const entry of SIXTY_GANZI_KEYS.slice(0,10)){
 const body=new THREE.MeshPhysicalMaterial();const accent=new THREE.MeshPhysicalMaterial();const form=createSpiritGeometry(getThemePreset(entry.key),body,accent,quality);
 form.group.traverse(mesh=>{if(!mesh.isMesh)return;meshes++;if(mesh.material.vertexColors){const color=mesh.geometry.getAttribute('color');assert(color,`${entry.key} ${quality} ${mesh.name}: missing vertex color`);assert.equal(color.count,mesh.geometry.getAttribute('position').count);assert([...color.array].every(v=>Number.isFinite(v)&&v>0),'invalid/dark color');}mesh.geometry.dispose()});body.dispose();accent.dispose();
}
console.log(JSON.stringify({status:'PASS',presets:10,qualities:2,meshes,check:'Every vertex-color PBR mesh has a positive color attribute; rendering remains a separate check.'}));
