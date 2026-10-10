# Actual B sandstone fissure sand

This is a new, bounded reconstruction from the preserved private repository,
not a recovery of the missing latest material candidate. It adds only 戊's
falling grains. The integration router, body idle animation and deployment are
handled separately by the parent workstream.

## Runtime behavior

- Four actual-triangle sources × six grains at low quality (24 instances), or
  six sources × eight grains at high quality (48 instances). One shared
  `MeshStandardMaterial`, one 20-triangle `IcosahedronGeometry`, one draw mesh;
  no downloaded textures or external models.
- Each source has a stable body triangle and barycentric position. The
  CPU crack field interpolates `stemRestPosition`, including the approved
  fixed model X placement and depth 1.35. It selects deep F2−F1 fissures below
  0.006 in the unchanged sandstone material's 0.010–0.055 crack field, using
  three FBM octaves at low quality and four at high quality.
- Each update resolves the emitter's actual current surface position and
  inverse-transpose geometric normal. Rigid transforms and the explicitly
  enabled preserved `Gentle_wave_pose` morph are supported. Rest-space crack
  identity remains unchanged during that pose motion.
- Absolute time controls deterministic intermittent trickles, gravity in
  world −Y, floor-bound fading and respawning. A static-topology triangle BVH
  hides flights whose emitter-to-grain segment intersects the current body.
  Its posed vertex storage and topology persist; meaningful moving subtrees
  refit when morph weights change.
- All nonzero morph deltas use exact CPU posed vertices. The GLB contains
  exported numerical noise outside its moving arm, so unchanged subtrees use
  a conservative 2 micrometre envelope per morph target for weights in
  [−1,1]. Larger weights trigger complete bound refits. There are no new
  per-frame geometry or material allocations.
- Current accessory exclusion regions hide affected source batches; removing
  an item restores the same sources and same-time matrices.
- Disposal removes the effect group and releases the owned instance buffers,
  geometry and material exactly once. Source model resources remain caller
  owned. The effect allocates no textures.

## Reproduce

```sh
node scripts/sync-approved-jade-assets.mjs
node --test scripts/qa/surface-fissure-sand.mjs
SAJU_QA_SAND_WEBGL=1 node --test scripts/qa/surface-fissure-sand.mjs
```

Browser QA uses the installed Playwright at
`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`
and `/usr/bin/chromium`; both are overridable with
`SAJU_QA_PLAYWRIGHT_PATH` / `SAJU_QA_CHROME`. The browser harness permits local
requests and data/blob URLs only.

The baseline check was run before implementation on the disabled 戊 router
from `ee6e9740054394b0bee30563f35e957b49adf4bb`: both low and high tests
failed at `diagnostics.supported === true`, proving the missing effect. The
saved baseline report records that intentional failure; it is not a passing
baseline. The same baseline switch should only be used on that unchanged
router, since the integrated new router now enables sand.

## Evidence

The preserved GLB SHA-256 is
`0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`.
CPU QA verifies that the generated browser runtime GLB equals it byte for
byte, and checks original POSITION/NORMAL/UV/index hashes before and after
effect use. The source POSITION remains
`f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b`,
and source UV remains
`f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c`.

The CPU tests cover source triangles, rest coordinates, quality bounds,
absolute-time reset, transformed normal attachment, world-Y acceleration,
tilted-body crossing suppression, active pose refits, accessory masking,
input validation and disposal. Changing-wave collision update is budgeted
to a ≤3ms local CPU median after warmup. The saved report records measured
median/p95 values; these are host CPU measurements, not mobile FPS claims.

The WebGL test extracts the actual production material's `stHash`,
`stNoise`, `stFbm`, `stCell`, warp expression, block expression and fissure
threshold into a float render target. It compares 260 low-quality and 262
high-quality real body rest coordinates, including all selected sources.
Observed maximum CPU/GPU differences were 9.24e−7 (low) and 7.75e−7 (high).
All ten emitters had GPU fissure intensity 1. The test does not infer crack
alignment from a similar-looking texture.

The PNGs show actual runtime sandstone shading and real grains in front,
side, oblique posed views and three closeup motion frames per quality.
The `motion-0.00`, `motion-0.12` and `motion-0.24` filenames indicate offsets
from the selected burst time, not absolute simulation time. The report
records actual absolute times. Grains are intentionally small: the full
480px front render changed 23 low-quality / 50 high-quality pixels when
grains were disabled at the same camera and time.

The GPU cleanup check returns zero owned geometries and explicitly
identifies the one retained native texture as Three r186's engine-global
`DFG_LUT` (16×16 RG half-float), through the actual shader uniform and GL
handle. It does not count that engine cache as a sand texture or claim that
Three's memory counter reaches zero. The harness then releases its WebGL
context. No browser shader errors or outbound requests were observed.

## Limits

- This is a restrained trickle detail, not a full-body eroding sand model.
- Flights are recomputed from the emitter's current pose on seeks and
  rotation changes. Independent historical birth transforms are not stored.
- Collision hides segment crossings; it does not simulate grain bouncing,
  settling, floor piles, swept volumes or collisions with unrelated pets or
  accessories. Accessory masks apply to source regions.
- The collider refits preserved pose morphs on fixed topology; skinning and
  arbitrary topology changes require rebuilding.
- CPU/GPU alignment was verified on local Chromium SwiftShader WebGL2.
  Floating arithmetic on physical GPUs remains unverified.
- Hosted owner authentication, actual hosted visuals, deployment and final
  application integration are outside this module's isolated QA and are
  reported by the parent workstream.

Implementation: `lib/planet/surface-fissure-sand.ts` and
`lib/planet/sandstone-fissure-field.ts`. All runtime detail is regenerable
from code and the preserved source GLB; no new binary asset is required.
