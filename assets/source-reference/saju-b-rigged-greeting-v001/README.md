# Approved B greeting rig v001

This is a new derivative authored on private checkpoint `c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573`. It is not the unavailable a97c418 candidate and does not overwrite the approved sculpture.

The source remains `../saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb`, SHA256 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`. All 4,281,948 original BIN bytes and existing accessors, UV, normals, indices, image/material data, facial transforms and `Gentle_wave_study` animation are preserved. The runtime continues to apply the original 1.35 display-depth scale. The original study morph remains neutral during the greeting.

The derived GLB adds an actual glTF skin with 11 bones: a fixed rest bone, five soft shoulder-support bones and a chain controlling upper arm, forearm, wrist support, wrist and hand. Each vertex uses at most two adjacent influences. Head, eyes, soles and left arm stay on the original rest transform. The source body remains one connected 33,207-vertex, 62,124-triangle mesh.

`rig-profile.json` defines the rest landmarks, harmonic shoulder field, lower-body fade, shoulder lift, distributed wrist bend and raise/hold/three-wave/lower timing. The same profile drives the embedded portable animation and the runtime bone controls. Bone scales stay at one; no additional arm geometry or length scaling is introduced.

Regenerate from the repository root:

```sh
node scripts/authoring/build-approved-spirit-rig.mjs
blender --background --python scripts/authoring/save-approved-spirit-rig.py
node scripts/sync-approved-jade-assets.mjs
```

`--output /tmp/rig-rebuild` writes the deterministic GLB and manifest to a separate directory. The editable `.blend` was imported from this GLB with vertex merging disabled, textures packed and both original shape keys retained. It includes the armature, weights and greeting action for inspection/editing. The exact-preservation export is the Node authoring script; a fresh Blender export is not claimed to preserve original BIN bytes.

Skinning permits small local compression at a bent wrist and larger coarse torso-boundary triangle strain. Cross-section and strict triangle-intersection measurements are documented in `docs/qa/spirit-rigged-greeting-20261010`; those checks do not certify all coplanar/touching contacts or artistic approval. The shoulder support distributes the transition rather than applying hard cuts. Existing surface effects and fashion follow actual skinned triangles; this is not cloth or fluid simulation.

Original procedural experiments are preserved separately as rejected diagnostics in the QA archive. Front and side videos require parent/user review before any deployment. Deployed v32 is unchanged.
