import bpy,sys,argparse,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:]);src=Path(a.blend).resolve();out=Path(a.out).resolve();assert src.is_file() and not out.exists()
before=hashlib.sha256(src.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(src))
direction=Vector((0,math.cos(math.radians(-8)),math.sin(math.radians(-8))));rows=[]
for sign in (-1,1):
 eye=bpy.data.objects["Eye_Closed_Fitted_Convex_Volume_"+str(sign)];mi=eye.matrix_world.inverted();raydir=(mi.to_3x3()@direction).normalized();samples=[];misses=[]
 eye.data.calc_loop_triangles();front=[t for t in eye.data.loop_triangles if all(i<1+22*64 for i in t.vertices)]
 for j,tri in enumerate(front):
  p=eye.matrix_world@(sum((eye.data.vertices[i].co for i in tri.vertices),Vector())/3)
  ok,hit,no,face=eye.ray_cast(mi@(p-direction*.5),raydir,distance=1)
  if not ok:misses.append(j);continue
  depth=float((p-eye.matrix_world@hit).dot(direction))
  if depth>.003:samples.append({"front_triangle":j,"front_surface_point":list(p),"nearest_eye_surface_point":list(eye.matrix_world@hit),"occlusion_depth":depth,"face_index":face})
 rows.append({"eye":eye.name,"front_triangle_centroids_sampled":len(front),"missing_rays":misses,"self_occluded_front_triangles":len(samples),"max_occlusion_depth":max([s["occlusion_depth"] for s in samples],default=0),"samples":samples})
maximum=max(r["max_occlusion_depth"] for r in rows);missed=sum(len(r["missing_rays"]) for r in rows);passed=maximum<=.003 and missed==0
r={"status":"PASS_EYE_FRONT_NOT_SELF_OCCLUDED" if passed else "FAIL_EYE_BACK_SURFACE_SELF_OCCLUDES_FRONT" if missed==0 else "FAIL_MEASUREMENT_RAY_MISSES","source":str(src),"source_sha256":before,"max_allowed_self_occlusion":.003,"max_actual_self_occlusion":maximum,"missing_rays":missed,"eyes":rows,"native_modified":False,"visual_approval_claimed":False,"method":"Interior triangle centroids avoid tangent rays on perimeter vertices."}
assert hashlib.sha256(src.read_bytes()).hexdigest()==before
out.write_text(json.dumps(r,indent=2),encoding="utf8");print(json.dumps({k:v for k,v in r.items() if k!="eyes"}),flush=True)
assert passed,"Back or closing faces occlude the front surface, or measurement missed; diagnostic preserved"
