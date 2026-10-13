"""Round and soften both reconstructed eye contours, retaining width, height and convexity.
Only eye caps, attached glints and a narrow skin support annulus may change.
New output folder required. The input and original V25/V26 records are never overwritten.
"""
import argparse,bpy,json,math,sys,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from measure_face_fixes import unmap,remap,hit_head,DIRECTION
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);skin=bpy.data.objects['Dragon_Continuous_Skin'];data={}
for sign in (-1,1):
 o=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(sign)];q=np.array([tuple(unmap(o.matrix_world@v.co)) for v in o.data.vertices]);r=q[1345:1409][:,[0,2]];mn=r.min(axis=0);mx=r.max(axis=0);data[sign]={'object':o,'points':q,'center':(mn+mx)/2,'radius':(mx-mn)/2}
radius=np.maximum(data[-1]['radius'],data[1]['radius']);cx=(abs(data[-1]['center'][0]+1.10)+abs(data[1]['center'][0]+1.10))/2;cz=(data[-1]['center'][1]+data[1]['center'][1])/2;spec=[]
for sign,d in data.items():
 o=d['object'];q=d['points'];x=-1.10+sign*cx;z=cz;w,h=map(float,radius);rim=[];support=[]
 for j in range(64):
  theta=2*math.pi*j/64;dx=w*math.cos(theta);dz=h*math.sin(theta);p,f=hit_head(x+dx,z+dz);rim.append([dx,dz]);support.append(unmap(p).y)
 rim=np.asarray(rim);design=np.column_stack([np.ones(64),rim]);plane=np.linalg.lstsq(design,np.asarray(support),rcond=None)[0]
 dx=q[:1409,0]-(-1.10+sign*.47);dz=q[:1409,2]-3.61;root=np.sqrt(np.maximum(0,1-(dx/.123)**2-(dz/.169)**2));old=np.linalg.lstsq(np.column_stack([np.ones(len(dx)),dx,dz,root]),q[:1409,1],rcond=None)[0];depth=-old[3];assert .09<depth<.12
 ox=x-(-1.10+sign*.47);oz=z-3.61;apex_y=old[0]+old[1]*ox+old[2]*oz-depth*math.sqrt(1-(ox/.123)**2-(oz/.169)**2);bulge=float(plane[0]-apex_y);assert 0<bulge<depth
 rho=math.sqrt(1-(1-bulge/depth)**2);root_at_rim=math.sqrt(1-rho*rho)
 def front(dx,dz,r):return float(plane[0]+plane[1]*dx+plane[2]*dz+depth*root_at_rim-depth*math.sqrt(max(0,1-r*r*rho*rho)))
 target=[(x,front(0,0,0),z)];radial=[0.]
 for i in range(1,23):
  rr=i/22
  for j in range(64):
   theta=2*math.pi*j/64;dx=w*rr*math.cos(theta);dz=h*rr*math.sin(theta);target.append((x+dx,front(dx,dz,rr),z+dz));radial.append(rr)
 for p,rr in zip(list(target),radial):target.append((p[0],p[1]+.046+.064*math.sqrt(max(0,1-rr*rr*rho*rho)),p[2]))
 assert len(target)==len(o.data.vertices)==2818
 for v,p in zip(o.data.vertices,target):v.co=o.matrix_world.inverted()@remap(Vector(p))
 o.data.update();o['cloud_eye_change']='Smoother symmetric elliptical contour; no width/height/area reduction; convex cap retained.'
 glint=bpy.data.objects['Eye_Attached_Glint_'+str(sign)];g=unmap(glint.matrix_world@glint.data.vertices[0].co);gr=math.sqrt(((g.x-x)/w)**2+((g.z-z)/h)**2);delta=front(g.x-x,g.z-z,gr)-.003-g.y
 for v in glint.data.vertices:
  p=unmap(glint.matrix_world@v.co);p.y+=delta;v.co=glint.matrix_world.inverted()@remap(p)
 glint.data.update();spec.append({'sign':sign,'center':[x,z],'radius':[w,h],'plane':plane.tolist(),'depth':depth,'rho':rho,'apex_y':apex_y,'glint_translation_head_y':delta})
bpy.context.view_layer.update();all_changes=set();max_step=0
for iteration in range(8):
 maximum=0;minimum=0
 for row in spec:
  x,z=row['center'];w,h=row['radius'];rim=[];gaps=[];support=[]
  eye=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(row['sign'])]
  for j in range(64):
   p=eye.matrix_world@eye.data.vertices[1345+j].co;q=unmap(p);hit,f=hit_head(q.x,q.z);s=unmap(hit);gap=float(s.y-q.y);rim.append(tuple(q));support.append(tuple(s));gaps.append(.0006-gap);maximum=max(maximum,gap*1.19);minimum=min(minimum,gap*1.19)
  if maximum<=.007 and minimum>=-.010:continue
  rim=np.asarray(rim);support=np.asarray(support);gaps=np.asarray(gaps);ids=[];points=[]
  for v in skin.data.vertices:
   if not (3.3<v.co.z<4.1 and -2.0<v.co.x<-.2 and v.co.y<-.25):continue
   q=unmap(skin.matrix_world@v.co)
   if abs(q.x-x)<w+.055 and z-h-.052<q.z<z+h+.052 and q.y<-.30:ids.append(v.index);points.append(tuple(q))
  q=np.asarray(points);distance=np.linalg.norm(q[:,[0,2]][:,None,:]-rim[:,[0,2]][None,:,:],axis=2);near=distance.argmin(axis=1);dist=distance[np.arange(len(q)),near];weight=np.clip(1-(dist/.050)**2,0,1)**2;front_side=np.abs(q[:,1]-support[near,1])<.080;delta=np.clip(gaps[near],-.015,.015)*weight*front_side
  for index,point,dy in zip(ids,q,delta):
   if abs(dy)<1e-9:continue
   point[1]+=dy;skin.data.vertices[index].co=skin.matrix_world.inverted()@remap(Vector(point));all_changes.add(index);max_step=max(max_step,abs(float(dy))*1.19)
 skin.data.update();bpy.context.view_layer.update()
 if maximum<=.007 and minimum>=-.010:break
skin.data.update();bpy.context.view_layer.update();contact=[]
for row in spec:
 eye=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(row['sign'])];gaps=[]
 for j in range(64):
  p=eye.matrix_world@eye.data.vertices[1345+j].co;q=unmap(p);hit,f=hit_head(q.x,q.z);gaps.append(float((hit-p).dot(DIRECTION)))
 contact.append({'sign':row['sign'],'min_gap':min(gaps),'max_gap':max(gaps)})
notes=bpy.data.texts.new('CLOUD_ROUND_EYE_AUTHORING');notes.write(Path(__file__).read_text())
path=out/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
report={'status':'ROUND_EYE_CANDIDATE_GENERATED_QA_PENDING','exact_original_V26_claim':False,'source_native_sha256':hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),'native_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'eye_parameters':spec,'eye_contact':contact,'support_vertices_changed':len(all_changes),'maximum_single_step_support_displacement':max_step,'no_eye_shrink_requested':True,'body_limbs_mane_mouth_cameras_change_requested':False,'user_visual_approval':False};(out/'round-eye-generation-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
