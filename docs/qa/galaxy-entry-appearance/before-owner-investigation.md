# Owner planet appearance investigation

Read-only investigation of `/workspace/saju-galaxy-declarations`, verified HEAD `8ba3b9763bcaa88a8a3f2e108fa331a49800090f`. The existing `dist` was served without rebuilding it. These findings apply to this restored lineage. The exact deployed v29 source has not been recovered, and this checkout is not represented as the live v29 source.

## Actual reproduction

`compare-owner.mjs` runs the existing built Worker in disposable Miniflare with `cf:false`, an ephemeral localhost port, disposable D1 (`d1Persist:false`), and blocked outbound requests. Playwright uses local Chromium 151.0.7922.173 with actual SwiftShader WebGL. Host rAF and performance time are synthetic; reduced motion holds all surface/spin clocks at zero. Diagnostics inspect the actual component's React refs and Three scene. Control changes affect only the disposable browser's memory.

The personal page was opened with synthetic birth **2000-01-01 12:30**, then its populated galaxy form created an actual local map. The personal session, successful creation binding, API persisted `isMe` owner, and galaxy session have identical birth and full pillars: **day 무오 / month 병자 / year 기묘 / hour 무오**. Seven checks pass, no page/console errors, no outbound attempts. `results.json` contains the checks, scene parameters, shader uniforms, and source hashes.

## Confirmed causes

1. **Body surface effects exist only in the personal view.** `components/planet/PlanetCanvas.tsx:275-281` creates the shared material and attaches `createSurfaceEffects`. `components/planet/GalaxyCanvas.tsx:571-575` creates only the material/body. The actual personal body has sandstone outcrops (120 instances), strata caps (40), lava domes (28), flame plumes (28), and rising embers (28); the actual galaxy owner's body has none. Hiding only the personal effects, with unchanged material/camera/light/time, changes 1,839 pixels of its 448,152-pixel canvas. Compare `personal-baseline.png` and `personal-without-effects-control.png`.

2. **The galaxy ignores the owner's selected mask.** `app/planet/page.tsx:65-66` forwards `snapshot.maskStyle`, and `:93-94` lets the owner select it. `GalaxyCanvas.tsx:572` hard-codes `pangaea`; `app/guin/[id]/page.tsx:263-269` has no mask prop. A second actual same-birth map created after selecting `archipelago` keeps that preference in the bound session, but its compiled shader still receives the pangaea mask. Personal mask RGBA FNV1a = **1100551764**; galaxy = **2245384427**, both 512×256. This is a real mismatch for nondefault masks; it does not explain a default-pangaea user's mismatch.

## Eliminated causes for this same-owner run

- Both callers use `getStemThemePreset`: personal `PlanetCanvas.tsx:37-40`, galaxy `GalaxyCanvas.tsx:566-569`. `lib/planet/theme-library.ts:155-163` normalizes a valid full ganzi or a Korean heavenly stem to the same immutable stem preset (`key=stem`, `branch=''`). No differing preset/branch seed is involved.
- Both use `createPlanetMaterial`. Although callers ask for 1024 vs 512, `lib/planet/surface-material.ts:30-31` clamps the mask width to 512. Under default pangaea, the actual GPU compile uniforms, colors, profiles, mask bytes/hash, material name `living:무:병`, shader version, family defines, roughness, metalness, clearcoat, and ior are identical.
- `lib/planet/living-surface-shader.ts:353-358` seeds profiles from the stem. `:291-292` normalizes object coordinates, and `:318-319` scales relief according to the sphere radius. Scaling does not select a different material identity.
- `lib/planet/texture-generator.ts` and `blendPlanetSurfaces` remain defined but have no current app/component callers. They are not this live material path.
- Personal calculation uses `calculateUniverse`/`analyzeSaju`; API creation uses the same `analyzeSaju` (`app/api/guin/route.ts:9-18`) and persists full owner pillars (`:43-47`). `lib/planet/galaxy-helper.ts:123-124` directly uses those stored pillars. `lib/universe-state.ts:105-125` verifies the owner binding before reusing its snapshot. The tested mismatch is not an accidental comparison of two births/maps. Unbound legacy maps can still use the separate unknown-time/fallback path; that was not this reproduction.

## Context differences that should remain outside the minimum fix

| Parameter | Personal | Galaxy |
| --- | --- | --- |
| Main sphere geometry | radius 1.85; desktop 96×64, low 64×40 | radius 1, 32×32; owner scale 1.3 / friend .88 |
| Main material/mask | shared material, owner mask | shared material, hard-coded pangaea |
| Studio environment | same generated RoomEnvironment; intensity 1.1 | same |
| Exposure | 1.05 | 1.45 |
| Ambient | .22 | .85 |
| Directional lights | warm sun 2, blue fill .8, blue rim 1.5 | white sun 1.6, blue fill 1.1 |
| Core light | none | warm point light 4.5 |
| Camera | 45° FOV, (0,1.5,9.6), about 9° elevation | 45° FOV, initial radius22/phi .52; owner focus radius6.2/phi .44, about65° elevation |
| Body/satellite spin | .13 / .19 per second | .16 / .21 per second |
| Satellite size/body radius | .44/1.85 = .238 | .28 |
| Satellite orbit | x3.8, y.65, uninclined pivot | x2.2×body radius, pivot x.28/z.12 |
| Belt | 2200 particles; base scale1; y rotation .12 | 1200; scale .58×body radius; y rotation0 |

Geometry/UV density affects relief quality but both are Three SphereGeometry with the shared normalized sphere shader. The different camera exposes a different hemisphere of the same fixed mask.

Single-variable actual WebGL controls are saved:

- `galaxy-exposure-1.05.png`: exposure changed only, exact camera/body/lights unchanged. 363,774 pixels change; mean absolute RGBA difference 5.102 across the full canvas. This changes overall brightness, including background particles.
- `galaxy-personal-lights-only-control.png`: ambient/sun/fill/rim replaced with the personal lighting rules, translated around the owner's location; exact camera/body/material/exposure/time unchanged. 110,258 pixels change; full-canvas mean .203. In this dataset the material/patch identity remains the same.
- `galaxy-camera-personal-angle-control.png`: camera pose changed to the personal elevation/azimuth at the same camera-to-body distance; body/material/lights/exposure/time unchanged. It reveals the same lower-right lava patch as the personal view, but the galaxy plane puts bright particles in the foreground over the body.

These full-canvas numbers include background pixels and must not be treated as a perceptual ranking or as general results for all ten stems. The controls support preserving the existing galaxy scene lighting/camera while fixing the shared identity rules. A one-to-one pixel match between a studio close view and a galaxy scene is not a necessary or appropriate target for this minimum correction.

## Minimal proposal for the parent implementation

Use one shared appearance helper for existing day/month/hour **planet** stem materials and **body-only existing surface effects**. Retain the current shader/palette, scene lighting, camera, sphere LOD, belt, satellite geometry and composition. Do not route this helper through newly reconstructed approved ten-stem spirit materials or enable spirit bark.

Attach effects as a child of the matching sphere, using its **unscaled geometry radius**: **personal 1.85, galaxy 1**. The galaxy mesh's existing 1.3/.88 scale then correctly scales the effects. Passing radius1.3 into effects and attaching them to a 1.3-scaled mesh would double-scale them. The API explicitly documents this rule at `lib/planet/surface-effects.ts:278-280`; instance anchors/scales are proportional to radius at `:374-375`, with bounded radius×1.19 at `:383`.

Store an effects reference per galaxy body. Call `animateSurfaceEffects(effects, simulationTime, motionDt)`, reset to time0 alongside body reset, and call `disposeSurfaceEffects` before generic hierarchy disposal during every galaxy rebuild and unmount. `lib/planet/render-resources.ts:10-19` only disposes geometries/materials; it does **not** call `InstancedMesh.dispose`. `surface-effects.ts:33-53` explicitly handles instance buffers, removes its group, clears it, and is idempotent.

For the owner mask, the parent's proposed approach is sound: let `restoreGalaxyUniverse(map)` return a verified snapshot or null, preserve the current snapshot only when the saved path/map binding is valid and **complete owner key** (including birth time and calculated source) matches, then set a map-page `ownerMaskStyle` state from the result. Always set `restored?.maskStyle ?? 'pangaea'` on every map load to avoid style leakage on map A→B. Pass that style into the galaxy owner's material and effects, retaining pangaea for friends. Include the new prop in the rebuild-effect dependencies. `useUniverse` itself is unsuitable on the map route because its restore rewrites the URL to `/planet`.

For new tabs/legacy unbound maps, exact birth time cannot be recovered from GET; null and existing pangaea fallback preserve the current source-binding behavior. Do not relax owner validation merely because pillars/stems happen to match.

## Forest and cleanup risks read from source

- `surface-effects.ts:399-416`: 갑 creates trunks and tiered forest canopies; 을 creates trunks, broadleaf canopies, and climbing vines. Counts are deterministic and region area-scaled: full 갑860, full 을920; two meshes per tree plus about⅓ vines for 을. Both normalize to the same stem-only seed and branch tint across views.
- Instance anchors and instance size scale linearly with unscaled radius; normal transforms already account for nonuniform instance shape scale (`:127-160`). Uniform parent scale1.3/.88 is compatible.
- This introduces several batches and potentially thousands of instances per forest planet. Repeated rebuild/disposal and a multi-person mobile scene should be checked by the implementation owner; do not change designs to address cost before measuring.
- `surface-material.ts:70-77` and `living-surface-shader.ts:353` make bark opt-in and default0. The common planet helper should keep that default and use existing forest VFX, not the spirit bark/leaf pipeline.

No production files, Git state, authentication, permissions, deployments, external services, or Library content were changed. All scripts and artifacts are confined to `/tmp/saju-owner-look-investigation`.
