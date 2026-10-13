"""Semantic reconstruction of the two documented V26 WIP fixes, NOT exact V26 source recovery.
Upper eyelid support is brought close to frozen V25 eye perimeters.
The separate smile tube is removed: this is an explicit inference from the V26 70-mesh
manifest versus V25's 71 meshes, and the reported mouth boundary correction.
All originals are preserved; all other meshes, eye data, colors and studio remain unchanged.
"""
import argparse,bpy,hashlib,json,sys,numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from measure_face_fixes import unmap,remap,upper_contact,skin_color_mix
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);skin=bpy.data.objects['Dragon_Continuous_Skin'];char=bpy.data.collections['Dragon_V8_New_Static_Construction']
def mesh_digest(o):
 h=hashlib.sha256();q=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',q);h.update(q.tobytes());q=np.empty(len(o.data.loops),dtype=np.int32);o.data.loops.foreach_get('vertex_index',q);h.update(q.tobytes())
 for ca in o.data.color_attributes:
  q=np.empty(len(ca.data)*4,dtype=np.float32);ca.data.foreach_get('color',q);h.update(q.tobytes())
 return h.hexdigest()
before={o.name:mesh_digest(o) for o in char.objects if o.type=='MESH'};before_contact=upper_contact();changed=set();max_delta=0
from mathutils.geometry import barycentric_transform
from measure_face_fixes import hit_head,DIRECTION
constraints=[];vertex_ids=set()
for row in before_contact:
 for sample in row['samples']:
  q=Vector(sample['head_point']);point,face=hit_head(q.x,q.z);ids=list(skin.data.polygons[face].vertices);assert len(ids)==3
  local=skin.matrix_world.inverted()@point;tri=[skin.data.vertices[i].co for i in ids]
  weights=barycentric_transform(local,*tri,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
  constraints.append((ids,list(weights),.0008-sample['signed_gap']));vertex_ids.update(ids)
ordered=sorted(vertex_ids);index={i:j for j,i in enumerate(ordered)};matrix=np.zeros((len(constraints),len(ordered)));target=np.zeros(len(constraints))
for row,(ids,weights,difference) in enumerate(constraints):
 for i,w in zip(ids,weights):matrix[row,index[i]]=w
 target[row]=difference
delta=np.linalg.lstsq(matrix,target,rcond=1e-8)[0];assert np.max(np.abs(delta))<.020,'Contact solve exceeded local micro-sculpt bound'
for i,difference in zip(ordered,delta):
 if abs(difference)<1e-9:continue
 v=skin.data.vertices[i];v.co=skin.matrix_world.inverted()@(skin.matrix_world@v.co+DIRECTION*float(difference));changed.add(i);max_delta=max(max_delta,abs(float(difference)))
skin.data.update();bpy.context.view_layer.update()
after_contact=upper_contact();assert max(r['max_gap'] for r in after_contact)<=.002,'Upper lid support did not reach the target guard'
mouth=bpy.data.objects['Gentle_Closed_Toothless_Smile'];boundary=[]
for j in range(55):
 q=unmap(sum((mouth.matrix_world@mouth.data.vertices[j*10+k].co for k in range(10)),Vector())/10);lo=q.z-.070;hi=q.z+.070;ml,_=skin_color_mix(q.x,lo);mh,_=skin_color_mix(q.x,hi);assert ml>.5 and mh<.5,'Actual cream boundary not bracketed'
 for _ in range(25):
  mid=(lo+hi)/2;mix,p=skin_color_mix(q.x,mid)
  if mix>.5:lo=mid
  else:hi=mid
 z=(lo+hi)/2;mix,p=skin_color_mix(q.x,z);boundary.append({'x':q.x,'z':z,'actual_cream_mix':mix,'point':list(p)})
bpy.data.objects.remove(mouth,do_unlink=True)
skin['reconstructed_v26_mouth_boundary_samples_json']=json.dumps(boundary)
skin['cloud_reconstruction']='Known V26 eyelid contact and mouth boundary semantics reconstructed from V25; exact original V26 bytes not available.'
after={o.name:mesh_digest(o) for o in char.objects if o.type=='MESH'}
assert len(after)==70 and set(before)-set(after)=={'Gentle_Closed_Toothless_Smile'}
assert all(before[n]==after[n] for n in after if n!='Dragon_Continuous_Skin'),'Unrelated or frozen eye mesh changed'
notes=bpy.data.texts.new('CLOUD_RECONSTRUCTION_PROVENANCE');notes.write(Path(__file__).read_text())
path=out/'SaJu_Dragon_Cloud_V26_Reconstructed_Baseline.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
report={'status':'PASS_SEMANTIC_V26_RECONSTRUCTION_CANDIDATE_NOT_IDENTICAL_RECOVERY','source_blend_sha256':hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),'native_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'original_V26_generator_sha256':'ab61cb83c3548be8118f44f0681ecd07d661664b051ecdbe118580276507c8d4','exact_original_V26_code_available':False,'literal_V25_eyes_glints_and_non_face_meshes_preserved':True,'mesh_count':len(after),'upper_lid_gap_before':max(r['max_gap'] for r in before_contact),'upper_lid_gap_after':max(r['max_gap'] for r in after_contact),'skin_changed_vertices':len(changed),'max_single_pass_skin_displacement':max_delta,'mouth_tube_removed_as_inference_from_mesh_count_and_fix_description':True,'actual_mouth_boundary_max_error':max(abs(b['actual_cream_mix']-.5) for b in boundary),'new_improvement_count':0,'prior_verified_art_count':2,'visual_approval':False}
(out/'reconstruction-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
