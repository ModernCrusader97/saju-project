"""Retain the earlier strict upper-lid contact fix after eye rounding.
Solve actual supporting triangle vertices; eyes, glints, paint, topology and studio are frozen.
"""
import bpy,numpy as np
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from measure_face_fixes import upper_contact,hit_head,DIRECTION
def refine():
 skin=bpy.data.objects['Dragon_Continuous_Skin'];before=upper_contact();constraints=[];ids=set()
 for row in before:
  for sample in row['samples']:
   q=Vector(sample['head_point']);point,face=hit_head(q.x,q.z);tri_ids=list(skin.data.polygons[face].vertices);assert len(tri_ids)==3
   local=skin.matrix_world.inverted()@point;v=[skin.data.vertices[i].co for i in tri_ids];w=barycentric_transform(local,*v,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)));constraints.append((tri_ids,list(w),.0008-sample['signed_gap']));ids.update(tri_ids)
 ordered=sorted(ids);lookup={i:j for j,i in enumerate(ordered)};matrix=np.zeros((len(constraints),len(ordered)));target=np.zeros(len(constraints))
 for j,(tri_ids,weights,difference) in enumerate(constraints):
  for i,w in zip(tri_ids,weights):matrix[j,lookup[i]]=w
  target[j]=difference
 delta=np.linalg.lstsq(matrix,target,rcond=1e-8)[0];assert np.max(np.abs(delta))<.015
 for i,d in zip(ordered,delta):
  v=skin.data.vertices[i];v.co=skin.matrix_world.inverted()@(skin.matrix_world@v.co+DIRECTION*float(d))
 skin.data.update();bpy.context.view_layer.update();after=upper_contact();assert max(r['max_gap'] for r in after)<=.002 and min(r['min_gap'] for r in after)>=-.015
 return {'before_maximum_upper_gap':max(r['max_gap'] for r in before),'after_maximum_upper_gap':max(r['max_gap'] for r in after),'maximum_vertex_displacement':float(np.max(np.abs(delta))),'support_vertices':ordered}
if __name__=='__main__':
 import argparse,hashlib,json,sys
 from pathlib import Path
 ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True);bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);report=refine();notes=bpy.data.texts.new('CLOUD_STRICT_UPPER_LID_REPAIR');notes.write(Path(__file__).read_text());p=out/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Final.blend';bpy.ops.wm.save_as_mainfile(filepath=str(p),compress=True);report.update(status='PASS_STRICT_LID_CONTACT_RETAINED_AFTER_ROUNDING',source_sha256=hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),native_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),exact_original_V26_claim=False);(out/'strict-lid-repair-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
