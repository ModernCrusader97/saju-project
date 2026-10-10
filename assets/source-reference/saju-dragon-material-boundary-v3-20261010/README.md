# SaJu dragon V3 material boundary candidate

This candidate repairs only the teal/ivory paint boundary on the approved V2 dragon. It is a new source-reference asset, with no product-default replacement or application change. The preserved V2 source is commit `489ca9e6631e82da5f3741d53fa1f7f9c49e0112` on its existing art branch.

The V2 body had one POINT/FLOAT_COLOR `BodyTint` attribute and one material, with no UV or texture. Its radial/limb attenuation, adjacency smoothing and triangle interpolation created a broad fuzzy border and uneven paw-root contours. The diagnosis reads the actual saved Blender and GLB data.

V3 adds a 4096x4096 embedded PBR base-color PNG to the body. It evaluates a continuous rest-position paint contour and rounded paw color exclusions, with a narrow antialias transition. The head retains the original vertex-color interpolation. Original `BodyTint` values remain unchanged and the protected facial corner colors match V2 exactly. Body and head PBR parameters, all unrelated material parameters, eyes, face geometry, limbs, mane, rig and animation are preserved.

`SaJu_Dragon_Approved_Candidate_v3.blend` is editable and packs the texture, exact approved concept PNG and repair script. `SaJu_Dragon_Approved_Candidate_v3.glb` is self-contained and includes the unchanged six-second `Idle_Loop`. `textures/Dragon_V3_Body_BaseColor.png` is the exact packed/exported body image.

`baseline/SourceV2.blend` is the byte-identical preserved V2 source, included only as a regeneration input. It is clearly labeled as V2. The repair script refuses any other source SHA-256 and any existing output directory.

Run from this folder with installed Blender 5.2.1 LTS:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python source/repair_material_boundary.py -- --blend baseline/SourceV2.blend --out D:/Codex/Results/SaJuDragonMaterialBoundaryV3-NewRun --stills
```

The repair uses Blender's bundled Python/NumPy; no additional installation is required. Every render is actual Blender geometry. `comparisons/V2-left_V3-right_*.png` places the untouched V2 render on the left and V3 on the right. Camera, frame, lights, render samples and color management match. Exact camera matrices and model/render byte hashes are in `qa/render-provenance.json` and comparison provenance.

Verification passed for the saved source reload and packed bytes, all 121 source mesh-object positions/topology/normals/weights/transforms, 145-frame rig pose preservation, facial corner colors and unrelated PBR inputs, official Blender GLB roundtrip, actual Three GLTFLoader/AnimationMixer CPU checks, real embedded PNG decode and original sRGB palette, exact V2 animation channels/keys and inverse-bind matrices. The source reference PNG is 1,651,398 bytes, 1254x1254, SHA-256 `6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58`.

The geometry still has 222,646 triangles and 13 bones. UV seams/material grouping produce 116,175 exported vertices and 11 skinned primitives in 10 GLB mesh nodes. GLB size is 7,980,524 bytes. These counts are delivery facts, not mobile optimization or mobile GPU performance claims. Application code is unchanged; this scoped task reruns asset/material/source checks. The previously completed V2 application type/build checks remain with V2.

Khronos validation has zero errors, the same 10 `NODE_SKINNED_MESH_NON_ROOT` hierarchy warnings, and one informational unused head `TEXCOORD_0`. Mobile optimization and hierarchy cleanup remain separate items. No new video was rendered for this material-only task; the V2 video is preserved, while the GLB's original animation data and runtime samples were checked directly.

New private Drive still/comparison locations are in `qa/private-preview-files.json`. Existing Drive files and permissions are preserved. No PR, merge, deployment, main/WIP/other-animal change, authentication or payment change is part of this candidate.
