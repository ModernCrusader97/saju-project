# Transparent-canvas transmission output

Actual compiled Worker UI exposed a flat white 癸 body on the page. This was
reproduced with every prior animation frame rendered natively: selected-frame
and fresh 72-frame trajectories were pixel-identical. The old body center was
native RGBA `[195,204,203,143]`, but canvas PNG `[255,255,255,143]`. Its context
expected premultiplied RGB while the non-blended transmission material output
straight RGB. Geometry, original UVs, depth 1.35 and material optics were intact.

The [original probe](alpha-compositing/premultiplied-white-ui-and-jade-recovery/)
preserves its exact Worker/harness hashes, report and 14 captures. Its status is
PROBE, 7/7 checks, including high/low context recovery and jade atlas recovery;
that lifecycle success did not constitute visual approval of the white output.

A whole-context straight-alpha experiment made the water PNG agree with native
RGBA, but also changed its native RGB to `[224,229,228,143]`. It affected the
refraction-target clear convention, and would apply canvas alpha a second time
to the normal-blended fire and ground. The
[experiment](alpha-compositing/straight-alpha-water-and-jade-recovery/) retains
its exact PROBE result and 14 captures. It is not the final runtime setting.

The reviewed implementation retains the original premultiplied canvas context.
Only existing MeshPhysicalMaterials with transmission greater than zero receive
a chained `onBeforeRender` callback: canvas output enables the supported
`premultipliedAlpha` flag, offscreen output disables it, and only changes mark the
material for update. The previous callback retains its receiver and arguments.
This keeps DoubleSide jade's offscreen refraction RGB and existing fire/ground
blending, and corrects final transmission output without changing shader text,
lighting, roughness, transmission, textures, model data or authored depth.

Independent review resolved the Important whole-context blending issue and
found no further Critical/Important issue. Its CPU callback probe checked both
targets, repeat draws, prior callback and program-key handling. Root type/build
and targeted lint passed; the sole lint warning is the existing img warning.
The [compatible focused probe](alpha-compositing/compatible-alpha-fire-water-jade-recovery/)
passed 9/9 checks on Worker
`bb96468fe99e2888ec2a01e18935673b60e37571d402b5997aee8ac3fad4082f`
with exact harness
`d134d54acc4931f0e89c46c93bfa382b225ca3d64b436d1b83bbe213adcf90b8`.
Its 20 PNGs include actual desktop/mobile UI and jade recovery. Water native
center is premultiplied `[109,114,113,143]`, canvas PNG `[194,203,202,143]`;
selected and fresh 72-frame all-native trajectories match with zero changed
pixels. High fire's entire native pixel hash and PNG are byte-identical to the
[retained original reference](alpha-compositing/original-premultiplied-fire-reference/),
including partial-alpha orange fire and ground pixels. Low fire/ground retain
the same blend conventions. Both jade qualities record offscreen BackSide
premultiplication false and final canvas true, original base-map/fields and
animated uSajuSeconds after restore. Both qualities restore, retap, return to
idle and unmount with zero native errors. Browser errors and outbound requests
are zero. Root directly inspected the corrected desktop UI and fire image.

The complete UI release matrix is separate final Worker evidence. These PROBE
units do not alone constitute the full release gate.

Pinned Three r186 uses material flags in blend/program selection and calls the
material callback before drawing: [renderer source](https://github.com/mrdoob/three.js/blob/r186/src/renderers/WebGLRenderer.js),
[blending source](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLState.js).
The existing Canvas uses the default UnsignedByte output; r186's separate
WebGLOutput compositor is not active in this path.
