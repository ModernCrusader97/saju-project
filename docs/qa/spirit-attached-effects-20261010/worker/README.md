# Exact production Worker release validation

Final UI checks: **19/19 PASS**, zero failures, 44 SHA-verified PNGs.
The compiled Worker SHA-256 is
`a1b9ad766d2532d3fc351fd2fa01ebbf6efe9aad1822dd8f3aa864a26d594955`.
Exact harness SHA-256 is
`c5b3005deef3a6df9bc675d058a40d2ee50dd67b7e2e9639d0a4daf7bb6895a2`.
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

Two added high/low checks install native tracking before PMREM environment
creation and exercise normal React stem-switch and a separate UI unmount.
The actual Room upload is 96 floats / 384 bytes with SHA-256
`54251af5a0b540b22c2dd4052cb686bef4375b7877b00c33610dfa84fd9fb409`,
matching the installed source matrix. Native liveness is true after upload and
immediately before one explicit deletion, then false after it while the context
is valid. Default 乙 deletes 166/166 buffers and 甲 unmount deletes 148/148 in
each quality, with zero live buffers/bytes at the boundary before forced loss.
Restored water deletes 145/145 and jade 156/156 in the current generation.
[Earlier final17 evidence](../worker-pre-room-cleanup/README.md) is retained
separately and does not claim pre-environment accounting.

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
