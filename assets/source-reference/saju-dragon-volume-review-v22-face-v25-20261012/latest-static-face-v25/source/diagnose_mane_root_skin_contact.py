import bpy,sys,argparse,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:]);src=Path(a.blend).resolve();out=Path(a.out).resolve();assert src.is_file() and not out.exists()
before=hashlib.sha256(src.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False);s=bpy.context.scene;s.frame_set(0);bpy.context.view_layer.update();skin=bpy.data.objects["Dragon_Continuous_Skin"];dg=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(skin,dg);rows=[]
for ob in bpy.data.collections["Dragon_V8_New_Static_Construction"].objects:
 if ob.type!="MESH" or not (ob.name.startswith("Dorsal_Flame_") or ob.name.startswith("Tail_Flame_Fan_")):continue
 ev=ob.evaluated_get(dg);me=ev.to_mesh();p=ev.matrix_world@me.vertices[0].co;local=skin.matrix_world.inverted()@p;hit,no,idx,dist=tree.find_nearest(local);assert hit is not None;outside=float((local-hit).dot(no));rows.append({"mesh":ob.name,"root":list(p),"nearest_skin":list(skin.matrix_world@hit),"signed_root_clearance":outside,"nearest_distance":float(dist)});ev.to_mesh_clear()
maximum=max(x["signed_root_clearance"] for x in rows);r={"status":"PASS_MANE_ROOTS_IN_CONTACT_WITH_CONTINUOUS_SKIN" if maximum<=.018 else "FAIL_MANE_ROOTS_FLOAT_FROM_SKIN","native_sha256":before,"frame":0,"max_allowed_clearance":.018,"max_actual_clearance":maximum,"roots":rows,"source_native_unchanged":True,"appearance_approval_claimed":False}
assert hashlib.sha256(src.read_bytes()).hexdigest()==before;out.write_text(json.dumps(r,indent=2),encoding="utf8");print(json.dumps({"status":r["status"],"maximum":maximum,"roots":len(rows),"worst":sorted(rows,key=lambda x:x["signed_root_clearance"],reverse=True)[:5]}),flush=True)