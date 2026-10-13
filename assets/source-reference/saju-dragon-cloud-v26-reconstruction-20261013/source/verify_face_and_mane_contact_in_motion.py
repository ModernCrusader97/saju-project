"""Read-only evaluated motion contact checks at 13 actual animation frames."""
import argparse,bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);p=Path(a.out);assert not p.exists();src=Path(a.blend);original=hashlib.sha256(src.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False);skin=bpy.data.objects['Dragon_Continuous_Skin'];rig=bpy.data.objects['Dragon_V8_Rig'];rows=[];worst_lid=0;worst_root=-100
base_direction=Vector((0,math.cos(math.radians(-8)),math.sin(math.radians(-8))))
for frame in range(0,145,12):
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(skin,dg);mi=skin.matrix_world.inverted();head=rig.pose.bones['Head'];transform=rig.matrix_world@head.matrix@head.bone.matrix_local.inverted()@rig.matrix_world.inverted();direction=(transform.to_3x3()@base_direction).normalized();local_direction=(mi.to_3x3()@direction).normalized();lid=[];roots=[]
 for sign in (-1,1):
  eye=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(sign)];ev=eye.evaluated_get(dg);me=ev.to_mesh()
  for j in range(1,32):
   point=ev.matrix_world@me.vertices[1345+j].co;hit,no,face,distance=tree.ray_cast(mi@(point-direction*2),local_direction,4);assert hit is not None;gap=float((skin.matrix_world@hit-point).dot(direction));lid.append(gap)
  ev.to_mesh_clear()
 for o in bpy.data.collections['Dragon_V8_New_Static_Construction'].objects:
  if o.type!='MESH' or not (o.name.startswith('Dorsal_Flame_') or o.name.startswith('Tail_Flame_Fan_')):continue
  ev=o.evaluated_get(dg);me=ev.to_mesh();point=mi@(ev.matrix_world@me.vertices[0].co);hit,no,face,distance=tree.find_nearest(point);assert hit is not None;clearance=float((point-hit).dot(no));roots.append({'mesh':o.name,'signed_clearance':clearance});ev.to_mesh_clear()
 worst_lid=max(worst_lid,max(lid));worst_root=max(worst_root,max(r['signed_clearance'] for r in roots));rows.append({'frame':frame,'upper_lid_maximum_gap':max(lid),'upper_lid_minimum_gap':min(lid),'mane_root_maximum_clearance':max(r['signed_clearance'] for r in roots),'mane_root_samples':len(roots)})
passed=worst_lid<=.002 and min(r['upper_lid_minimum_gap'] for r in rows)>=-.015 and worst_root<=.018;report={'status':'PASS_STRICT_EYE_LID_AND_MANE_CONTACT_IN_ACTUAL_MOTION' if passed else 'FAIL_CONTACT_IN_MOTION','frames':rows,'maximum_upper_lid_gap':worst_lid,'maximum_mane_root_clearance':worst_root,'source_sha256':original,'native_modified':False};assert hashlib.sha256(src.read_bytes()).hexdigest()==original;p.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='frames'}),flush=True);assert passed,'Contact regression in actual evaluated motion'
