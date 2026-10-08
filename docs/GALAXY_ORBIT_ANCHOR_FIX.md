# Stable surrounding-planet orbit

## Report and reproduced cause

The owner reported on 2026-10-08 that surrounding planets in the galaxy view were
spinning extremely fast. The production connection construction passed the same
`node.worldPos` vector into `QuadraticBezierCurve3.v2`. Every frame, connection
sampling copied the planet's current position into that vector. The next orbit
step then rotated this already-rotated anchor by the full elapsed-time angle again.

The result was accelerating, frame-rate-dependent movement. A synthetic planet
with starting position `[7, 0.3, 2]` ended 9.3388 scene units away from its intended
position after one second at 60 FPS. Its 60 FPS and 120 FPS positions differed by
9.4700 units. These are CPU scene-coordinate measurements from the actual v28
motion and connection code, not device-frame-rate measurements.

## Minimal correction

Copy the owner and friend endpoint vectors when constructing each curve. The
curve can then update freely without changing either fixed orbit anchor. This
adds two vectors once per connection; the recently restored per-frame sampling
still creates no sample vectors or arrays. The orbital speed coefficient `.052`,
radius-dependent speed rule, direction, path, art, shaders, geometry, camera and
stored data are unchanged.

## Regression coverage

`node scripts/qa/galaxy-orbit-anchor.mjs` executes the actual production curve
constructor, orbital-position block and connection-update block with synthetic
Three.js objects. It was observed failing before the endpoint copies were added.

- Fixed anchors are independent of mutable curve endpoints.
- 30, 60 and 144 FPS produce the same intended positions at 1, 10, 60 and
  600 simulated seconds, without acceleration.
- The representative radius-7.28 orbit returns to its starting point after
  133.097 seconds with the original speed rule.
- 180 paused frames do not move the planet; resuming advances one normal step.
- Connection endpoints continue to follow the current planet positions.
- Separate scenes do not affect each other's anchors.

The existing visibility-gate and allocation-reuse regressions are retained. This
is a source/CPU fix; no fresh real-browser, WebGL or device appearance verification
is claimed. The unrelated galaxy-load recovery draft remains on its separate
unpublished branch and is not included here. Deployment and artifact receipts
are recorded separately after approval and successful publication.
