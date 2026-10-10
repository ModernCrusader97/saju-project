# Exact production Worker release validation

Final UI checks: **17/17 PASS**, zero failures, 44 SHA-verified PNGs.
The compiled Worker SHA-256 is
`bb96468fe99e2888ec2a01e18935673b60e37571d402b5997aee8ac3fad4082f`.
Exact harness SHA-256 is
`d134d54acc4931f0e89c46c93bfa382b225ca3d64b436d1b83bbe213adcf90b8`.
[Full report](report.json) binds production source hashes, served JavaScript,
actual original B GLB, original jade textures and every capture to the tested
build. [Exact executed harness](harness.mjs) matches the committed QA script.

The twelve UI cases are 甲/乙/丙/丁/戊/癸 in high desktop and low mobile quality.
They exercise real React controls: play/pause, dragging while paused, repeated
taps, bounded original wave, reset, resumed motion, 15/60 Hz matched motion time,
a long frame-gap cap, and return to idle. Actual native body uniforms, model
matrix, original position/normal/UV/index/morph hashes and depth 1.35 are checked;
effects share the motion root. Static shader branches may optimize away time,
so coordinate density and model matrix are the native body markers.

Both qualities exercise actual WebGL context loss/restoration, retap after
restore, renewed native effect data, return to idle and React unmount with no
later GPU work or native errors. Two additional 己 cases verify original jade
base-map/field atlas, animated uSajuSeconds and clean restored shader resources.
Jade's offscreen BackSide stays straight-alpha and final canvas output is
premultiplied. Fire and ShadowMaterial retain their original blend convention;
the complete high fire side native pixel and PNG are byte-identical to the
preserved original. Water's selected frame equals a fresh 72-frame all-native
trajectory, including zero changed body pixels, with correct native/PNG alpha.

The [same-build galaxy regression](galaxy-entry-report.json) passed **8/8**:
controlled 30/60/144 Hz entry clocks, continuous moving-orbit transition,
owner-specific presentation/masks across scenes and reload, defaults for an
unbound map, all ten existing galaxy effects and no page errors/outbound traffic.
These controlled clock cases are not measured physical-device frame rates.

Native/browser errors and external requests are zero. Every table count in the
UI test's disposable local D1 database is zero. Tests use compiled production
code, local synthetic state and Chromium SwiftShader; they do not use a real
user database or authenticate to the hosted owner-only page. Physical GPU/mobile
performance and the hosted signed-in visual session were not inspected.

The earlier standalone twenty stem/quality renders remain separate evidence
for all ten body materials. This exact final UI matrix does not claim twenty
UI stem/quality cases or latest authored-animal visual approval. Short vines,
sand flight without bounce/piling, dew without coalescence/detached dripping,
and no actual-character 壬 spray/foam remain the documented implementation scope.

No production source or asset changed after this tested build; final preservation
commits add only QA scripts/evidence/documentation. Publication is a subsequent
existing owner-only Site operation, whose result must be checked separately.
