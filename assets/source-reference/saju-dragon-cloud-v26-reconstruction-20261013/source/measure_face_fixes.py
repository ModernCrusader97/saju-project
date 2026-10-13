import bpy,math,numpy as np
from mathutils import Vector
from mathutils.geometry import barycentric_transform
H=-1.10;A=math.radians(-8);CO=math.cos(A);SI=math.sin(A)
def unmap(p):
 y=p.y*CO+(p.z-3.03)*SI;z=3.03-p.y*SI+(p.z-3.03)*CO
 return Vector((H+(p.x-H)/1.24,y/1.19,3.55+(z-3.55)/1.18))
def remap(p):
 x=H+(p.x-H)*1.24;y=p.y*1.19;z=3.55+(p.z-3.55)*1.18
 return Vector((x,y*CO-(z-3.03)*SI,3.03+y*SI+(z-3.03)*CO))
DIRECTION=Vector((0,CO,SI))
def hit_head(x,z):
 skin=bpy.data.objects['Dragon_Continuous_Skin'];mi=skin.matrix_world.inverted();ok,p,no,f=skin.ray_cast(mi@remap(Vector((x,-3,z))),(mi.to_3x3()@DIRECTION).normalized(),distance=10)
 assert ok,'Actual skin support missing';return skin.matrix_world@p,f
def skin_color_mix(x,z):
 skin=bpy.data.objects['Dragon_Continuous_Skin'];point,face=hit_head(x,z);indices=skin.data.polygons[face].vertices;assert len(indices)==3
 ca=skin.data.color_attributes['BodyTint'];teal=Vector(bpy.data.materials['Body_Teal'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]);ivory=Vector(bpy.data.materials['Belly_Horns_Whiskers_Ivory'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]);delta=ivory-teal
 values=[(Vector(ca.data[i].color[:3])-teal).dot(delta)/delta.length_squared for i in indices]
 local=skin.matrix_world.inverted()@point;v=[skin.data.vertices[i].co for i in indices]
 return float(barycentric_transform(local,*v,*(Vector((c,0,0)) for c in values)).x),point
def upper_contact():
 rows=[]
 for sign in (-1,1):
  o=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(sign)];rr=[]
  for j in range(1,32):
   eye=o.matrix_world@o.data.vertices[1345+j].co;q=unmap(eye);skin,f=hit_head(q.x,q.z);rr.append({'j':j,'head_point':list(q),'signed_gap':float((skin-eye).dot(DIRECTION))})
  rows.append({'sign':sign,'max_gap':max(x['signed_gap'] for x in rr),'min_gap':min(x['signed_gap'] for x in rr),'samples':rr})
 return rows
def mouth_boundary():
 o=bpy.data.objects['Gentle_Closed_Toothless_Smile'];rows=[]
 for j in range(55):
  point=sum((o.matrix_world@o.data.vertices[j*10+k].co for k in range(10)),Vector())/10;q=unmap(point);mix,hit=skin_color_mix(q.x,q.z);rows.append({'ring':j,'head_center':list(q),'cream_mix':mix,'boundary_error':abs(mix-.5),'signed_center_gap':float((hit-point).dot(DIRECTION))})
 return rows
if __name__=='__main__':
 import argparse,json,sys
 from pathlib import Path
 ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);eyes=upper_contact();mouth=mouth_boundary();max_gap=max(r['max_gap'] for r in eyes);mean_error=sum(r['boundary_error'] for r in mouth)/len(mouth);max_error=max(r['boundary_error'] for r in mouth);passed=max_gap<=.002 and min(r['min_gap'] for r in eyes)>=-.015 and mean_error<=.08 and max_error<=.15
 r={'status':'PASS_RECONSTRUCTED_UPPER_LID_AND_ACTUAL_MOUTH_BOUNDARY' if passed else 'FAIL_RECONSTRUCTED_FACE_FIX_GUARDS','upper_lid_max_gap':max_gap,'mouth_mean_boundary_error':mean_error,'mouth_max_boundary_error':max_error,'eyes':eyes,'mouth':mouth,'exact_original_V26_claim':False};out.write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k not in ('eyes','mouth')}),flush=True);assert passed,'Upper lid/mouth boundary guards failed'
