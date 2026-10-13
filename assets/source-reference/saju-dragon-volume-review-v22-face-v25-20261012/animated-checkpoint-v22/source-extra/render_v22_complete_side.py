import bpy,sys,argparse,json,hashlib
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--glb",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:]);blend=Path(a.blend).resolve();glb=Path(a.glb).resolve();out=Path(a.out).resolve();assert blend.is_file() and glb.is_file() and not out.exists();out.mkdir(parents=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={"blend":sha(blend),"glb":sha(glb)}
bpy.ops.wm.open_mainfile(filepath=str(blend),load_ui=False)
bpy.data.collections["Dragon_V8_New_Static_Construction"].hide_render=True;bpy.data.collections["V8_Runtime_GLTF_Meshes"].hide_render=True
old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(glb));imported=[o for o in bpy.data.objects if o not in old]
controls={pb.custom_shape for ob in imported if ob.type=="ARMATURE" for pb in ob.pose.bones if pb.custom_shape is not None}
for ob in controls:ob.hide_render=True
meshes=[o for o in imported if o.type=="MESH" and o not in controls];assert len(meshes)==8
s=bpy.context.scene;s.frame_set(0);bpy.context.view_layer.update();cam=bpy.data.objects["Camera_Side"];cam.data.type="ORTHO";cam.data.ortho_scale=6.55;cam.location=(11,0,2.52);target=Vector((.05,0,2.52));cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler();s.camera=cam
bpy.data.objects["Preview_Floor"].hide_render=True;s.render.engine="CYCLES";s.cycles.device="CPU";s.cycles.samples=24;s.cycles.use_denoising=True;s.render.threads_mode="FIXED";s.render.threads=4;s.render.resolution_x=800;s.render.resolution_y=800;s.render.image_settings.file_format="PNG";s.render.filepath=str(out/"glb-reimport-side-complete.png");bpy.ops.render.render(write_still=True)
assert sha(blend)==before["blend"] and sha(glb)==before["glb"]
r={"status":"ACTUAL_GLB_COMPLETE_SIDE_RENDER_SOURCE_BYTES_UNCHANGED","source":before,"camera":{"type":cam.data.type,"location":list(cam.location),"target":list(target),"ortho_scale":cam.data.ortho_scale,"resolution":[800,800],"samples":24,"frame":0},"actual_glb_mesh_count":len(meshes),"render_sha256":sha(out/"glb-reimport-side-complete.png"),"native_saved_or_modified":False,"appearance_approved":False}
(out/"side-render-provenance.json").write_text(json.dumps(r,indent=2),encoding="utf8");print(json.dumps(r))