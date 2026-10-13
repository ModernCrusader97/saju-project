import bpy,sys,argparse,json,hashlib,math
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:]);p=Path(a.blend).resolve();out=Path(a.out).resolve();assert p.is_file() and not out.exists()
source_sha=hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(p));skin=bpy.data.objects["Dragon_Continuous_Skin"]
direction=Vector((0,math.cos(math.radians(-8)),math.sin(math.radians(-8))));mi=skin.matrix_world.inverted();local_dir=(mi.to_3x3()@direction).normalized()
rows=[]
for sign in (-1,1):
 eye=bpy.data.objects["Eye_Closed_Fitted_Convex_Volume_"+str(sign)];rim=1+21*64;measurements=[]
 for j in range(64):
  point=eye.matrix_world@eye.data.vertices[rim+j].co;origin=point-direction*2
  ok,hit,normal,_=skin.ray_cast(mi@origin,local_dir,distance=4)
  assert ok,"Skin support ray missing"
  actual=skin.matrix_world@hit;gap=float((actual-point).dot(direction))
  measurements.append({"angle_radians":2*math.pi*j/64,"eye_rim":list(point),"skin_support":list(actual),"floating_gap":gap})
 gaps=[m["floating_gap"] for m in measurements];rows.append({"eye":eye.name,"min_signed_gap":min(gaps),"max_signed_gap":max(gaps),"mean_signed_gap":sum(gaps)/len(gaps),"rim_samples":measurements})
maximum=max(r["max_signed_gap"] for r in rows);minimum=min(r["min_signed_gap"] for r in rows)
passed=maximum<=.012 and minimum>=-.015
report={"status":"PASS_EYE_RIM_CONTACT_ONLY" if passed else "FAIL_EYE_RIM_CONTACT_GAP","blend":str(p),"source_sha256":source_sha,"max_allowed_floating_gap":.012,"max_allowed_occlusion_depth":.015,"overall_max_gap":maximum,"overall_min_gap":minimum,"sample_direction":list(direction),"eyes":rows,"visual_fidelity_claimed":False}
assert hashlib.sha256(p.read_bytes()).hexdigest()==source_sha
out.write_text(json.dumps(report,indent=2),encoding="utf8");print(json.dumps({k:v for k,v in report.items() if k!="eyes"}),flush=True)
assert passed,"Actual eye rim is not in sufficiently close contact with the skin; inspect preserved diagnostic"
