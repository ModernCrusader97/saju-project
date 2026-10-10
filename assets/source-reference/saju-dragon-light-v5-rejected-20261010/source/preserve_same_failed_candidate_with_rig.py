"""V5 one mild mesh-cost candidate. Collapse only untextured orange mane to 80%.
Preserves all other runtime meshes, original high sculpt, rig/action and studio.
"""
import bpy,math,sys,json,hashlib,argparse,runpy
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);ap.add_argument('--root-export-script',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.blend).resolve();out=Path(a.out).resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest()=='c18682ca0f32973b815abd0185c049c6ed9ce005eee6388a2549388bd66bc3bc'
assert not out.exists();out.mkdir(parents=True);(out/'qa').mkdir();(out/'intermediates').mkdir()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False);scene=bpy.context.scene;scene.frame_set(0);bpy.context.view_layer.update()
runtime=bpy.data.collections['Runtime_GLTF_Meshes'];runtime.hide_viewport=False;runtime.hide_render=False
objects=[o for o in runtime.objects if o.type=='MESH'];assert len(objects)==10
target=bpy.data.objects['Dragon_Mane_Warm_Orange'];assert target in objects and not target.data.uv_layers and not target.data.color_attributes
def digest(v):return hashlib.sha256(json.dumps(v,separators=(',',':'),sort_keys=True).encode()).hexdigest()
def mesh_record(ob):
 me=ob.data
 return {'positions':[list(v.co) for v in me.vertices],'polygons':[list(p.vertices) for p in me.polygons],
 'smooth_material':[[p.use_smooth,p.material_index] for p in me.polygons],
 'uv':{layer.name:[list(d.uv) for d in layer.data] for layer in me.uv_layers},
 'colors':{layer.name:[list(d.color) for d in layer.data] for layer in me.color_attributes},
 'weights':[[[g.group,g.weight] for g in v.groups] for v in me.vertices],
 'groups':[g.name for g in ob.vertex_groups],'world':[list(r) for r in ob.matrix_world],
 'materials':[m.name for m in me.materials]}
def stats(ob):
 ob.data.calc_loop_triangles();return {'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles)}
def pose_hash():
 rig=bpy.data.objects['Dragon_Rig'];data=[]
 for f in range(145):scene.frame_set(f);bpy.context.view_layer.update();data.append([[list(r) for r in b.matrix] for b in rig.pose.bones])
 scene.frame_set(0);bpy.context.view_layer.update();return digest(data)
before_stats={ob.name:stats(ob) for ob in objects}
preserved={ob.name:digest(mesh_record(ob)) for ob in objects if ob!=target}
high_source=[ob for c in ['Dragon_Approved_Candidate','Editable_Construction_Source'] for ob in bpy.data.collections[c].objects if ob.type=='MESH']
original_sculpt_hash={ob.name:digest(mesh_record(ob)) for ob in high_source}
animation_before=pose_hash();original=target.copy();original.data=target.data.copy();scene.collection.objects.link(original);original.name='QA_V3_Mane_Baseline_Only'
# Only one candidate is created; the flat-dissolve work was a memory-only cost probe.
bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
modifier=target.modifiers.new('V5_Mild_20_Percent_Mane_Reduction','DECIMATE');modifier.decimate_type='COLLAPSE';modifier.ratio=.8;modifier.use_collapse_triangulate=True
# Reduce rest geometry before armature deformation. Do not bake a posed mesh.
bpy.ops.object.modifier_move_up(modifier=modifier.name)
assert list(target.modifiers)[0]==modifier
bpy.ops.object.modifier_apply(modifier=modifier.name)
after_stats={ob.name:stats(ob) for ob in objects};assert after_stats[target.name]['triangles']<before_stats[target.name]['triangles']
for ob in objects:
 if ob!=target:assert digest(mesh_record(ob))==preserved[ob.name],('Untouched mesh changed',ob.name)
for ob in high_source:assert digest(mesh_record(ob))==original_sculpt_hash[ob.name],('Original sculpt changed',ob.name)
assert pose_hash()==animation_before,'Bone/action result changed'
bad_weights=0
for v in target.data.vertices:
 if abs(sum(g.weight for g in v.groups)-1)>.00015:bad_weights+=1
assert bad_weights==0
# Compare deformed surface distances at the five important loop poses, both ways.
def cloud(ob,frame):
 scene.frame_set(frame);bpy.context.view_layer.update();ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();me.calc_loop_triangles()
 vertices=[ev.matrix_world@v.co for v in me.vertices];tris=[tuple(p.vertices) for p in me.loop_triangles];ev.to_mesh_clear();return vertices,tris
surface_errors={}
for frame in [0,36,72,108,144]:
 old,old_tri=cloud(original,frame);new,new_tri=cloud(target,frame);oldtree=BVHTree.FromPolygons(old,old_tri,all_triangles=True);newtree=BVHTree.FromPolygons(new,new_tri,all_triangles=True)
 forward=[oldtree.find_nearest(p)[3] for p in new];reverse=[newtree.find_nearest(p)[3] for p in old]
 surface_errors[str(frame)]={'candidate_to_original_max':max(forward),'original_to_candidate_max':max(reverse),'candidate_to_original_mean':sum(forward)/len(forward),'original_to_candidate_mean':sum(reverse)/len(reverse)}
surface_max=max(max(v['candidate_to_original_max'],v['original_to_candidate_max']) for v in surface_errors.values())
surface_pass=surface_max<.004
(out/'qa/surface-bound-failure-metrics.json').write_text(json.dumps({'status':'PASS' if surface_pass else 'FAIL_CONSERVATIVE_SURFACE_BOUND','threshold':.004,'measured_max':surface_max,'by_frame':surface_errors,'same_single_ratio_candidate':.8},indent=2)+'\n',encoding='utf8')
bpy.data.objects.remove(original,do_unlink=True)
scene.frame_set(0);bpy.context.view_layer.update();rig=bpy.data.objects['Dragon_Rig']
# All high sculpt objects remain editable and hidden. The active runtime collection is the low mesh candidate.
bpy.data.collections['Dragon_Approved_Candidate'].hide_render=False;bpy.data.collections['Dragon_Approved_Candidate'].hide_viewport=False
for ob in bpy.data.collections['Dragon_Approved_Candidate'].objects:
 if ob.type=='MESH':ob.hide_render=True;ob.hide_set(True)
runtime.hide_render=False;runtime.hide_viewport=False
bpy.ops.object.select_all(action='DESELECT')
for ob in objects+[rig]:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
raw=out/'intermediates/V5_pre_root_cleanup.glb'
options=dict(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
properties=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in options.items() if k in properties})
arguments=sys.argv[:];sys.argv=['root_skin_export.py','--input',str(raw),'--output',str(out/'FAILED_SaJu_Dragon_Light_Candidate_v5.glb'),'--report',str(out/'qa/export-root-cleanup.json'),'--expected-input-sha256',hashlib.sha256(raw.read_bytes()).hexdigest()]
runpy.run_path(a.root_export_script,run_name='__main__');sys.argv=arguments
text=bpy.data.texts.new('build_light_candidate_v5.py');text.write(Path(__file__).read_text(encoding='utf8'))
scene.camera=bpy.data.objects['Camera_ThreeQuarter'];scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'FAILED_SaJu_Dragon_Light_Candidate_v5.blend'),compress=True)
final=out/'FAILED_SaJu_Dragon_Light_Candidate_v5.glb'
report={'status':'PRESERVED_FAILED_SINGLE_CANDIDATE_NOT_DELIVERABLE' if not surface_pass else 'PENDING_VISUAL_QA','source_blend_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'candidate_blend_sha256':hashlib.sha256((out/'FAILED_SaJu_Dragon_Light_Candidate_v5.blend').read_bytes()).hexdigest(),'candidate_glb_sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'method':'COLLAPSE 0.8, only untextured Dragon_Mane_Warm_Orange, before armature. No UV changes or new design.','optimized_objects':[target.name],'before':before_stats,'after':after_stats,'runtime_triangles_before':sum(v['triangles'] for v in before_stats.values()),'runtime_triangles_after':sum(v['triangles'] for v in after_stats.values()),'all_other_9_runtime_meshes_exact':True,'original_editable_sculpt_unchanged':True,'original_sculpt_mesh_objects_preserved':len(high_source),'all_145_bone_poses_exact':True,'pose_sha256':animation_before,'materials_uv_texture_eye_face_body_limbs_unchanged':True,'bad_weights':bad_weights,'mane_surface_distances_by_frame':surface_errors,'original_high_sculpt_hidden_not_deleted':True,'native_active_collection':'Runtime_GLTF_Meshes'}
(out/'qa/generation-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('V5_CANDIDATE_GENERATED',json.dumps(report),flush=True)

if not surface_pass:
 print('FAILED_CANDIDATE_PRESERVED_NOT_DELIVERABLE',surface_max,flush=True)
 raise SystemExit(3)
