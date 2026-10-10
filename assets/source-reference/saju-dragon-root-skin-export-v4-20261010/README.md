SaJu approved dragon V4 — GLB hierarchy only

V3's ten `NODE_SKINNED_MESH_NON_ROOT` warnings came from identity skinned mesh nodes 13–22 being children of identity, unanimated `Dragon_Rig` node 23. There was no observed V3 visual failure. The warning flags the potentially misleading expectation that ordinary mesh parenting controls a skinned mesh. The official skinning rule uses joint transforms and ignores the skinned mesh node transform.

V4 moves those ten mesh nodes to the scene root list. `Dragon_Rig` keeps joint root 12. Only `nodes[23].children` and `scenes[0].nodes` change. Every other JSON property and all 7,951,976 BIN bytes remain identical. This removes the ambiguous export structure without changing the actual skinning output. No native mesh, rig, material, color, animation, or product model is edited.

The same unmodified Khronos Validator 2.0.0-dev.3.10 reports 0 errors, 0 warnings and 1 unchanged `UNUSED_OBJECT` information entry for the head primitive's unused TEXCOORD_0. No warning filter or validation override is used. The information entry is retained; removing that UV would exceed this hierarchy task.

Actual Three GLTFLoader and AnimationMixer comparison covers all 116,175 vertices at 145 frames over the six second Idle_Loop: 16,845,375 world position comparisons, maximum V3/V4 difference 0. Joint, mesh and inverse bind matrices also match exactly. The first/last pose error is below 0.000001; the existing float precision of the source loop is unchanged. Loading both assets inside a translated, rotated and scaled scene group also yields zero difference. Geometry attributes, indices, materials, PNG pixels, animation channels and keys are unchanged.

Official Blender glTF import checks the five sampled native poses, normals, weights, loop and joint distortion against the unchanged V3 source. An actual reimport render is compared with the preserved V3 reimport render under the same source studio and helper. See the QA JSON files for measured outcomes and the two real model preview PNGs.

The editable Blender source remains V3, SHA256 `c18682ca0f32973b815abd0185c049c6ed9ce005eee6388a2549388bd66bc3bc`, in the preceding committed asset folder `../saju-dragon-material-boundary-v3-20261010/`. The private delivery ZIP also carries that exact source and exact input GLB under `baseline/`. The native file has no V4 geometry changes to save.

To reproduce the final GLB from the preserved export, use a new output path:

```powershell
python source/root_skin_export.py --input baseline/SourceV3.glb --output ReproducedV4.glb --report ReproductionReport.json
```

The script requires the accepted V3 input hash, identity/static mesh and parent nodes, a single scene and exactly ten moved nodes. It refuses existing output paths. Changed future exports require an explicitly inspected input hash and must satisfy the same conservative structure checks.

Khronos warning list: https://raw.githubusercontent.com/KhronosGroup/glTF-Validator/main/ISSUES.md
Khronos skin hierarchy rule: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#joint-hierarchy

The new branch adds this export candidate and its evidence only. V3 commit `44a9b0ab5bfe7cb6bc19398797ca6c1d0e2aa803`, all preexisting branches, WIP, other animals and application defaults are preserved. No PR, merge, deployment or sharing change is part of this work. The 222,646 triangles and 4096 texture are unchanged; browser GPU and mobile performance are outside these checks. The existing V2 actual idle video is still an earlier render, not a newly rendered V4 movie.
