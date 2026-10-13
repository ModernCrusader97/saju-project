"""Bind a fresh armature to reviewed V8 anatomy and export a self-contained GLB.
No previous rig is imported. New output folder required. 24 fps, 6 second periodic idle.
"""
import bpy,math,json,sys,argparse,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector
from collections import defaultdict
ap=argparse.ArgumentParser();ap.add_argument('--static',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);SRC=Path(a.static).resolve();OUT=Path(a.out).resolve();assert SRC.is_file() and not OUT.exists();OUT.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(SRC));scene=bpy.context.scene;char=bpy.data.collections['Dragon_V8_New_Static_Construction'];skin=bpy.data.objects['Dragon_Continuous_Skin'];H=-1.10
P=json.loads(skin['body_centerline_json']);R=json.loads(skin['body_radii_json']);LIMBS=json.loads(skin['limb_paths_json']);limb_radius_data=json.loads(skin['limb_radii_json']);assert set(limb_radius_data)==set(LIMBS);objects=[o for o in char.objects if o.type=='MESH']
# Apply all authored object transforms to their actual geometry before copies/joins.
for o in objects:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
def catmull(vals,u):
 x=max(0,min(1,u))*(len(vals)-1);i=min(len(vals)-2,int(x));t=x-i;p0=vals[max(0,i-1)];p1=vals[i];p2=vals[i+1];p3=vals[min(len(vals)-1,i+2)]
 return .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
C=np.array([catmull(np.asarray(P),i/179) for i in range(180)]);CR=np.array([catmull(np.asarray(R),i/179) for i in range(180)])
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
spec=[('Float_Root',(0,0,.02),(0,0,.62),None),('Body_Core',P[3],P[4],'Float_Root'),('Neck',P[2],(H,.08,3.03),'Body_Core'),('Head',(H,0,3.03),(H,.16,3.94),'Neck'),('Spine_Bend',P[4],P[6],'Body_Core'),('Spine_Lower',P[6],P[8],'Spine_Bend'),('Tail_Base',P[8],P[11],'Spine_Lower'),('Tail_Mid',P[11],P[13],'Tail_Base'),('Tail_Tip',P[13],P[15],'Tail_Mid')]
for name,path in LIMBS.items():spec.append((name,path[0],path[-1],'Neck' if name.startswith('Front') else 'Spine_Lower'))
data=bpy.data.armatures.new('V8_New_Idle_Armature');rig=bpy.data.objects.new('Dragon_V8_Rig',data);char.objects.link(rig);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name,p,q,parent in spec:
 b=data.edit_bones.new(name);b.head=p;b.tail=q
 if parent:b.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;names=[x[0] for x in spec];mapping={n:i for i,n in enumerate(names)}
BODY_GROUPS=['Neck','Neck','Body_Core','Body_Core','Body_Core','Spine_Bend','Spine_Bend','Spine_Lower','Spine_Lower','Tail_Base','Tail_Base','Tail_Mid','Tail_Mid','Tail_Tip','Tail_Tip','Tail_Tip']
limb_samples={}
for name,path in LIMBS.items():
 cc=np.array([catmull(np.asarray(path),i/34) for i in range(35)]);rr=np.array([catmull(np.asarray(limb_radius_data[name]),i/34) for i in range(35)]);limb_samples[name]=(cc,rr)
def base_rows(points,limbs=True):
 d=points[:,None,:]-C[None,:,:];d[:,:,1]/=.90;ds=np.linalg.norm(d,axis=2);idx=np.argmin(ds-CR[None,:],axis=1);out=np.zeros((len(points),len(names)),dtype=float)
 for i,(p,k) in enumerate(zip(points,idx)):
  u=k/179*(len(BODY_GROUPS)-1);j=min(len(BODY_GROUPS)-2,int(u));f=smooth(u-j);out[i,mapping[BODY_GROUPS[j]]]+=1-f;out[i,mapping[BODY_GROUPS[j+1]]]+=f
  h=smooth((p[2]-2.72)/.33);out[i]*=1-h;out[i,mapping['Head']]+=h
  if limbs:
   best=None
   for n,(cc,rr) in limb_samples.items():
    distances=np.linalg.norm(cc-p[None,:],axis=1);l=int(distances.argmin());t=l/34
    s=smooth((t-.12)/.48)*(1-smooth((distances[l]-rr[l]-.012)/.14))
    s*=smooth((ds[i,idx[i]]-distances[l]+.06)/.22)
    if best is None or s>best[1]:best=(n,s)
   if best and best[1]>.00001:n,s=best;out[i]*=1-s;out[i,mapping[n]]+=s
 return out
# Radius-aware curve ownership avoids a thin tail tip stealing thick-body vertices.
points=np.array([v.co[:] for v in skin.data.vertices]);rows=base_rows(points)
# Vectorized equivalent Jacobi relaxation; broader physical transitions for the denser skin.
ends=np.empty(len(skin.data.edges)*2,dtype=np.int32);skin.data.edges.foreach_get('vertices',ends);ends=ends.reshape(-1,2)
ix=ends[:,0];iy=ends[:,1];conductance=1/np.maximum(np.sum((points[ix]-points[iy])**2,axis=1),2.5e-7)
degree=np.bincount(ix,weights=conductance,minlength=len(points))+np.bincount(iy,weights=conductance,minlength=len(points))
assert np.all(degree>0)
for step in range(96):
 accum=np.empty_like(rows)
 for channel in range(len(names)):
  accum[:,channel]=np.bincount(ix,weights=conductance*rows[iy,channel],minlength=len(points))+np.bincount(iy,weights=conductance*rows[ix,channel],minlength=len(points))
 rows=rows*.48+.52*accum/degree[:,None]

skin_rows=rows
# Four strongest influences are normalized for glTF skinning.
def apply_binding(o,w):
 for g in list(o.vertex_groups):o.vertex_groups.remove(g)
 groups=[o.vertex_groups.new(name=n) for n in names]
 for v,row in zip(o.data.vertices,w):
  ids=np.argsort(row)[-4:];den=sum(row[i] for i in ids);assert den>0
  for i in ids:
   if row[i]/den>1e-7:groups[i].add([v.index],float(row[i]/den),'REPLACE')
 o.parent=rig;mod=o.modifiers.new('V8_Idle_Deform','ARMATURE');mod.object=rig
apply_binding(skin,rows)
for o in objects:
 if o is skin:continue
 p=np.array([v.co[:] for v in o.data.vertices]);region=o.get('deform_region','Body')
 if region=='Head' and not (o.name.startswith('Head_Flame_') and np.mean(p[:,2])<2.90):
  w=np.zeros((len(p),len(names)));w[:,mapping['Head']]=1
 elif region in LIMBS:
  w=np.zeros((len(p),len(names)));w[:,mapping[region]]=1
 elif region=='Tail':
  w=np.zeros((len(p),len(names)));w[:,mapping['Tail_Tip']]=1
 elif o.name.startswith('Belly_Subtle_Fold'):
  w=[]
  for q in p:
   ok,loc,no,f=skin.closest_point_on_mesh(Vector(q));assert ok;verts=skin.data.polygons[f].vertices
   inv=np.array([1/max((skin.data.vertices[i].co-loc).length_squared,1e-7) for i in verts]);w.append(sum((skin_rows[i]*z for i,z in zip(verts,inv)))/sum(inv))
  w=np.array(w)
 else:w=base_rows(p,False)
 apply_binding(o,w)
print('V8_FRESH_RIG_AND_RADIUS_AWARE_SMOOTH_WEIGHTS_READY',len(names),flush=True)
scene.render.fps=24;scene.frame_start=0;scene.frame_end=144
for frame in range(145):
 phase=0 if frame==144 else 2*math.pi*frame/144
 for j,pb in enumerate(rig.pose.bones):
  pb.rotation_mode='XYZ';pb.location=(0,0,0);pb.rotation_euler=(0,0,0)
  n=pb.name
  if n=='Float_Root':pb.location=(0,.065*math.sin(phase),0);pb.rotation_euler=(.004*math.sin(phase),.008*math.sin(phase),.003*math.sin(phase))
  elif n=='Head':pb.rotation_euler=(.028*(math.sin(phase-.35)+math.sin(.35)),.014*(math.sin(phase+.70)-math.sin(.70)),0)
  elif n=='Neck':pb.rotation_euler=(.012*(math.sin(phase+.40)-math.sin(.40)),.007*math.sin(phase),0)
  elif n=='Body_Core':pb.rotation_euler=(.005*math.sin(phase),.004*math.sin(phase),0)
  elif n=='Spine_Bend':pb.rotation_euler=(.008*(math.sin(phase+.50)-math.sin(.50)),.009*math.sin(phase),0)
  elif n=='Spine_Lower':pb.rotation_euler=(.009*(math.sin(phase+1)-math.sin(1)),.010*math.sin(phase),0)
  elif n=='Tail_Base':pb.rotation_euler=(.016*(math.sin(phase+.70)-math.sin(.70)),.014*(math.sin(phase+1.1)-math.sin(1.1)),.006*math.sin(phase))
  elif n=='Tail_Mid':pb.rotation_euler=(.024*(math.sin(phase+1.20)-math.sin(1.20)),.021*(math.sin(phase+1.50)-math.sin(1.50)),.008*math.sin(phase))
  elif n=='Tail_Tip':pb.rotation_euler=(.034*(math.sin(phase+1.80)-math.sin(1.80)),.029*(math.sin(phase+2)-math.sin(2)),.009*math.sin(phase))
  elif n in LIMBS:pb.rotation_euler=(.017*(math.sin(phase+j*.40)-math.sin(j*.40)),0,.007*math.sin(phase))
  if n!='Float_Root':pb.rotation_euler=tuple(float(v)*.40 for v in pb.rotation_euler)
  pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=n)
  if n=='Float_Root':pb.keyframe_insert(data_path='location',frame=frame,group=n)
rig.animation_data.action.name='Idle_Loop'
# Blender 4.3 has the legacy action FCurve API, verified in this cloud.
for f in rig.animation_data.action.fcurves:
 for k in f.keyframe_points:k.interpolation='LINEAR'
for ob in objects:ob.data.calc_loop_triangles()
native_triangles=sum(len(ob.data.loop_triangles) for ob in objects)
# Preserve all reviewed cameras exactly; no camera changes during rig/export.
rig['candidate_status']='V8_NEW_RECONSTRUCTION_CANDIDATE_NOT_PRODUCT_DEFAULT_NOT_USER_APPROVED';rig['loop_seconds']=6.;rig['shape_revision']=8;rig['new_anatomy_rig']=True
rig['volume_refinement_iteration']='CLOUD_RECONSTRUCTED_V26_ROUND_EYES'
rig['reference_sha256']='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'
scene.frame_set(0);bpy.context.view_layer.update()
# All copies have identity transforms; skinned mesh nodes are scene roots.
runtime=bpy.data.collections.new('V8_Runtime_GLTF_Meshes');scene.collection.children.link(runtime);by_mat=defaultdict(list)
for o in objects:
 cp=o.copy();cp.data=o.data.copy();runtime.objects.link(cp);cp.parent=None;cp.name='Runtime_'+o.name;by_mat[o.data.materials[0].name].append(cp)
for mat,parts in by_mat.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name='Dragon_V8_'+mat
runtime_objects=list(runtime.objects)
for o in runtime_objects:
 assert all(abs(x-(1 if i in (0,5,10,15) else 0))<1e-6 for i,x in enumerate(sum((list(r) for r in o.matrix_world),[]))),'Runtime transform must remain identity'
body_material=skin.data.materials[0];body_material.diffuse_color=(1,1,1,1);body_material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,1,1,1)
text=bpy.data.texts.new('REGENERATE_bind_idle_export_v8.py');text.write(Path(__file__).read_text(encoding='utf8'))
bpy.ops.object.select_all(action='DESELECT')
for o in runtime_objects+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
opts=dict(filepath=str(OUT/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Idle.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='MATERIAL',export_all_vertex_colors=False)
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();opts={k:v for k,v in opts.items() if k in props};bpy.ops.export_scene.gltf(**opts)
runtime.hide_render=True;runtime.hide_viewport=True;scene.camera=bpy.data.objects['Camera_ThreeQuarter'];scene.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'SaJu_Dragon_Cloud_V26_Reconstructed_RoundEyes_Idle.blend'),compress=True)
r={'status':'NEW_V8_RIG_AND_GLTF_CANDIDATE_GENERATED_QA_PENDING','volume_refinement_iteration':'CLOUD_RECONSTRUCTED_V26_ROUND_EYES','binding_revision':3,'weight_relaxation_iterations':96,'local_motion_scale':.40,'float_root_motion_unchanged':True,'actual_limb_path_point_counts':{n:len(p) for n,p in LIMBS.items()},'actual_limb_radii':limb_radius_data,'static_source':str(SRC),'static_source_sha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'bones':len(names),'runtime_meshes':len(runtime_objects),'native_editable_meshes':len(objects),'triangles_native':native_triangles,'fps':24,'frames':[0,144],'loop_seconds':6,'head_neck_tail_and_paw_motion':True,'old_mesh_or_rig_imported':False,'new_rig_for_reconstructed_anatomy':True,'body_color_method':'Self-contained linear COLOR_0 attribute','skinned_nodes_are_scene_roots':True,'user_final_appearance_approved':False,'technical_checks_do_not_measure_photo_fidelity':True,'deformation_edge_guards':[.78,1.23]};(OUT/'generation-report.json').write_text(json.dumps(r,indent=2),encoding='utf8');print(json.dumps(r))
