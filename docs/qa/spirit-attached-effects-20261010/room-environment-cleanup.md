# RoomEnvironment instance-matrix cleanup

Fashion's first exact Worker stem-switch test traced buffers before studio
environment creation and found one omitted explicit deletion in the shared
helper. The retired, undressed 乙 renderer had 166 created / 165 explicitly
deleted buffers. Its disconnected context was lost, native `isBuffer` was false
and GL errors were zero, so this was not a live GPU allocation after context
termination. The normal shared resource owner still needed explicit cleanup.

[The original failures](room-environment-cleanup/previous-failure/README.md)
preserve both exact harnesses/reports and creation stack. The compiled callsite
is WebGLAttributes → WebGLObjects instanceMatrix → PMREM fromScene. Installed
Three r186 RoomEnvironment creates one InstancedMesh with six boxes, but its
dispose implementation only releases geometry and materials. The 96 floats /
384 bytes describe that source's instanceMatrix and were not captured as old
native bufferData arguments. Before-unmount native isBuffer was not captured in
the old failure. The older core harness hooked after environment creation and
did not count this allocation; its 17/17 UI result remains valid within that
recorded scope, rather than proof of complete environment-buffer accounting.

The shared helper now calls each RoomEnvironment InstancedMesh's dispose in the
existing finally block, after synchronous PMREM baking and before room geometry,
materials and PMREM cleanup. Returned reflection texture, lighting, original B
assets, material optics and all visible transforms stay unchanged. Independent
CPU probes using actual RoomEnvironment and stubbed PMREM verified successful
bake and bake-failure paths release the instance owner, shared geometry/materials
and generator once; the original bake error propagates. Review found no
Critical/Important issue. Root type/build/targeted lint passed.

New pre-environment native tracking, normal React switch/unmount and final exact
Worker checks are required before publication. Their result is recorded in the
final Worker evidence; the older pre-fix failures remain immutable evidence.

The final exact Worker passes **19/19** checks. [Measured native proof](room-environment-cleanup/native-final.json) captures the actual source-matching 96-float / 384-byte upload before PMREM, live→explicit-delete→not-live while valid, and normal 166/166 (乙), 148/148 (甲) plus restored145/145 (water),156/156 (jade), in both qualities. All pre-force-loss retirement boundaries have native live buffers/bytes zero. The final report and all44 PNGs are bound to Worker `a1b9ad766d2532d3fc351fd2fa01ebbf6efe9aad1822dd8f3aa864a26d594955`; no rendering-source change followed this check. Same-build Galaxy8 also passes.
