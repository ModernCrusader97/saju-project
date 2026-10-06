import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import evolutionGLSL from '../../assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.glsl?raw';
import { wrapSeconds } from '../../assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.mjs';
import type { ElementalSpiritInstance } from './elemental-spirit';
import { getSpiritStemPreset, TEN_STEM_SPIRITS } from './spirit-profiles';
import { createZodiacFeatures } from './spirit-zodiac';
import { createMonthSpiritPet } from './spirit-month-pet';
import { createPlanetMaterial, animateSurface, resetSurface, setSurfaceReliefScale } from './surface-material';
import { disposeObject, disposeMaterial } from './render-resources';
import type { SpiritQuality } from './spirit-geometry';

const ASSET_ROOT = '/spirits/jade-v002';

/** The approved RGB-triplet field contract is independent of UVs, world transforms and time. */
export function attachJadeEvolution(material: THREE.MeshPhysicalMaterial, atlas: THREE.Texture) {
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.flipY = false; // PNG source row zero is uploaded as row zero; adapter flipV remains false.
  atlas.premultiplyAlpha = false;
  atlas.minFilter = atlas.magFilter = THREE.NearestFilter;
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.generateMipmaps = false;
  const seconds = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uSajuFields = { value: atlas };
    shader.uniforms.uSajuSeconds = seconds;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSajuRestPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSajuRestPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSajuRestPosition;\nuniform sampler2D uSajuFields;\nuniform float uSajuSeconds;\n${evolutionGLSL}`)
      .replace('#include <opaque_fragment>', `
        // outgoingLight already includes diffuse, specular, transmission, sheen and clearcoat.
        // Isolate the whole original BRDF once, then add the unchanged strength-2 green emission.
        SajuJadeEvolution jade = sajuEvaluateJadeEvolution(uSajuFields,
          sajuV001BodyGLTFLocalToGenerated(vSajuRestPosition), uSajuSeconds, false);
        outgoingLight = sajuComposeLinear(outgoingLight, jade);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'saju-approved-jade-v002-rgb-triplet';
  material.userData.approvedJadeVersion = 'v002';
  return { update(time: number) { seconds.value = wrapSeconds(time); } };
}

/** Load the unchanged B body. Only 乙 uses the approved jade; other stems retain existing recipes. */
export async function loadApprovedSpirit(dayKey: string, monthKey: string, quality: SpiritQuality): Promise<ElementalSpiritInstance> {
  const gltf = await new GLTFLoader().loadAsync(`${ASSET_ROOT}/body.glb`);
  const group = new THREE.Group();
  group.name = `saju-B-avatar:${dayKey}`;
  const model = gltf.scene;
  model.position.x = -.27;
  group.add(model);
  let body: THREE.Mesh | undefined;
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry.getAttribute('position')?.count === 33207) body = mesh;
  });
  if (!body || (body as THREE.SkinnedMesh).isSkinnedMesh || body.geometry.getAttribute('position').count !== 33207) {
    disposeObject(group);
    throw new Error('Approved B body does not match the verified undeformed adapter.');
  }
  // The source GLB has a limited pose-study morph. It must remain neutral: the field adapter
  // is verified against original mesh-local POSITION, not a recentered/skinned/posed export.
  body.morphTargetInfluences?.fill(0);
  const oldMaterials = Array.isArray(body.material) ? body.material : [body.material];
  const day = getSpiritStemPreset(dayKey), month = getSpiritStemPreset(monthKey);
  const animatedMaterials: THREE.Material[] = [];
  let jade: ReturnType<typeof attachJadeEvolution> | undefined;
  let atlas: THREE.Texture | undefined;
  if (day.stem === '을') {
    const loader = new THREE.TextureLoader();
    const loaded = await Promise.allSettled([
      loader.loadAsync(`${ASSET_ROOT}/base-color.png`), loader.loadAsync(`${ASSET_ROOT}/fields.png`),
    ]);
    if (loaded.some(result => result.status === 'rejected')) {
      for (const result of loaded) if (result.status === 'fulfilled') result.value.dispose();
      disposeObject(group);
      throw new Error('Approved jade textures could not be loaded.');
    }
    const base = (loaded[0] as PromiseFulfilledResult<THREE.Texture>).value;
    atlas = (loaded[1] as PromiseFulfilledResult<THREE.Texture>).value;
    const atlasImage = atlas.image as { width: number; height: number };
    if (atlasImage.width !== 2048 || atlasImage.height !== 1024) {
      base.dispose(); atlas.dispose(); disposeObject(group);
      throw new Error('Expected the v002 2048×1024 RGBA8 triplet atlas.');
    }
    base.colorSpace = THREE.SRGBColorSpace;
    base.flipY = false; // Original glTF UVs; no UV or geometry animation.
    const material = new THREE.MeshPhysicalMaterial({
      map: base, color: 0xffffff, metalness: 0, roughness: .24, ior: 1.54,
      transmission: .14, clearcoat: .25, clearcoatRoughness: .15, side: THREE.DoubleSide,
    });
    body.material = material;
    jade = attachJadeEvolution(material, atlas);
  } else {
    const material = createPlanetMaterial(day, undefined, 'pangaea', 128);
    setSurfaceReliefScale(material, 0);
    body.material = material;
    animatedMaterials.push(material);
  }
  for (const material of oldMaterials) disposeMaterial(material);

  const accent = createPlanetMaterial(day, undefined, 'pangaea', 128);
  setSurfaceReliefScale(accent, 0); animatedMaterials.push(accent);
  const features = createZodiacFeatures(dayKey.charAt(1), accent, quality);
  features.position.set(-.27, 1.9, 0);
  features.name = `day-branch-features:${dayKey.charAt(1)}`;
  group.add(features);
  const petMaterial = createPlanetMaterial(month, undefined, 'pangaea', 128);
  setSurfaceReliefScale(petMaterial, 0); animatedMaterials.push(petMaterial);
  const pet = createMonthSpiritPet({ ...month, key: monthKey, branch: monthKey.charAt(1) }, petMaterial, quality);
  pet.group.position.set(.9, 0, .1); group.add(pet.group);
  const eyes: THREE.Mesh[] = [];
  model.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh && mesh.name.includes('almond_gaze')) eyes.push(mesh); });
  const eyeScales = eyes.map(eye => eye.scale.y);
  let currentTime = 0, reactionStart = -100, disposed = false;
  const update = (time: number, delta = 0) => {
    if (disposed || !Number.isFinite(time)) return;
    currentTime = Math.max(0, time); jade?.update(currentTime);
    for (const material of animatedMaterials) animateSurface(material, delta);
    pet.update(currentTime);
    const elapsed = currentTime - reactionStart;
    const blink = elapsed >= 0 && elapsed < .5 ? 1 - .85 * Math.sin(Math.PI * elapsed / .5) : 1;
    eyes.forEach((eye, index) => { eye.scale.y = eyeScales[index] * blink; });
  };
  const reaction = () => { reactionStart = currentTime; };
  const reset = () => {
    reactionStart = -100; group.rotation.set(0, 0, 0);
    for (const material of animatedMaterials) resetSurface(material);
    update(0, 0);
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    disposeObject(group); atlas?.dispose(); group.removeFromParent(); group.clear();
  };
  const mapping = { bodyStem: day.stem, bodyBranch: dayKey.charAt(1), petStem: month.stem, petBranch: monthKey.charAt(1) };
  group.userData.mapping = mapping;
  group.userData.pillarRoles = { body: 'day-stem', features: 'day-branch', pet: 'month-stem-and-branch' };
  reset();
  return { group, data: TEN_STEM_SPIRITS[day.stem], bodyMesh: body,
    eyeLeft: eyes[0] ?? body, eyeRight: eyes[1] ?? body, propGroup: features,
    petPivot: pet.group, monthPet: pet.group, mapping, update,
    triggerReaction: reaction, triggerSquish: reaction, reset, dispose };
}
