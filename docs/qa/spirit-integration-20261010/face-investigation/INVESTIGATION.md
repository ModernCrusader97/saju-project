# Blurred duplicate face investigation

The reproduced 壬/癸 duplicate is a self-image in the screen-space transmission buffer. The source has one body, two original eyes, two glints, two brows, and one smile. No second facial geometry was found. The approved eye scale, position and blink animation are unchanged.

Baseline: `/workspace/saju-spirit-dew-coalescence-20261010`, immutable commit `1f1aa08ff74a1934a1ceb908957e041ffd97df41`. All product files remain unchanged; all evidence lives under this `/tmp` directory.

## Recommendation

Apply [water-face-transmission-proposal.patch](water-face-transmission-proposal.patch). It places only the seven original facial marker meshes on 壬/癸 in the transparent render list at opacity 1 and with depth writing preserved. `forceSinglePass=true` keeps their original DoubleSide markers to one main draw each. Their shadow casting and receiving flags remain untouched. 辛 and approved jade retain their original rendering path.

The proposed loader [source](proposed-approved-jade-spirit.ts) is unapplied. `git apply --check` passed. The exact source was also transformed through Vite, compiled, and rendered without changing baseline files: [source overlay report](source-patch/report.json). Its eight actual patched full/close frames match the dynamic candidate pixel hashes exactly.

## Cause and controls

Three r186 renders opaque facial markers into a half-float linear refraction target before rendering the water body. The water shader samples this target and displaces those foreground markers according to thickness and its water normal. It later displays the original markers directly too, producing the normal eye plus a blurred second eye and a separate lower smile. The native target readback shows the face without the body: [original transmission buffer](임신-high-0.00000-close-0.000-1-original-transmission-buffer.png). The selected candidate target is clear where the face had been: [candidate transmission buffer](임신-high-0.00000-close-0.000-1-face-after-transmission-water-transmission-buffer.png).

Every original B mesh casts shadows. The body and all seven facial markers have `receiveShadow=false`, confirmed in the linked native shader; the ground has `receiveShadow=true`. Shadow-off controls explicitly regenerate programs and confirm that the linked ground shader no longer defines `USE_SHADOWMAP`.

| Material, high-quality neutral | Facial casters disabled: changed pixels | All shadows disabled: full / close pixels | Candidate: full / close pixels |
|---|---:|---:|---:|
| 임신 | 0 close | 18343 / 0 | 8476 / 44322 |
| 계해 | 0 close | 18540 / 0 | 5221 / 30060 |
| 신해 | 0 close | 18540 / 0 | 0 / 0 |
| 기사 | 0 close | 18778 / 0 | 0 / 0 |

The water face-caster-off controls are pixel-identical in every tested pose. The global-shadow-off control removes visible floor shadows while leaving the closeup unchanged. Jade facial shadows contribute two floor pixels in one high-quality full frame; its closeup is unchanged. This is why the proposal preserves all facial and body shadow flags.

Excluding face color/depth writes only during the offscreen pass is an independent control: it agrees with the selected after-transmission rendering within one pixel in the high-quality water closeups and exactly in the low-quality closeups. This separates the warped refraction image from the direct geometry. A transmission-zero diagnostic also removes the second face, but changes the whole water material and is not proposed.

The static RoomEnvironment PMREM is built before the avatar is loaded and contains no face. The production Canvas has no temporal postprocessing/composer. The effect persists with antialiasing disabled in low quality and with renderer DPR 1, 1.75 (high), and 1.35 (low). The original facial offsets and the 1.35 body presentation depth are preserved.

## Visual evidence

| Material | Original | Proposed |
|---|---|---|
| 壬, neutral close | [PNG](임신-high-0.00000-close-0.000-1-original.png) | [PNG](임신-high-0.00000-close-0.000-1-face-after-transmission-water.png) |
| 癸, neutral close | [PNG](계해-high-0.00000-close-0.000-1-original.png) | [PNG](계해-high-0.00000-close-0.000-1-face-after-transmission-water.png) |
| 壬, blink midpoint 6.298 s | [PNG](임신-high-6.29800-close-0.000-1-original.png) | [PNG](임신-high-6.29800-close-0.000-1-face-after-transmission-water.png) |
| 癸, blink midpoint 6.646 s | [PNG](계해-high-6.64600-close-0.000-1-original.png) | [PNG](계해-high-6.64600-close-0.000-1-face-after-transmission-water.png) |

The selected candidate is also available composited on the actual QA Canvas background: [壬](source-patch/임신-close-canvas-composited.png), [癸](source-patch/계해-close-canvas-composited.png). The native PNGs above preserve RGBA for exact comparison.

## Verification

[Regression report](regression-report.json): PASS, 40 matched pose cases. Four legitimate material days (임신 壬, 계해 癸, 신해 辛, 기사 己), both production quality modes, neutral full view, neutral closeup, exact original blink midpoint, 0.55-radian oblique view, and production DPR. Each compares original, face-caster-off, true all-shadow-off, and scoped candidate. The suite checks original geometry/attribute hashes, facial positions/scales/matrices/bounds, body morphs, camera, absolute material time, transmission, thickness, and original caster/receiver flags. All 辛/jade candidate frames remain pixel-identical. Shader errors, page errors, external requests, and GL errors are zero.

Native linked water shader evidence (high neutral close):

| Day | receiveShadow | transmission | thickness | sampler unit | sampler size |
|---|---|---|---|---|---|
| 임신 | False | 0.8500000238418579 | 0.6200000047683716 | 4 | [640, 760] |
| 계해 | False | 0.9800000190734863 | 0.30000001192092896 | 4 | [640, 760] |

To repeat the final suite:

```sh
node /tmp/saju-face-duplicate-investigation-20261010/regression.mjs
node /tmp/saju-face-duplicate-investigation-20261010/source-patch-browser.mjs
```

The initial exploratory runs are retained for provenance. The final regression supersedes their early renderer-only shadow toggle with a linked-program-verified toggle. The final scoped candidate supersedes an unscoped control that changed one silver pixel due to draw ordering.

## Exact source hashes

| Source | SHA256 |
|---|---|
| `lib/planet/approved-jade-spirit.ts` | `64c85f63d50e63f57a53e4bcb10a98383657e2f3fce2fd9e5aaa7bde65a1a543` |
| `lib/planet/approved-spirit-motion.ts` | `92454b392446e9a85814aafd5653518ad7694d9b4465f3436353a6792d66377f` |
| `lib/planet/approved-stem-materials.ts` | `4f625fe9b75ee278e67b4b452b6bc16fe01f599bec2b48dad8e3842602266f7b` |
| `lib/planet/scene-environment.ts` | `6aca790acdf6b7e70282f22eb59e9030f68de681f3ffd958e918bde6fa12117e` |
| `components/planet/ElementalSpiritCanvas.tsx` | `16bdfd48f94ac3b069e331cdf70b154098cccbd02268cddade06d5bf0c0c971a` |
| `lib/planet/surface-sliding-dew.ts` | `536cc61b5b25edb014cd1514aabfc81ea2698f13dec3538e068d8a00f00d6805` |
| `public/spirits/jade-v002/body.glb` | `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84` |
| `node_modules/three/src/renderers/WebGLRenderer.js` | `9e8740aad691246b31b3704014e8f3bbd38a8e7bf4b1b4d23868541b023cc63a` |
| `node_modules/three/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js` | `586f774384f3442bdca1270d203b19f4cc318fd56ee522cdecc4a8b1cb9fc8fc` |

Proposed loader SHA256: `c37a59e821b90c40feb25944501800e16e671f7980db779a75f64d28f95684c9`.
Patch SHA256: `db1c8f07397ff46ae2aec273facaabe8314f4fb54062e39cb35a4d5600b944bf`.
Regression harness SHA256: `74157ad20f98b1917126793dd5e51b0c1af1393ed3fa2f7bc9d3942556ff5486`.
Page harness SHA256: `1cc330e34e007c0cd78c1ac29ad2eeb8c849de98503322a53eae00fcd73abe51`.

## Limits

The inaccessible supplied screenshot was not retrieved or used. The observation is reproduced independently with the actual approved body and material code. Tests run in native local Chromium ANGLE SwiftShader, with no physical GPU, hosted authentication, or browser-specific GPU comparison. The exact original geometry and pipeline are tested; accessories introduced during the separate fashion integration need their own render-pass check. No product edits, commits, pushes, deployments, dependency upgrades, pet changes, or dew-source changes were performed.
