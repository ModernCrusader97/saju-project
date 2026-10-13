import bpy,sys,argparse,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:]);src=Path(a.blend).resolve();out=Path(a.out).resolve();assert src.is_file() and not out.exists();out.mkdir(parents=True)
before=hashlib.sha256(src.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False);s=bpy.context.scene;s.frame_set(0);bpy.context.view_layer.update()
fwd=Vector((0,-math.cos(math.radians(-8)),-math.sin(math.radians(-8))));eyes=[];rings=22;sides=64
for sign in (-1,1):
 ob=bpy.data.objects["Eye_Closed_Fitted_Convex_Volume_"+str(sign)];pts=[ob.matrix_world@v.co for v in ob.data.vertices[:1+rings*sides]];colors=ob.data.color_attributes["EyeLensTint"];brown=Vector(colors.data[0].color[:3]);samples=[];white_rim=[]
 for j in range(sides):
  p=pts[1+(rings-1)*sides+j];c=Vector(colors.data[1+(rings-1)*sides+j].color[:3]);white_rim.append({"angle":2*math.pi*j/sides,"color":list(c),"brown_distance":(c-brown).length})
  for ri in range(1,rings):
   k=1+(ri-1)*sides+j;prev=pts[0] if ri==1 else pts[1+(ri-2)*sides+j];nxt=pts[1+ri*sides+j];bulge=float((pts[k]-(prev+nxt)*.5).dot(fwd));is_brown=(Vector(colors.data[k].color[:3])-brown).length<.005
   samples.append({"ring":ri,"angle":2*math.pi*j/sides,"radial_convex_bulge":bulge,"brown_surface":is_brown})
 b=[x for x in samples if x["brown_surface"]];negative=[x for x in b if x["radial_convex_bulge"] < -1e-6];centre=[]
 for j in range(sides//2):
  p=pts[1+(rings-1)*sides+j];q=pts[1+(rings-1)*sides+j+sides//2];centre.append(float((pts[0]-(p+q)*.5).dot(fwd)))
 eyes.append({"eye":ob.name,"front_vertices":len(pts),"brown_radial_samples":len(b),"brown_radial_concave_samples":len(negative),"brown_min_radial_convex_bulge":min(x["radial_convex_bulge"] for x in b),"centre_forward_of_opposite_rim_midpoints_range":[min(centre),max(centre)],"concave_samples":negative,"perimeter_colors":white_rim})
s.camera=bpy.data.objects["Camera_HeadFront"];bpy.data.objects["Preview_Floor"].hide_render=True;s.render.engine="CYCLES";s.cycles.device="CPU";s.cycles.samples=24;s.cycles.use_denoising=True;s.render.threads_mode="FIXED";s.render.threads=4;s.render.resolution_x=s.render.resolution_y=720;s.render.image_settings.file_format="PNG"
mat=bpy.data.materials["V8_Fitted_Convex_Eye_And_Upper_Lid_Color"];bs=mat.node_tree.nodes["Principled BSDF"];original={"roughness":float(bs.inputs["Roughness"].default_value),"specular":float(bs.inputs["Specular IOR Level"].default_value)};light_records=[]
# Approximation from the approved image: broad upper-left key, weaker fill,
# warm neutral environment, restrained rear light. Exact source lighting is unknown.
s.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.76,.72,.66,1);s.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.28
for name,energy,size in [("Key",520,5),("Fill",160,5),("Rim",120,4)]:
 ob=bpy.data.objects[name];ob.data.energy=energy;ob.data.size=size;light_records.append({"name":name,"location":list(ob.location),"energy":energy,"size":size})
records=[]
for name,rough,spec in [("reference-approx-glossy",.30,.40),("reference-approx-matte-diagnostic",.85,0.)]:
 bs.inputs["Roughness"].default_value=rough;bs.inputs["Specular IOR Level"].default_value=spec;s.render.filepath=str(out/(name+".png"));bpy.ops.render.render(write_still=True);records.append({"name":name,"roughness":rough,"specular":spec,"file":name+".png","sha256":hashlib.sha256((out/(name+".png")).read_bytes()).hexdigest(),"geometry_changed":False})
assert hashlib.sha256(src.read_bytes()).hexdigest()==before
r={"status":"EYE_CURVATURE_AND_APPROX_SOURCE_LIGHTING_DIAGNOSTIC_ONLY","source_native_sha256":before,"native_geometry_modified":False,"native_saved":False,"original_material":original,"lights":light_records,"world_strength":.28,"lighting_matched_exactly_claimed":False,"source_camera_and_lighting_unknown":True,"eyes":eyes,"renders":records,"appearance_approval_claimed":False}
(out/"diagnostic-report.json").write_text(json.dumps(r,indent=2),encoding="utf8");print(json.dumps({"status":r["status"],"eyes":[{k:v for k,v in e.items() if k not in ("concave_samples","perimeter_colors")} for e in eyes],"renders":records}),flush=True)