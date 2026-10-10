# Galaxy system spacing and independent directions — review candidate, 2026-10-10

This independent candidate starts at private checkpoint `c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573`, the unchanged v32 source. It does not include or deploy the separately authored B greeting rig. The rig is preserved on `feature/spirit-b-rigged-greeting-20261010` at `9e7d2ed470db89cc6c0179cf9d34a2e05df4cdba`; its videos require parent/user review before any deployment.

The private remote was checked again: `main` remains `2e2d82b05f87b39ff8057ae914e8dfa01100a974`, and protected `maint/guin-map-loading-20261009` remains `43e2d8dc6efe1654641e639397f37d0ea44f525a`. This work uses its own branch, `feature/galaxy-spacing-directions-20261010`.

## Result and construction

Previously, systems could overlap immediately and could later meet as their differing orbit speeds aligned. Each system now reserves a conservative full sphere containing its unchanged body, living relief, entire tilted particle ring including jitter/thickness/sprite size, and the complete existing hour-moon sweep. The gap between these spheres is at least **0.6 world units**, scaled upward with distance settings above 1.

Different orbital lanes have disjoint radial swept bounds. Multiple systems on one lane have sufficient horizontal chord separation and use that exact same lane radius in the original angular-speed formula, so their relative phase remains fixed. The stationary owner reserves a full annulus. These bounds cover all future angles; finite time sampling alone is not the proof. Packing runs during setup, without a frame-time collision solver or collision jump.

The original affinity value, pillar data and arm assignment remain unchanged. Packing chooses a feasible lane nearest the proposed radius and an angle offset no larger than π/4 from the proposal. A newly appended person does not move existing anchors. The original orbit rate remains `.052 / sqrt(max(1, radius / 6))`; body/ring/moon speed magnitudes remain `.16/.075/.32/.21` radians per simulation second.

Each person ID seeds four independent direction streams: body spin, year ring, existing hour-moon orbit and moon spin. Every direction is ±1, decided at setup; frames do not generate randomness. Absolute simulation time preserves spin phase when the actual React scene rebuilds, pauses, changes speed, appends a person, resets or reloads the same IDs.

New arrivals descend vertically above their moving safe orbit, retaining the original 2.8-second cubic approach and zero offset/offset derivative at the join. Existing motion stays continuous during the scene rebuild. The original camera, lighting, geometry, material recipes, appearance bindings and product UI remain unchanged.

## Validation evidence

- [Before](cpu-before.json): the c6 fixture has a minimum full-system gap of −1.64667 at two systems and distance 0.7; the new direction/layout APIs are absent.
- [CPU after](cpu-after.json): eight checks pass. Two/8/24/64 systems, mixed moons and distance 0.7/1/1.5 are sampled through 24 hours. The 128-system analytic minimum is **0.60002** across eight lanes. Thirty/60/144-fps one-hour loops preserve anchors, with maximum orbit endpoint error below 2.01e-8. The 96 owner-hour/moon/affinity/distance combinations also pass. Ten thousand IDs have both signs in every stream and maximum pairwise correlation magnitude .0258. Construction of 256 systems took approximately 16 ms on this host.
- [Actual React scene](actual-react-scene.json): the real component and Three objects execute every frame for 24 systems over 600 synthetic seconds at 30/60/144 fps. Minimum gap is at least .60016. Append, pause, speed zero and reset preserve the expected transforms and ID directions. GPU/Canvas2D/time boundaries are explicit; this is distinct from native WebGL.
- [Independent review](independent-review.json): 160 randomized mixed-moon fixtures, 7,749 systems and 241,955 analytic pair bounds; minimum .60002. Actual React mask/list rebuild, entry, pause, zero speed, reset, reduced motion and no-hour owners pass. The review found the first-lane rounding defect before the fix; the [failing boundary reproduction](independent-boundary-reproduction.json) and [failing CPU fixture](cpu-boundary-before.json) are retained. Adding a second candidate margin fixes one-ULP rejection while leaving the strict safety predicate unchanged. No remaining critical or important defect was found.
- Native built Worker, disposable synthetic D1 and Chromium/SwiftShader WebGL: see `native-webgl.json` and `frames/`. The runner checks 30/60/144-fps real entry boundary draws and submitted GPU model matrices, unchanged personal/galaxy owner masks/effects, all ten existing effects, and 24/32-system spacing/directions with pause/reset/reload. The 32-system case advances through one synthetic hour; GPU draws are sampled during long runs. Offscreen systems are included in the full-scene CPU bound but are not claimed as visible GPU draws.
- Existing entry CPU 23/23, owner effects 13/13, owner-mask session 10/10, orbit-anchor, connection-sampling and visibility-loop regressions pass. The [entry](entry-cpu.json), [owner effects](owner-effects-cpu.json), [orbit](orbit-anchor.json) and [visibility](visibility-loop.json) results and compressed logs are retained.
- TypeScript, core production ESLint, framework/Worker build and `git diff --check` pass. The actual `GalaxyCanvas.tsx` has six pre-existing ESLint errors and four warnings; [baseline/current delta](lint-delta.json) has exactly the same rule counts. Full UI lint is **not** reported as passing.
- [Byte preservation](preservation.json): all 1,101 pre-existing tracked files are compared to c6; 1,097 are unchanged and only four allowlisted galaxy files differ. The original approved source GLB and public body both retain SHA256 `0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`. UV/depth/morphs, B source, pet/planet recipes, APIs/auth/database schema, dependencies/lock and hosting files remain exact.

The first native QA run rejected numeric −0 versus +0 after a negative-direction reset. This was a test comparison error, not a motion or geometry defect; the test now compares zero magnitude. Its [initial report](native-qa-signed-zero-before.json) and log are retained. The final native report is the acceptance run.

## Limits

Chromium uses SwiftShader and a synthetic frame clock. Physical mobile GPU performance, actual mobile suspension and artistic approval are unexecuted. Long-run GPU draws are sampled; all-angle separation comes from the analytic bounds and full-scene tests. Native timings include software rendering and synchronous GPU-uniform readback instrumentation. The densest 144-fps fixture's 12 measured draws have median 355.5 ms and p95 764.3 ms on this instrumented software renderer; these requested simulation rates do not certify a device frame rate or demonstrate a performance improvement over v32.

Physical envelopes exclude text label rectangles and the central star glow. Perspective projection can still overlap labels or unrelated depths. Existing camera/frustum limits remain in place, so very dense outer systems may require the existing navigation/zoom controls. This change does not claim a redesigned camera or collision-free screen-space labels.

No main merge, PR, deployment, public upload or authentication/permission change is performed. No Library-restricted source, credentials, `.env` or real user DB is included. All API/D1/browser fixtures are synthetic and disposable; outbound requests are blocked. This candidate is new work, not the missing historical a97c418 artifact.

## Reproduce

```sh
node scripts/qa/galaxy-spacing-directions.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-spacing-directions-scene.mjs
node scripts/qa/galaxy-spacing-preservation.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-entry-motion.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-owner-effects.mjs
SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/galaxy-owner-mask-session.mjs
node scripts/qa/galaxy-orbit-anchor.mjs
node scripts/qa/galaxy-connection-sampling.mjs
node scripts/qa/visibility-loop.mjs
npx tsc --noEmit
npx eslint lib/planet/galaxy-system-layout.ts lib/planet/galaxy-helper.ts lib/planet/galaxy-motion.ts lib/planet/asteroid-belt.ts
npm run build
SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/qa/galaxy-spacing-directions-browser.mjs
```

The workspace's existing QA-only jsdom/Playwright dependencies are used without changing production dependencies. See the JSON source/build/harness hashes and `SHA256SUMS` for the exact evidence set.
