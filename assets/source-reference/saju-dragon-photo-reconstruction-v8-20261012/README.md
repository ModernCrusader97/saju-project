V8 dragon reconstruction candidate

A new continuous sculpt, fresh rig and six-second floating/head/tail/paw idle made from the actual approved 2D pixels on Joseph. No earlier dragon mesh or armature was imported. This is an additional private candidate; the product default and the other animals are unchanged.

The original photo is in reference/ and packed in the editable Blender file. Its SHA256 is 6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58. Individual sculpted parts, curved closed flame mane leaves, hidden construction seeds, continuous COLOR_0 body paint and the new 13-bone rig remain editable. The GLB has 161454 triangles, no external resources, and Idle_Loop (6 seconds, 24 fps sampled export).

Open model/SaJu_Dragon_Photo_Reconstruction_V8.blend in Blender. View previews/ for actual GLB reimport renders, original-pixel comparisons and the real 6-second MP4. All previews were rendered from geometry; no generated illustration is presented as a model render.

Regeneration: from this package directory, run the installed Blender Python with source/regenerate_v8.py --out ABSOLUTE_NEW_OUTPUT_DIRECTORY. The default reference resolves this package's original image. Use --blender to select another existing Blender executable and --stills for static previews. The wrapper verifies literal source/image bytes and refuses an existing output folder. A full new reconstruction and export were actually executed. Raw GLB hashes can differ because triangle index/corner order varies; all positions, normals, colors, skin and animation accessors and oriented triangle multisets were exact.

QA: see QA-summary.json and qa/. Khronos: 0 errors, 0 warnings, 0 infos. Actual Three.js loading/animation, native loop closure, unchanged deformation guards, exact packed image/source bytes, Blender GLB roundtrip, actual renders and five independent decoded video poses passed. Related product types passed; the identical installed Vinext build CLI passed in a new source snapshot. The initial npm wrapper attempt failed because it expected a local node_modules directory, and its log is preserved. Product source was not modified.

Appearance review: cheeks remain smaller, mane layers more regular, eye/muzzle placement approximate, and the teal/ivory lip transition less clean than the approved illustration. Original 2D camera/projection is unknown. Technical checks are not photo similarity or final user appearance approval. GPU/mobile performance was not measured. This is one art candidate; intermediate shape iterations are not site improvement quota.

Verified owner-only previews: actual idle https://drive.google.com/file/d/1K9WoNSTBJkSpFwwDuPHG26j7ACu7RD-k/view?usp=drivesdk ; original vs actual GLB https://drive.google.com/file/d/1tOHtkxziZUNDULxZVJK0XvXyj6By1N7T/view?usp=drivesdk .
