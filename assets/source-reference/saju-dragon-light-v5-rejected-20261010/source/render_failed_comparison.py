"""Actual GLB V4/failed single V5 comparison; never promotes failed geometry to PASS."""
import bpy,sys,json,hashlib,argparse,math
from pathlib import Path
from mathutils.kdtree import KDTree
ap=argparse.ArgumentParser();ap.add_argument('--source-blend',required=True);ap.add_argument('--candidate-blend',required=True);ap.add_argument('--baseline-glb',required=True);ap.add_argument('--candidate-glb',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();assert not out.exists();out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=a.candidate_blend,load_ui=False);scene=bpy.context.scene;scene.frame_set(0);bpy.context.view_layer.update()
runtime=bpy.data.collections['Runtime_GLTF_Meshes'];runtime.hide_viewport=False;native=[ob for ob in runtime.objects if ob.type=='MESH']
def points(parts,frame):
 scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();result=[]
 for ob in parts:
  ev=ob.evaluated_get(dg);me=ev.to_mesh();result += [ev.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
 return result
frames=[0,36,72,108,144];native_cloud={f:points(native,f) for f in frames};native_loop=max((p-q).length for p,q in zip(native_cloud[0],native_cloud[144]));assert native_loop<.00002
badnormals=sum(not all(math.isfinite(v) for v in vertex.normal) or vertex.normal.length<.5 for ob in native for vertex in ob.data.vertices)
badweights=sum(abs(sum(g.weight for g in v.groups)-1)>.00015 for ob in native for v in ob.data.vertices);assert badnormals==0 and badweights==0
# Replace runtime display with actual exported mesh import; original source is not saved.
runtime.hide_render=True;runtime.hide_viewport=True
def import_model(file,label):
 scene.frame_set(0);old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=file);created=[ob for ob in bpy.data.objects if ob not in old]
 controls={b.custom_shape for ob in created if ob.type=='ARMATURE' for b in ob.pose.bones if b.custom_shape}
 collection=bpy.data.collections.new(label);scene.collection.children.link(collection)
 for ob in created:
  collection.objects.link(ob)
  for c in list(ob.users_collection):
   if c!=collection:c.objects.unlink(ob)
 for ob in controls:ob.hide_render=True
 meshes=[ob for ob in created if ob.type=='MESH' and ob not in controls];assert len(meshes)==10
 collection.hide_render=True
 return collection,meshes
candidate,parts=import_model(a.candidate_glb,'QA_FAILED_SINGLE_V5_GLTF')
errors={}
for f in frames:
 kd=KDTree(len(native_cloud[f]))
 for i,p in enumerate(native_cloud[f]):kd.insert(p,i)
 kd.balance();cloud=points(parts,f);errors[str(f)]=max(kd.find(p)[2] for p in cloud)
assert max(errors.values())<.0005
baseline,old_parts=import_model(a.baseline_glb,'QA_BASELINE_V4_GLTF')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.seed=0
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.film_transparent=True;bpy.data.objects['Preview_Floor'].hide_render=True
camera_names={'front':'Camera_Front','threequarter':'Camera_ThreeQuarter','side':'Camera_Side'}
render_records=[]
for label,collection in [('V4-baseline',baseline),('FAILED-V5',candidate)]:
 baseline.hide_render=True;candidate.hide_render=True;collection.hide_render=False
 folder=out/label;folder.mkdir()
 for name,camera in camera_names.items():
  scene.camera=bpy.data.objects[camera];scene.frame_set(0);scene.cycles.samples=24;scene.render.resolution_x=640;scene.render.resolution_y=640
  file=folder/(name+'-frame000.png');scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
  render_records.append({'label':label,'camera':camera,'frame':0,'file':file.relative_to(out).as_posix(),'width':640,'height':640,'samples':24,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()});print('ACTUAL_COMPARISON_RENDER',label,name,0,flush=True)
 for frame in [36,72,108,142]:
  scene.camera=bpy.data.objects['Camera_ThreeQuarter'];scene.frame_set(frame);scene.cycles.samples=8;scene.render.resolution_x=512;scene.render.resolution_y=512
  file=folder/('idle-frame%03d.png'%frame);scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
  render_records.append({'label':label,'camera':'Camera_ThreeQuarter','frame':frame,'file':file.relative_to(out).as_posix(),'width':512,'height':512,'samples':8,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()});print('ACTUAL_COMPARISON_RENDER',label,'idle',frame,flush=True)
report={'status':'PASS_FORMAT_RELOAD_ONLY_GEOMETRY_CANDIDATE_STILL_FAILED','candidate_geometry_accepted':False,'candidate_native_sha256':hashlib.sha256(Path(a.candidate_blend).read_bytes()).hexdigest(),'candidate_glb_sha256':hashlib.sha256(Path(a.candidate_glb).read_bytes()).hexdigest(),'baseline_glb_sha256':hashlib.sha256(Path(a.baseline_glb).read_bytes()).hexdigest(),'native_loop_error':native_loop,'invalid_normals':badnormals,'invalid_weights':badweights,'glb_native_max_nearest_vertex_error_by_frame':errors,'actual_glb_import_meshes':10,'sampled_loop_frames':frames,'render_records':render_records,'same_source_cameras_lights_film_seed_for_both':True,'transparent_background_and_floor_hidden_for_silhouette_comparison':True,'source_blend_or_existing_outputs_overwritten':False,'limits':['Five idle poses and three same-camera real GLB views; not a new smooth full idle video.','Native/export reload and format checks do not override the failed .004 surface-deviation gate.']}
(out/'native-reload-and-render-provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('FAILED_CANDIDATE_DIAGNOSTIC_RENDER_CAPTURE_COMPLETE',flush=True)
