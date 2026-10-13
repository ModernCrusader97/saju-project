"""Transfer the validated local lid repair to the already generated rig, without rebinding.
Require affected vertices to be fully rigid Head-weighted; freeze weights and animation.
Re-export to new files and verify the actual native/GLB in subsequent read-only QA.
"""
import argparse,bpy,hashlib,json,sys,numpy as np
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--before-static',required=True);ap.add_argument('--final-static',required=True);ap.add_argument('--rigged',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True)
def coords(o):
 q=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',q);return q.reshape(-1,3)
bpy.ops.wm.open_mainfile(filepath=a.before_static,load_ui=False);before=coords(bpy.data.objects['Dragon_Continuous_Skin']).copy()
bpy.ops.wm.open_mainfile(filepath=a.final_static,load_ui=False);final=coords(bpy.data.objects['Dragon_Continuous_Skin']).copy();assert before.shape==final.shape;ids=np.flatnonzero(np.linalg.norm(final-before,axis=1)>1e-8);assert len(ids)<200
bpy.ops.wm.open_mainfile(filepath=a.rigged,load_ui=False);scene=bpy.context.scene;scene.frame_set(0);bpy.context.view_layer.update();skin=bpy.data.objects['Dragon_Continuous_Skin'];runtime=bpy.data.objects['Dragon_V8_V8_Continuous_Teal_Ivory_Color'];rig=bpy.data.objects['Dragon_V8_Rig']
assert np.max(np.abs(coords(skin)-before))<1e-6 and np.max(np.abs(coords(runtime)-before))<1e-6
head=skin.vertex_groups['Head'].index
for i in ids:
 weights=skin.data.vertices[int(i)].groups;assert sum(g.weight for g in weights if g.group==head)>1-1e-6,'Repair requires rigid Head support'
def weight_hash(o):
 h=hashlib.sha256()
 for v in o.data.vertices:
  h.update(np.array([(g.group,g.weight) for g in v.groups],dtype=np.float64).tobytes())
 return h.hexdigest()
weights_before=weight_hash(skin)
for o in [skin,runtime]:
 o.data.vertices.foreach_set('co',final.reshape(-1));o.data.update()
assert weight_hash(skin)==weights_before
scene.frame_set(0);bpy.context.view_layer.update();text=bpy.data.texts.new('CLOUD_FINAL_RIGGED_LID_REPAIR');text.write(Path(__file__).read_text());bpy.ops.object.select_all(action='DESELECT');runtime_collection=bpy.data.collections['V8_Runtime_GLTF_Meshes']
for o in list(runtime_collection.objects)+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=out/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Final_Idle.glb';opts=dict(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='MATERIAL',export_all_vertex_colors=False);props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in opts.items() if k in props});runtime_collection.hide_render=True;runtime_collection.hide_viewport=True;scene.frame_set(0)
native=out/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Final_Idle.blend';bpy.ops.wm.save_as_mainfile(filepath=str(native),compress=True)
source_report=Path(a.rigged).parent/'generation-report.json';report=json.loads(source_report.read_text());report.update(status='FINAL_LOCAL_LID_GEOMETRY_TRANSFERRED_TO_RIG_QA_PENDING',static_source=a.final_static,static_source_sha256=hashlib.sha256(Path(a.final_static).read_bytes()).hexdigest(),weight_generation_static_source=a.before_static,affected_lid_vertices=int(len(ids)),affected_vertices_rigid_Head_weighted=True,skin_weights_exactly_frozen=True,weights_sha256=weights_before,native_sha256=hashlib.sha256(native.read_bytes()).hexdigest(),glb_sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),exact_original_V26_claim=False,animation_or_camera_parameters_changed=False)
(out/'generation-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
