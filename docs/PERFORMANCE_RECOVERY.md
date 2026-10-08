# Recovered animation performance improvements

Recovered on 2026-10-08 from the exact published v27 source commit
`9cfbe47e373a79e88006405c8bc3c4298c62b6d8`, tree
`c53ec9574b6045e7a7b0da30c1f80e636aa6fc11`. The previous unpublished local
commits were lost during an environment restart. These changes are a tested
reconstruction, not a claim to have recovered those identical commit objects.
The complete v27 source and tracked assets were preserved separately before edits.

## Bounded changes

- The spirit, planet and galaxy canvases share a viewport/document-visibility
  animation scheduler. It waits for the first intersection result, stops automatic
  animation callbacks while offscreen or hidden, resets the elapsed-time baseline
  on resumption, and rejects callbacks belonging to an old suspended/disposed loop.
  Missing or throwing IntersectionObserver falls back to document visibility.
  Reduced-motion, user pause/play, scene interaction and rendering logic remain
  in the original canvas callbacks. The initial spirit setup frame is unchanged.
- Galaxy connection curves reuse two scene-local vectors. The same 25 samples
  are written into the existing Float32 position buffer, followed by the same
  bounding-sphere update and pulse phase/position computation. No shaders,
  geometry definitions, approved art, model depth or day-branch companion mapping
  were changed. This is curve-sampling allocation reduction, not a claim that the
  entire scene is allocation-free.

## Fresh verification

Both focused regression suites were first observed failing against the recovered
baseline and then passing with the reconstruction:

- `node scripts/qa/visibility-loop.mjs`: 8 groups. 180 offscreen ticks produce
  zero automatic callbacks. Visibility transitions exclude 160-second hidden
  intervals, and disposal, stale callbacks, remounts, repeated events and observer
  fallback are covered. The production TypeScript helper is transpiled in-process.
- `node scripts/qa/galaxy-connection-sampling.mjs`: 4 groups. Executes the actual
  canvas sampling block and compares it with the v27 block from Git history.
  Ten connections over 120 frames create 31,200 sample vectors and 1,200 sample
  arrays in v27, versus zero in the reconstruction. Float32 coordinates, pulse
  phase/position and bounding spheres match exactly. Missing-owner fallback,
  buffer identity, zero motion, wraparound and scene isolation are covered.
- TypeScript `tsc --noEmit` and the normal checksum-prepared `npm run build` pass.
- Local synthetic integration: 23 checks pass, with outbound provider calls
  intercepted. No production records or paid AI calls are used.
- Saved archive: 4 API groups and 6 DOM groups pass; chat recovery: 7 DOM groups;
  dialog accessibility: 3 DOM groups.
- Approved source-art verification: 46 files, exact PNG/raw match and restored
  original GLB hash pass. Approved evolving-light material CPU tests: 10/10 pass.
- New helper ESLint is clean. The three existing canvas files retain the same
  7 errors and 7 warnings as v27, compared by rule, severity and message. Existing
  findings concern hook/memoization declarations, JSX apostrophes, unused variables
  and the image-element warning. No unrelated lint cleanup was bundled.

The repository has no aggregate `test` script. These commands cover its relevant
documented synthetic, DOM, material and build checks. No new real-browser, WebGL,
GPU frame-rate, touch-device or hosted-sign-in verification is claimed. Build
chunk-size and route-classification notices remain. Publication status and the
resulting source commit are recorded separately in the deployment receipt.

Authentication, audience, environment values, API/provider settings, persistence
schema and previous published versions remain outside the change.
