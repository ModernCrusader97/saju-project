"""Render actual GLB poses with the verified Blender studio. No AI image generation."""
import bpy,sys,argparse,json,hashlib
from pathlib import Path
ap=argparse.ArgumentParser()
ap.add_argument("--blend",required=True);ap.add_argument("--glb",required=True)
ap.add_argument("--qa",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:])
out=Path(a.out).resolve();assert not out.exists();out.mkdir(parents=True)
qa=json.loads(Path(a.qa).read_text(encoding="utf8"))
assert qa["status"]=="PASS_NATIVE_AND_GLB_ROUNDTRIP"
assert qa["glb_sha256"]==hashlib.sha256(Path(a.glb).read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(Path(a.blend).resolve()),load_ui=False)
scene=bpy.context.scene
bpy.data.collections["Dragon_Approved_Candidate"].hide_render=True
bpy.data.collections["Runtime_GLTF_Meshes"].hide_render=True
old=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
imported=[o for o in bpy.data.objects if o not in old]
for ob in imported:
 if ob.type=="ARMATURE":
  for pb in ob.pose.bones:
   if pb.custom_shape:pb.custom_shape.hide_render=True
scene.camera=bpy.data.objects["Camera_ThreeQuarter"]
bpy.data.objects["Preview_Floor"].hide_render=False
scene.render.engine="CYCLES";scene.cycles.device="CPU";scene.cycles.samples=12
scene.cycles.use_denoising=True;scene.render.threads_mode="FIXED";scene.render.threads=4
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.frame_start=0;scene.frame_end=143;scene.frame_step=2;scene.render.fps=12
scene.render.image_settings.file_format="PNG";scene.render.filepath=str(out/"frame_")
bpy.ops.render.render(animation=True)
print("ACTUAL_GLB_IDLE_FRAMES_READY",flush=True)

