"""Compare actual native geometry before/after. No scene or model is saved."""
import argparse,bpy,hashlib,json,math,sys,numpy as np
from pathlib import Path
from mathutils import Vector
H=-1.10;A=math.radians(-8);CO=math.cos(A);SI=math.sin(A)
def unmap(p):
 y=p.y*CO+(p.z-3.03)*SI;z=3.03-p.y*SI+(p.z-3.03)*CO
 return (H+(p.x-H)/1.24,y/1.19,3.55+(z-3.55)/1.18)
def positions(o):
 a=np.empty(len(o.data.vertices)*3,dtype=np.float32);o.data.vertices.foreach_get('co',a);return a.reshape(-1,3)
def digest(o):
 h=hashlib.sha256();h.update(positions(o).tobytes());a=np.empty(len(o.data.loops),dtype=np.int32);o.data.loops.foreach_get('vertex_index',a);h.update(a.tobytes());h.update(np.asarray(o.matrix_world,dtype=np.float32).tobytes())
 for c in o.data.color_attributes:
  a=np.empty(len(c.data)*4,dtype=np.float32);c.data.foreach_get('color',a);h.update(a.tobytes())
 h.update(json.dumps([m.name for m in o.data.materials]).encode());return h.hexdigest()
def outline(o):
 q=np.array([unmap(o.matrix_world@v.co) for v in o.data.vertices[:1409]]);r=q[1345:1409][:,[0,2]];mn=r.min(axis=0);mx=r.max(axis=0);center=(mn+mx)/2;rad=(mx-mn)/2;n=np.linalg.norm((r-center)/rad,axis=1);area=.5*abs(np.dot(r[:,0],np.roll(r[:,1],-1))-np.dot(r[:,1],np.roll(r[:,0],-1)));perimeter=np.linalg.norm(r-np.roll(r,1,axis=0),axis=1).sum()
 forward=Vector((0,-CO,-SI));ps=[o.matrix_world@v.co for v in o.data.vertices[:1409]];bulges=[]
 for j in range(64):
  for ri in range(1,22):
   prev=ps[0] if ri==1 else ps[1+(ri-2)*64+j];p=ps[1+(ri-1)*64+j];nxt=ps[1+ri*64+j];bulges.append(float((p-(prev+nxt)*.5).dot(forward)))
 return {'width':float(2*rad[0]),'height':float(2*rad[1]),'center':center.tolist(),'area':float(area),'ellipse_radial_std':float(n.std()),'circularity':float(4*math.pi*area/perimeter**2),'minimum_radial_convex_bulge':min(bulges)}
def studio_signature():
 return {o.name:{'matrix':np.asarray(o.matrix_world).tolist(),'type':o.type,'ortho_scale':float(o.data.ortho_scale) if o.type=='CAMERA' else None,'lens':float(o.data.lens) if o.type=='CAMERA' else None,'energy':float(o.data.energy) if o.type=='LIGHT' else None} for o in bpy.data.collections['Preview_Studio'].objects}
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False);meshes={o.name:digest(o) for o in bpy.data.collections['Dragon_V8_New_Static_Construction'].objects if o.type=='MESH'};skin=positions(bpy.data.objects['Dragon_Continuous_Skin']).copy();eyes={str(s):outline(bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(s)]) for s in (-1,1)};return meshes,skin,eyes,studio_signature()
ap=argparse.ArgumentParser();ap.add_argument('--before',required=True);ap.add_argument('--after',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists()
before=snapshot(Path(a.before));after=snapshot(Path(a.after));checks=[]
allowed={'Dragon_Continuous_Skin','Eye_Closed_Fitted_Convex_Volume_-1','Eye_Closed_Fitted_Convex_Volume_1','Eye_Attached_Glint_-1','Eye_Attached_Glint_1'}
changed=[n for n in before[0] if before[0][n]!=after[0].get(n)];checks.append(('same_object_names',set(before[0])==set(after[0])));checks.append(('only_eye_and_local_skin_meshes_changed',all(n in allowed for n in changed)));checks.append(('same_cameras_lights_floor',before[3]==after[3]))
checks.append(('skin_topology_count_unchanged',before[1].shape==after[1].shape))
skin_delta=np.linalg.norm(before[1]-after[1],axis=1);ids=np.flatnonzero(skin_delta>1e-7);p=np.array([unmap(Vector(before[1][i])) for i in ids]);local=(p[:,2]>3.40)&(p[:,2]<3.85)&(np.abs(np.abs(p[:,0]-H)-.47)<.205)&(p[:,1]<-.30) if len(p) else np.array([],dtype=bool);checks.append(('skin_changes_confined_to_eye_support',bool(np.all(local))));checks.append(('local_skin_displacement_bounded',float(skin_delta.max(initial=0))<.04))
for s in ('-1','1'):
 b=before[2][s];c=after[2][s];checks.extend([(s+'_width_not_reduced',c['width']>=b['width']-2e-6),(s+'_height_not_reduced',c['height']>=b['height']-2e-6),(s+'_area_not_reduced',c['area']>=b['area']*.999),(s+'_area_change_small',c['area']<=b['area']*1.03),(s+'_rounder_outline',c['ellipse_radial_std']<b['ellipse_radial_std']*.5),(s+'_convex_eye',c['minimum_radial_convex_bulge']>=-1e-6)])
checks.append(('bilateral_outline_dimensions_symmetric',abs(after[2]['-1']['width']-after[2]['1']['width'])<3e-6 and abs(after[2]['-1']['height']-after[2]['1']['height'])<3e-6))
report={'status':'PASS_EYE_ONLY_NO_SHRINK_ROUNDER_CONTOUR' if all(v for n,v in checks) else 'FAIL_EYE_CHANGE_GUARD','checks':dict(checks),'before':before[2],'after':after[2],'changed_meshes':changed,'skin_changed_vertices':len(ids),'max_skin_displacement':float(skin_delta.max(initial=0)),'original_V26_identical_claim':False,'before_native_sha256':hashlib.sha256(Path(a.before).read_bytes()).hexdigest(),'after_native_sha256':hashlib.sha256(Path(a.after).read_bytes()).hexdigest()};out.write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
assert all(v for n,v in checks),'Failed actual geometry guards: '+str([n for n,v in checks if not v])
