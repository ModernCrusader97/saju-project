SaJu dragon V5 rejected mesh experiment — NOT an accepted model

The only candidate uses Blender Collapse at ratio 0.8 on the untextured `Dragon_Mane_Warm_Orange` runtime mesh, before armature deformation. The remaining nine runtime meshes, all eyes, body/face/limbs, ivory horns/whiskers, UVs, materials, 4096 texture, skin joint graph and six second Idle_Loop remain exact. The 111 editable high sculpt objects are preserved in the new failed Blender file. V4 and the original 222,646-triangle asset remain untouched.

Measured asset cost, not a performance benchmark:

| Metric | V4 original | Rejected V5 | Reduction |
| --- | ---: | ---: | ---: |
| Exported triangles | 222,646 | 205,706 | 16,940 / 7.61% |
| Exported vertices including UV/material seams | 116,175 | 107,705 | 8,470 / 7.29% |
| GLB bytes | 7,980,524 | 7,506,204 | 474,320 / 5.94% |

Acceptance FAILED. The conservative bidirectional distance gate was set to 0.004 model units before generation. The original-mane-to-candidate maximum is 0.0089267632 at frames 0 and 144 and exceeds 0.004 at all five evaluated poses. This is a local geometric change; its mean is much smaller. The threshold and 0.8 mesh settings have not been changed to obtain a PASS. No second shape variant or more aggressive reduction is produced.

The initial 0.5 degree planar-dissolve test was a memory-only measurement, not a second model candidate. It removed just 590 triangles, 0.27% of the complete asset. The failed 0.8 shape was reconstructed only to capture diagnostic files and fix an export-visibility mistake. That mistake hid the source armature's collection and produced a raw GLB without skin or animation. Its raw file and failure log are retained as a rejected capture intermediate. The corrected capture keeps the armature active and hides only high sculpt mesh objects. It does not alter the reduced geometry or the failed surface bound.

Actual Three GLTFLoader/AnimationMixer checks prove exact materials, PNG bytes, skin/joint hierarchy, inverse bind matrices and animation channels/keys against V4. All nine untouched meshes and ten primitives keep exact attribute/index values, and their world positions match at all 145 frames. The reduced mane has valid positions, normals and normalized weights, with no zero-area triangles. The first/last skin pose error is 0.0000006394, unchanged from the source float precision. Khronos Validator 2.0.0-dev.3.10 reports 0 errors and 0 warnings with the one existing unused-head-UV information entry.

The failed Blender file and its actual GLB import were reloaded and compared at frames 0, 36, 72, 108 and 144. Maximum native/import nearest-vertex error is 0.0000027001. Native normals/weights and loop closure pass the file-format diagnostics. These PASS results do not promote the rejected geometry.

`previews/` contains real V4/failed-V5 comparisons: left is the original V4, right is the rejected V5. Both use identical source cameras, lights, Cycles seed and settings. Front, threequarter and side are frame 0; additional quarter views cover idle frames 36, 72, 108 and 142. Alpha renders hide the floor to measure silhouettes. All seven pairs were inspected. No large eye, body-color-boundary, silhouette or joint regression was observed at the displayed scale, but the local surface distance criterion remains failed. These are actual renders, not generated design images. They are sampled idle poses, not a newly rendered smooth idle movie.

Application type/build checks were not rerun after rejection. There is no accepted asset or application integration to validate; no tracked application source changes are made. Earlier type/build evidence remains at its original commit. This packet claims loader/native/format diagnostics only, not app adoption, browser GPU validation, mobile-device performance or a mobile PASS. Further reductions or changed feature-protection/retopology policy require a separate scoped candidate.

Files named `FAILED_...` and this folder are experiment evidence only. The parent V4 commit `68f4801b5180a8c38b6073f3a8ae7f48a869caa9` remains the latest accepted export. No product default, other animal, PR, merge, deployment or permissions change is performed. Raw diagnostics and original sources are preserved privately, with no overwrite.
