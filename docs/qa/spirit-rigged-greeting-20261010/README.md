# New authored B greeting rig — review candidate, 2026-10-10

The rejected v32 procedural greeting is replaced in this independent branch by an actual skeleton, skin weights and an embedded greeting action. Deployed v32 remains unchanged. This is new work on private checkpoint `c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573`; it is not a recovered a97c418 candidate.

The remote baseline was rechecked: `main` is `2e2d82b05f87b39ff8057ae914e8dfa01100a974`; the protected `maint/guin-map-loading-20261009` remains `43e2d8dc6efe1654641e639397f37d0ea44f525a`. Neither is modified by this branch.

## Review videos

The original c6b79d2 loader and the candidate loader both run through actual Three WebGL with identical camera, lighting, frame times, synthetic 壬 spirit and the same existing dog. Each individual video has 135 frames at 30 fps, 4.5 seconds, 498×466. The comparisons are 996×466.

- [Front comparison](compare-front.mp4)
- [Side comparison](compare-side.mp4)
- [Rig front](rig-water-front.mp4), [rig side](rig-water-side.mp4)
- [v32 front](v32-water-front.mp4), [v32 side](v32-water-side.mp4)

The source arm is short. The new rig raises it above the shoulder, holds briefly, makes three distributed wrist waves and lowers. It does not use the old stretched hand height as its acceptance target. Final naturalness/appearance acceptance requires parent/user video review before deployment.

The attached user MP4 could not be materialized through the official Library transfer. No retries, alternative routes or 403 bypasses were used. Therefore this is a reproduced c6b79d2 baseline comparison, not an exact camera match against the attached MP4.

## Authoring and preservation

The separately authored [rig package](../../../assets/source-reference/saju-b-rigged-greeting-v001/README.md) contains the editable `.blend`, deterministic GLB, shared profile, manifest and hashes. The source GLB is untouched: SHA256 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`. All original 4,281,948 BIN bytes, original accessors, normals, UV, indices, images/materials, face transforms and source morph/clip are exact. Original depth 1.35, left arm, head/eyes, soles, zodiac pet and planet appearance are preserved.

Derived GLB SHA256: `6f9354848e33c9335f3fcae6752f0ad4821c0829f704bdc9e8cd19ede29282ec`. Independent regeneration has the same hash. There are 11 actual bones, at most two adjacent influences per vertex, 8,262 moving vertices and no new geometry or bone-length scaling. The `.blend` is an editable import with original shape keys and packed source textures; exact BIN preservation is guaranteed by the Node writer, not by claiming a Blender re-export is identical.

[Production preservation](preservation.json) compares all 334 original production files against c6b79d2: 322 unchanged, 12 permitted implementation/sync changes. All existing source/public assets, planet/galaxy recipes, zodiac generator, dependencies/lock, application APIs, authentication, database schema and hosting/access code are unchanged.

## Executed validation

- Original GLB has no skeleton: [before/failing fixture](baseline-no-skeleton-red.json).
- [Actual rig CPU](cpu.json): 7 checks, neutral/reset error below 7e-8, raise/hold/three waves/lower, paused rotation/repeated taps/backwards/reset, exact source attributes, surface-anchor and sand-collider current skin vertices. The 26 embedded-animation samples agree with runtime bone components within 1.35e-7. Motion-only timing is explicitly labeled.
- [Material-ring measurements](material-sections.json): 18 exported/runtime lift/wrist poses; visible-arm length ratios 1.000000–1.004779 and diameter ratios .995125–1.000054. Rings are sliced from actual triangles and then tracked barycentrically; the embedded torso section of the author curve is not counted as visible arm length.
- [Independent exported-rig geometry](independent-exported-rig-audit.json): full lift with wrist −1/0/+1 and half lift wrist0 have zero new severe adjacent folds, zero new strict noncoplanar self-intersections and zero triangles below .08 of source area. [Independent source/runtime/cache audit](independent-runtime-audit.json) also checks Float32 skinning arithmetic, paused cache revisions, display depth/rotation and shared skeleton disposal.
- [Native WebGL](native-webgl.json): 24 cases, 740 rendered frames, all ten stems × high/low quality with four fashion items. No shader/WebGL/browser error or outbound request. Exact source position/normal/UV hashes, depth 1.35, current triangle supports, stable paused/repeated-tap pixels. All 22 rig releases dispose the skeleton and allocated bone texture once; actual GL texture deletion is observed. Full spirit-update timing: median .20 ms, p95 4.40 ms, max 25.80 ms on this host. These figures exclude renderer time and are not device FPS certification.
- [Khronos validator](gltf-validator.json), package `2.0.0-dev.3.10`: zero errors, zero warnings. Eight informational notices are identical to the preserved original source.
- Current general motion 11/11, ten-stem integration 25/25, fashion 13/13, dew coalescence 7/7. Fourteen [additional regression suites](regressions.json) pass; logs are in `logs/`. Two initially lacked the host jsdom path and passed after using the already installed workspace QA dependency. Production dependencies/lock were not changed.
- TypeScript, targeted production ESLint, framework/Worker build and `git diff --check` pass.

The legacy `approved-spirit-raised-wave*.mjs` fixtures assert the superseded ten-derived-morph design and are historical v32 checks; they were not reported as passing on the actual skin rig. Their useful pose/cache/fashion contracts are covered by the new rig and updated general integration tests.

## Limits and retained diagnostics

The largest edge ratio is 2.581275 at a coarse torso-fade edge (20611–20610, source x≈.43/y .64–.67). The inward bent wrist compresses to .289188 at edge 21381–21380; minimum sampled triangle-area ratio is .274895. These are remaining local strains, not a claim of mathematically rigid skin. Collision checks exclude coplanar overlap and touching-only contacts. Chromium uses SwiftShader; physical mobile GPU verification and user artistic approval are unexecuted.

`procedural-diagnostics.tar.gz` preserves rejected procedural prototype code, compact measurement reports and diagnostic frames separately. Large reproducible position dumps are omitted; those experiments do not serve as final product visual proof and are not the missing historical candidate. The original v32 procedural implementation remains available at c6b79d2.

Existing woody branches, short vines, original fire, sandstone trickles and sliding/coalescing dew now resolve actual skin triangles. No completed full-body vine, fluid/cloth simulation, water spray or newly rebuilt zodiac is claimed. Library-restricted source files, credentials, `.env` and real user databases are not included. No main merge, PR, deployment or authentication/permission change was performed.

## Reproduce

```sh
node scripts/authoring/build-approved-spirit-rig.mjs --output /tmp/rig-rebuild
node scripts/sync-approved-jade-assets.mjs
node scripts/qa/approved-spirit-rig.mjs
python scripts/qa/approved-spirit-rig-sections.py
node scripts/qa/approved-spirit-rig-preservation.mjs
node scripts/qa/approved-spirit-motion.mjs
node scripts/qa/ten-stem-materials.mjs
node scripts/qa/spirit-fashion-cpu.mjs
node scripts/qa/surface-dew-coalescence.mjs
# Point this at a clean c6b79d2 checkout when reproducing baseline videos.
SAJU_RIG_BASELINE_ROOT=/path/to/c6-checkout node scripts/qa/approved-spirit-rig-browser.mjs
npm run build
```

The section audit requires NumPy; authoring the editable source requires Blender. Images/textures are real in browser verification and replaced only for CPU image I/O.
