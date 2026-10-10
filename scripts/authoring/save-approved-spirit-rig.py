"""Editable Blender source for the exact-BIN-derived skin GLB; no re-export of B.
Run: blender -b --python scripts/authoring/save-approved-spirit-rig.py -- ROOT
The Node authoring script regenerates the exact GLB; this imports its skin,
weights and clip for author review while retaining all original shape keys.
"""
import bpy, sys, json, hashlib
from pathlib import Path
root = Path(sys.argv[sys.argv.index('--')+1]).resolve()
package = root/'assets/source-reference/saju-b-rigged-greeting-v001'
glb = package/'SaJu_B_Rigged_Greeting_v001.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb), merge_vertices=False)
scene = bpy.context.scene
scene.render.fps = 60
scene.frame_start = 1
scene.frame_end = 235
scene['rig_provenance'] = 'New user-requested B-rig-v001 derivative; original approved GLB untouched; not missing a97c418 recovery.'
scene['exact_export'] = 'scripts/authoring/build-approved-spirit-rig.mjs preserves original glTF BIN/accessors; this editable .blend is an imported review source.'
armatures = [o for o in scene.objects if o.type == 'ARMATURE']
assert len(armatures) == 1
body = next(o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) == 33207)
for obj in scene.objects:
    animation = obj.animation_data
    if animation:
        animation.action = None
        for track in animation.nla_tracks:
            track.mute = 'Rigged_three_wave_greeting' not in track.name
    if obj.type == 'MESH' and obj.data.shape_keys:
        keys = obj.data.shape_keys
        if keys.animation_data:
            keys.animation_data.action = None
            for track in keys.animation_data.nla_tracks: track.mute = True
        for key in keys.key_blocks:
            if key.name != 'Basis': key.value = 0
for img in bpy.data.images:
    if img.type == 'IMAGE' and not img.packed_file:
        try: img.pack()
        except RuntimeError: pass
scene.frame_set(1)
bpy.context.view_layer.objects.active = armatures[0]
for obj in scene.objects: obj.select_set(obj == armatures[0])
armatures[0].show_in_front = True
blend = package/'SaJu_B_Rigged_Greeting_v001.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
report = {'sourceGLBSHA256': hashlib.sha256(glb.read_bytes()).hexdigest(), 'blendSHA256': hashlib.sha256(blend.read_bytes()).hexdigest(),
          'vertices':len(body.data.vertices), 'polygons':len(body.data.polygons), 'bones':[b.name for b in armatures[0].data.bones],
          'vertexGroups':[g.name for g in body.vertex_groups], 'shapeKeys':[k.name for k in body.data.shape_keys.key_blocks],
          'clips':[a.name for a in bpy.data.actions], 'packedImages':sum(bool(i.packed_file) for i in bpy.data.images),
          'limits':['Editable imported derivative; exact GLB reproduction uses the Node source-BIN appender, not a Blender mesh re-export.']}
(package/'rig-source-summary.json').write_text(json.dumps(report,indent=2)+'\n')
(package/'AUTHORING_SHA256SUMS.txt').write_text(hashlib.sha256(blend.read_bytes()).hexdigest()+'  '+blend.name+'\n')
print('EDITABLE_RIG_SOURCE', json.dumps(report))
