# SaJu dragon V6: unused head UV cleanup

V6 is an isolated candidate derived from accepted V4 commit 68f4801b5180a8c38b6073f3a8ae7f48a869caa9. It removes only /meshes/3/primitives/0/attributes/TEXCOORD_0, its exclusive accessor/bufferView 18 and the 87,672 unused binary bytes. The material Continuous_Head_V2_Preserved_PBR and its clearcoat/specular/ior extensions have no texture or texCoord references. The textured body primitive retains its used UVs and the V3 color boundary.

The delivered GLB is 7,892,704 bytes: 87,820 bytes (1.1004289944%) smaller than V4. Its SHA-256 is 855d72c9b1f6ed7cd90ce1322021c8e6af8bfc46ea2abd323a3eca2d92999688. Geometry remains 222,646 triangles / 116,175 exported vertices, with the same 13-bone rig and 6-second Idle_Loop. All 98 surviving bufferViews have identical bytes. Index/offset remapping reconstructs exactly the original semantic JSON.

Actual GLTFLoader/AnimationMixer comparisons cover 145 frames and 16,845,375 world vertices: maximum vertex, joint, mesh and inverse-bind matrix errors are zero. Khronos has 0 errors, 0 warnings, 0 infos and 0 hints. Official Blender reload/import agrees with the unchanged source within 0.000002700032 model units. Its new 900px three-quarter render is pixel-identical to the existing V4 reimport render. PNG containers differ only in metadata/compression; decoded RGBA SHA-256 is 704665adf008c7ddc08c6093ba938062a5db5069ae5a84fd4d5a54bf77c7f503.

Editable source remains ../saju-dragon-material-boundary-v3-20261010/SaJu_Dragon_Approved_Candidate_v3.blend, SHA-256 c18682ca0f32973b815abd0185c049c6ed9ce005eee6388a2549388bd66bc3bc. The original native shared UV layer stays intact for body texture editing. The backup ZIP includes exact SourceV3.blend and SourceV4.glb under baseline; the parent Git tree preserves the complete earlier authoring and render sources. V6 makes no model simplification and does not rerun or accept the rejected V5 experiment.

Reproduce from the exact accepted V4 file to a NEW output path:

~~~powershell
python source/remove_unused_head_uv.py --input ../saju-dragon-root-skin-export-v4-20261010/SaJu_Dragon_Approved_Candidate_v4.glb --output NEW-v6.glb --report NEW-report.json
~~~

The script refuses unexpected input bytes, reused output paths, material texture references, unknown extensions, shared accessors/views and overlapping bytes. Reproduction produces the exact delivered SHA above. Verification entry points are in qa-tools; they require the existing Blender / Three / Khronos runtimes and new output paths. Raw QA reports and process logs are preserved under qa. The inherited pixel comparator note names V3 native source; its actual baseline is the V4 reimport image shown by before_name and hashes.

This branch adds only this candidate folder. Main, prior branches, existing WIP, other eleven animals and product defaults remain preserved. No PR, merge, deployment, sharing change or mobile-performance claim is part of this change.
