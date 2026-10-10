import * as THREE from "/@fs/workspace/saju-project/node_modules/three/build/three.module.js";
import { GLTFLoader } from "/@fs/workspace/saju-project/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import evolutionGLSL from "/assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.glsl?import&raw";
import { wrapSeconds } from "/assets/source-reference/saju-b-evolving-light-v002/runtime/saju-jade-evolution.mjs";
import { getSpiritStemPreset, TEN_STEM_SPIRITS } from "/lib/planet/spirit-profiles.ts";
import { loadZodiacPet } from "/lib/planet/spirit-zodiac-pet.ts";
import { createStemMaterial } from "/lib/planet/approved-stem-materials.ts";
import { bindCharacterRestCoordinates } from "/lib/planet/character-rest-coordinates.ts";
import { createSurfaceStemAccents } from "/lib/planet/surface-stem-accents.ts";
import { createApprovedSpiritMotion } from "/lib/planet/approved-spirit-motion.ts";
import { disposeObject, disposeMaterial } from "/lib/planet/render-resources.ts";
const ASSET_ROOT = "/spirits/jade-v002";
/** Explicit presentation derivative requested after v24. The archived B GLB,
* UVs and mesh-local field coordinates stay unchanged; only world Z gains 35%. */
export const APPROVED_BODY_PRESENTATION_DEPTH = 1.35;
const APPROVED_STEM_KEYS = {
	갑: "甲",
	을: "乙",
	병: "丙",
	정: "丁",
	무: "戊",
	기: "己",
	경: "庚",
	신: "辛",
	임: "壬",
	계: "癸"
};
/** The approved RGB-triplet field contract is independent of UVs, world transforms and time. */
export function attachJadeEvolution(material, atlas) {
	atlas.colorSpace = THREE.NoColorSpace;
	atlas.flipY = false;
	atlas.premultiplyAlpha = false;
	atlas.minFilter = atlas.magFilter = THREE.NearestFilter;
	atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
	atlas.generateMipmaps = false;
	const seconds = { value: 0 };
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uSajuFields = { value: atlas };
		shader.uniforms.uSajuSeconds = seconds;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSajuRestPosition;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvSajuRestPosition = position;");
		shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vSajuRestPosition;\nuniform sampler2D uSajuFields;\nuniform float uSajuSeconds;\n${evolutionGLSL}`).replace("#include <opaque_fragment>", `
        // outgoingLight already includes diffuse, specular, transmission, sheen and clearcoat.
        // Isolate the whole original BRDF once, then add the unchanged strength-2 green emission.
        SajuJadeEvolution jade = sajuEvaluateJadeEvolution(uSajuFields,
          sajuV001BodyGLTFLocalToGenerated(vSajuRestPosition), uSajuSeconds, false);
        outgoingLight = sajuComposeLinear(outgoingLight, jade);
        #include <opaque_fragment>`);
	};
	material.customProgramCacheKey = () => "saju-approved-jade-v002-rgb-triplet";
	material.userData.approvedJadeVersion = "v002";
	return { update(time) {
		seconds.value = wrapSeconds(time);
	} };
}
/** New rebuild from preserved sources: B geometry stays intact, the day stem
* selects its study recipe, and 己 uses the approved evolving jade. */
export async function loadApprovedSpirit(dayKey, monthKey, quality) {
	const gltf = await new GLTFLoader().loadAsync(`${ASSET_ROOT}/body.glb`);
	const group = new THREE.Group();
	group.name = `saju-B-avatar:${dayKey}`;
	const model = gltf.scene;
	model.position.x = -.42;
	model.scale.z = APPROVED_BODY_PRESENTATION_DEPTH;
	model.userData.presentationDepthScale = APPROVED_BODY_PRESENTATION_DEPTH;
	group.add(model);
	// Display rotation/depth stays on model. This identity child owns the small
	// idle transform; body, facial markers and attachments share the same frame.
	const motionRoot = new THREE.Group();
	motionRoot.name = "ApprovedSpiritMotion";
	for (const child of [...model.children]) motionRoot.add(child);
	model.add(motionRoot);
	let body;
	model.traverse((object) => {
		const mesh = object;
		if (mesh.isMesh && mesh.geometry.getAttribute("position")?.count === 33207) body = mesh;
	});
	if (!body || body.isSkinnedMesh || body.geometry.getAttribute("position").count !== 33207) {
		disposeObject(group);
		throw new Error("Approved B body does not match the verified undeformed adapter.");
	}
	// Bind original reference coordinates before reusing the preserved limited
	// wave morph. Original POSITION/UV/targets are never rewritten.
	body.morphTargetInfluences?.fill(0);
	const oldMaterials = Array.isArray(body.material) ? body.material : [body.material];
	const day = getSpiritStemPreset(dayKey), month = getSpiritStemPreset(monthKey);
	const stem = APPROVED_STEM_KEYS[day.stem];
	let stemMaterial;
	let restBinding;
	let effects;
	let jade;
	let atlas;
	let pet;
	let motion;
	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		motion?.dispose();
		// Effects own their instance buffers and remove themselves before generic traversal.
		effects?.dispose();
		pet?.dispose();
		// Three r186 deletes GPU buffers for the attributes attached at geometry.dispose().
		// Restore rest attributes only after that traversal has released their buffers.
		disposeObject(group);
		restBinding?.dispose();
		atlas?.dispose();
		group.removeFromParent();
		group.clear();
	};
	try {
		if (stem === "己") {
			const loader = new THREE.TextureLoader();
			const loaded = await Promise.allSettled([loader.loadAsync(`${ASSET_ROOT}/base-color.png`), loader.loadAsync(`${ASSET_ROOT}/fields.png`)]);
			if (loaded.some((result) => result.status === "rejected")) {
				for (const result of loaded) if (result.status === "fulfilled") result.value.dispose();
				throw new Error("Approved jade textures could not be loaded.");
			}
			const base = loaded[0].value;
			atlas = loaded[1].value;
			const atlasImage = atlas.image;
			if (atlasImage.width !== 2048 || atlasImage.height !== 1024) {
				base.dispose();
				throw new Error("Expected the v002 2048×1024 RGBA8 triplet atlas.");
			}
			base.colorSpace = THREE.SRGBColorSpace;
			base.flipY = false;
			const material = new THREE.MeshPhysicalMaterial({
				name: "己 · Approved evolving jade v002",
				map: base,
				color: 16777215,
				metalness: 0,
				roughness: .24,
				ior: 1.54,
				transmission: .14,
				clearcoat: .25,
				clearcoatRoughness: .15,
				side: THREE.DoubleSide
			});
			body.material = material;
			jade = attachJadeEvolution(material, atlas);
		} else {
			// The parent group removes display transforms while retaining the fixed B
			// presentation depth on its model child. Original POSITION/NORMAL/UV stay intact.
			restBinding = bindCharacterRestCoordinates(group, [body]);
			stemMaterial = createStemMaterial(stem, quality, {
				coordinateMode: "character-rest",
				coordinateDensity: stem === "壬" ? 2.6 : 1
			});
			body.material = stemMaterial.material;
		}
		for (const material of oldMaterials) disposeMaterial(material);
		motion = createApprovedSpiritMotion(motionRoot, body, stem);
		body.userData.raisedWaveQAEffectsSetupMorphCount = body.geometry.morphAttributes.position.length;
		effects = createSurfaceStemAccents(stem, {
			meshes: [body],
			quality,
			allowMorphTargets: true
		});
		const features = effects.group;
		features.userData.surfaceAccentDiagnostics = effects.diagnostics;
		motionRoot.add(features);
		pet = await loadZodiacPet(dayKey.charAt(1), quality);
		const ownedPet = pet;
		pet.group.position.set(1.1, 0, .12);
		group.add(pet.group);
		model.traverse((object) => {
			const mesh = object;
			if (!mesh.isMesh) return;
			// Fire uses transparent camera-facing cards without an alpha-aware depth
			// shader. Keep the B body and other accents casting their existing shadows.
			mesh.castShadow = mesh.userData.surfaceNonShadowCaster !== true && !((stem === "丙" || stem === "丁") && mesh.isInstancedMesh);
		});
		const eyes = [];
		model.traverse((object) => {
			const mesh = object;
			if (mesh.isMesh && mesh.name.includes("almond_gaze")) eyes.push(mesh);
		});
		let currentTime = 0, disposed = false;
		const update = (time, _delta, camera) => {
			if (disposed || !Number.isFinite(time)) return;
			currentTime = Math.max(0, time);
			motion?.update(currentTime);
			jade?.update(currentTime);
			stemMaterial?.update(currentTime);
			// A zero delta still rebinds attachments after a paused drag. Absolute time
			// preserves pause, backwards seeks and reset, including fire-card sorting.
			effects?.update(currentTime, camera);
			ownedPet.update(currentTime);
		};
		const reaction = () => {
			motion?.triggerReaction();
		};
		const reset = () => {
			if (disposed) return;
			group.rotation.set(0, 0, 0);
			model.rotation.set(0, 0, 0);
			motion?.reset();
			update(0, 0);
		};
		const dispose = () => {
			if (disposed) return;
			disposed = true;
			release();
		};
		const mapping = {
			bodyStem: day.stem,
			bodyBranch: dayKey.charAt(1),
			petBranch: dayKey.charAt(1),
			backgroundStem: month.stem,
			backgroundBranch: monthKey.charAt(1)
		};
		group.userData.mapping = mapping;
		group.userData.pillarRoles = {
			body: "day-stem",
			pet: "day-branch",
			background: "month-pillar"
		};
		reset();
		return {
			group,
			data: TEN_STEM_SPIRITS[day.stem],
			bodyMesh: body,
			eyeLeft: eyes[0] ?? body,
			eyeRight: eyes[1] ?? body,
			propGroup: features,
			avatarPivot: model,
			petPivot: pet.group,
			zodiacPet: pet.group,
			monthPet: pet.group,
			mapping,
			update,
			triggerReaction: reaction,
			triggerSquish: reaction,
			reset,
			dispose
		};
	} catch (error) {
		release();
		throw error;
	}
}
