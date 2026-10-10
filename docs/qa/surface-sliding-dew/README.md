# 癸 surface condensation and sliding candidate

Historical condensation-only baseline report, preserved unchanged below. The
new merge/release extension and its fresh validation are recorded in
[the coalescence report](../surface-dew-coalescence-20261010/README.md).

The new `createSurfaceSlidingDew(options)` implementation adds clear beads to the
actual approved B body. Each fixed source condenses, grows, travels down a connected
triangle path, shrinks, disappears, and regrows. It does not change the original
body geometry, eye assets, UVs, morph data, or body material.

The paths are generated from the source topology by `SurfaceTriangleWalker`.
Movement uses triangle barycentric coordinates with arc-length progress; there is
no sphere projection, nearest-part jump, or texture-scroll substitute. The route
direction is gravity in the creation-time rest frame. Rotating or idling the model
keeps the route attached; it does not recompute world-gravity downhill flow.

Every update resolves the current triangle position and its geometric normal.
With `allowMorphTargets: true`, this uses the actual posed vertices, including the
preserved `Gentle_wave_pose`. Without explicit opt-in, active morphs are rejected.
The bead axis follows the world normal even under nested nonuniform scaling. The
center offset includes the ellipsoid's support in the actual face plane, so the
bead is outside that face instead of partly buried inside it. The last path point
is approached at progress 0.9995 to avoid a shared-edge normal ambiguity during
evaporation.

Local accessory exclusion regions hide only beads whose current surface contact
is inside the region. Sources, seeds, path positions and lifecycle phases stay
unchanged. Removing the region restores the original matrices at the same time.

| Quality | Maximum beads | Triangles per bead | Maximum bead triangles |
| --- | ---: | ---: | ---: |
| Low | 48 | 80 | 3,840 |
| High | 80 | 168 | 13,440 |

There is one instanced object and one locally owned physical transmission
material. Rendering pass count depends on Three's transmission and scene passes.
Beads do not cast opaque shadow geometry; the loader must preserve the
`surfaceNonShadowCaster` marker. Geometry, material and the instance buffer owner
are disposed once; source mesh resources are not disposed by this module.

The module intentionally omits bead coalescence and detached falling water drops.
It implements evaporation and repeat. It does not simulate collisions against
other body parts, extreme accessory shapes, or arbitrary deformed topology. The
CPU face-clearance check establishes clearance of the current contacted face,
not collision freedom against every nearby limb. Rest-frame face masking keeps
the existing gaze, brows and mouth clear. Final integrated WebGL views must still
check oblique angles, gestures and visible intersections.

## Reproduction and evidence

Run from the repository root:

```sh
node --test scripts/qa/surface-sliding-dew.mjs
npx eslint lib/planet/surface-sliding-dew.ts scripts/qa/surface-sliding-dew.mjs
```

The first run before the new module existed selected the old 癸 implementation
and failed the real downward-travel assertion: expected more than 0.07 source
units, observed exactly 0. The final recorded CPU run passes all 11 tests. Only
glTF image decoding is replaced for Node; model bytes, triangles, matrices,
materials, morph vertices, lifecycle and disposal are real.

Source: `assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb`
(4,293,332 bytes), SHA-256
`0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84`.
Presentation depth remains 1.35.

The saved [CPU report](./cpu-report.json) records:

- 125 real B ray contacts, 54 observed triangle changes and 0.26121 maximum
  recorded contact travel; minimum checked face clearance is +0.00019328.
- World-normal dot is effectively 1.0 on the approved body and on the nested
  nonuniform transform fixture.
- At source morph weight 0.65, two sampled arm beads move more than 0.03, with
  maximum displacement 0.104096. Independent reconstruction from the original
  triangle's barycentric coordinates differs by at most 1.143e-7.
- A local mask hides one bead and leaves 79 matrices untouched; removing the mask
  restores every matrix exactly at the same absolute time.
- Absolute-time reverse seek, negative time and reset reproduce identical
  matrices. The checked bead visibly disappears and regrows three times in
  42 seconds.
- Both quality levels complete 480 updates over 16 seconds with maximum
  consecutive visible movement 0.004502. The report includes construction and
  update CPU timings from this host; these are not a mobile GPU or hosted FPS
  promise.
- Original POSITION, NORMAL, UV and index hashes remain unchanged. Owned
  instance/geometry/material disposal events each occur exactly once, including
  repeated disposal and updates after release.

This subtask's own ESLint check is clean. Integrated type/build checks, actual
WebGL front/side/gesture captures, physical GPU measurements, final Worker checks
and deployment are owned by the parent integration task; this report does not
claim those checks were executed here. No external assets, credentials or real
user database data were used.
