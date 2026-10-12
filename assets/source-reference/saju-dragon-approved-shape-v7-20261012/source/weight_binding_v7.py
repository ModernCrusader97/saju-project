"""V7 radius-aware binding repair. Preserve geometry, UV, material, rig and action.
Existing fat-body vertices were assigned Tail_Tip because Euclidean centre distance
ignored the large difference between torso and tail radii. Rebind to the nearest
normalized swept volume; retain the original four-weight limit and relaxed joins.
"""
import bpy,sys,pathlib,argparse,json,hashlib,math,ast,numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
from collections import defaultdict
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--out',required=True);p.add_argument('--expected-input-sha256',required=True);p.add_argument('--generator',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);src=pathlib.Path(a.input);out=pathlib.Path(a.out);before_file=hashlib.sha256(src.read_bytes()).hexdigest();assert before_file==a.expected_input_sha256;assert not out.exists();out.mkdir();bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False)
scene=bpy.context.scene;rig=bpy.data.objects['Dragon_Rig'];skin=bpy.data.objects['Dragon_Continuous_Skin'];char=bpy.data.collections['Dragon_Approved_Candidate'];runtime=bpy.data.collections['Runtime_GLTF_Meshes'];parts=[o for o in char.objects if o.type=='MESH'];rtparts=[o for o in runtime.objects if o.type=='MESH'];allparts=parts+rtparts
h=lambda b:hashlib.sha256(b).hexdigest()
def geom(o):
 data={'vertices':[list(v.co) for v in o.data.vertices],'normals':[list(v.normal) for v in o.data.vertices],'polygons':[list(p.vertices) for p in o.data.polygons],'material_indices':[p.material_index for p in o.data.polygons],'materials':[m.name for m in o.data.materials],'world':[list(row) for row in o.matrix_world],'uv':{u.name:[list(x.uv) for x in u.data] for u in o.data.uv_layers}}
 return h(json.dumps(data,separators=(',',':')).encode())
def pose():
 data=[]
 for f in range(145):
  scene.frame_set(f);bpy.context.view_layer.update();data.append([[list(row) for row in b.matrix] for b in rig.pose.bones])
 scene.frame_set(0);bpy.context.view_layer.update();return h(json.dumps(data,separators=(',',':')).encode())
geometry_before={o.name:geom(o) for o in allparts};pose_before=pose();images_before={im.name:h(im.packed_file.data) for im in bpy.data.images if im.packed_file};original_pose_position=rig.data.pose_position;rig.data.pose_position='REST';bpy.context.view_layer.update()
module=ast.parse(pathlib.Path(a.generator).read_text(encoding='utf8'));funcs=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ('catmull','sample_path','frames','skin_weights')];assert len(funcs)==4;exec(compile(ast.Module(body=funcs,type_ignores=[]),a.generator,'exec'))
BODY_P=json.loads(rig['body_centerline_json']);BODY_R=json.loads(rig['body_radii_json']);BODY_GROUPS=['Neck','Neck','Neck','Body_Core','Body_Core','Spine_Bend','Spine_Bend','Spine_Lower','Spine_Lower','Tail_Base','Tail_Base','Tail_Mid','Tail_Mid','Tail_Tip','Tail_Tip'];BC,BR=sample_path(BODY_P,BODY_R,180);BN,BB=frames(BC);centers=np.array([list(x) for x in BC],dtype=np.float64);radii=np.array(BR,dtype=np.float64);LIMBS=json.loads(rig['limb_paths_json']);limb_samples={name:sample_path(q,[.30,.265,.23],32) for name,q in LIMBS.items()};kd=KDTree(len(BC))
for i,pt in enumerate(BC):kd.insert(pt,i)
kd.balance()
def normalized_curve_parameter(point):
 pp=np.array(point,dtype=np.float64);delta=pp-centers;delta[:,1]/=.90;j=int(np.argmin(np.sum(delta*delta,axis=1)/(radii*radii)))
 best=None
 for k in range(max(0,j-1),min(len(BC)-1,j+1)):
  v=centers[k+1]-centers[k];v=v.copy();v[1]/=.90;rel=pp-centers[k];rel[1]/=.90;t=float(np.clip(np.dot(rel,v)/np.dot(v,v),0,1));r=BR[k]*(1-t)+BR[k+1]*t;score=float(np.sum((rel-v*t)**2)/(r*r))
  if best is None or score<best[0]:best=(score,k,t)
 return (best[1]+best[2])/(len(BC)-1)
def base_weights(point):
 x=normalized_curve_parameter(point)*(len(BODY_GROUPS)-1);i=min(len(BODY_GROUPS)-2,int(x));f=x-i;f=f*f*(3-2*f);w=defaultdict(float);w[BODY_GROUPS[i]]+=1-f;w[BODY_GROUPS[i+1]]+=f
 head_x=float(np.clip((-point.x-.04)/.42,0,1));strength=max(0,min(1,(point.z-2.82)/.24))*head_x*head_x*(3-2*head_x)
 if strength>0:w={k:v*(1-strength) for k,v in w.items()};w['Head']=w.get('Head',0)+strength
 return w
def assign(o,rows):
 ids=list(range(len(o.data.vertices)))
 for group in o.vertex_groups:group.remove(ids)
 groups={g.name:g for g in o.vertex_groups}
 for v,row in zip(o.data.vertices,rows):
  limited=sorted(row.items(),key=lambda q:q[1],reverse=True)[:4];total=sum(val for _,val in limited);assert total>0
  for name,val in limited:
   if val/total<.00001:continue
   if name not in groups:groups[name]=o.vertex_groups.new(name=name)
   groups[name].add([v.index],val/total,'REPLACE')
 for v in o.data.vertices:assert abs(sum(g.weight for g in v.groups)-1)<.0001 and len(v.groups)<=4
rows=[skin_weights(skin.matrix_world@v.co,True) for v in skin.data.vertices];adj=[set() for _ in rows]
for edge in skin.data.edges:
 x,y=edge.vertices;adj[x].add(y);adj[y].add(x)
conductance=[]
for i,neighbors in enumerate(adj):
    values={j:1/max((skin.data.vertices[i].co-skin.data.vertices[j].co).length_squared,1e-12) for j in neighbors}
    total=sum(values.values());conductance.append({j:val/total for j,val in values.items()} if total else {})
for step in range(12):
 nxt=[]
 for i,neighbors in enumerate(adj):
  mixed=defaultdict(float)
  for k,val in rows[i].items():mixed[k]+=.48*val
  if neighbors:
   for j in neighbors:
    for k,val in rows[j].items():mixed[k]+=.52*val*conductance[i][j]
  else:
   for k,val in rows[i].items():mixed[k]+=.52*val
  nxt.append(dict(mixed))
 rows=nxt
assign(skin,rows);print('RADIUS_AWARE_BODY_WEIGHTS_READY',flush=True)
rebound=[skin.name];rigid_preserved=[]
for o in parts:
 if o==skin:continue
 used={g.group for v in o.data.vertices for g in v.groups if g.weight>.00001}
 if len(used)<=1:rigid_preserved.append(o.name);continue
 if o.name.startswith(('Belly_Fold','Surface_')):
  rows=[]
  for v in o.data.vertices:
   pt=o.matrix_world@v.co;ok,cp,no,index=skin.closest_point_on_mesh(pt);assert ok;mixed=defaultdict(float)
   for vi in skin.data.polygons[index].vertices:
    vv=skin.data.vertices[vi];influence=1/max((vv.co-cp).length**2,.000001)
    for item in vv.groups:mixed[skin.vertex_groups[item.group].name]+=item.weight*influence
   rows.append(dict(mixed))
 else:rows=[skin_weights(o.matrix_world@v.co,False) for v in o.data.vertices]
 assign(o,rows);rebound.append(o.name)
print('NATIVE_ACCESSORY_BINDINGS_READY',len(rebound),flush=True)
# Transfer updated native weights to unchanged runtime copies by exact rest points.
count=sum(len(o.data.vertices) for o in parts);source_tree=KDTree(count);weight_rows=[];n=0
for o in parts:
 for v in o.data.vertices:
  source_tree.insert(o.matrix_world@v.co,n);weight_rows.append({o.vertex_groups[g.group].name:g.weight for g in v.groups});n+=1
source_tree.balance();maximum_match_error=0.0
for o in rtparts:
 mapped=[]
 for v in o.data.vertices:
  point,index,distance=source_tree.find(o.matrix_world@v.co);maximum_match_error=max(maximum_match_error,float(distance));assert distance<.000005,(o.name,v.index,distance);mapped.append(weight_rows[index])
 assign(o,mapped)
rig.data.pose_position=original_pose_position;scene.frame_set(0);bpy.context.view_layer.update()
geometry_after={o.name:geom(o) for o in allparts};assert geometry_before==geometry_after,'Positions/normals/topology/UV/materials/object transforms changed';pose_after=pose();assert pose_before==pose_after,'Rig or 145-frame action changed';images_after={im.name:h(im.packed_file.data) for im in bpy.data.images if im.packed_file};assert images_before==images_after
rig['body_weight_assignment']='Normalized elliptical distance to continuous swept body volumes, with 12-pass distance-aware relaxed shoulders and maximum four normalized influences'
text=bpy.data.texts.new('shape_weight_binding_v7.py');text.write(pathlib.Path(__file__).read_text(encoding='utf8'));text.use_fake_user=True
runtime.hide_viewport=False;runtime.hide_render=False;bpy.ops.object.select_all(action='DESELECT')
for o in rtparts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
opts=dict(filepath=str(out/'SaJu_Dragon_Approved_Shape_v7.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in opts.items() if k in props});runtime.hide_viewport=True;runtime.hide_render=True;bpy.ops.wm.save_as_mainfile(filepath=str(out/'SaJu_Dragon_Approved_Shape_v7.blend'),compress=True)
report={'status':'RADIUS_AWARE_V7_WEIGHT_REPAIR_GENERATED_VERIFY_JOINTS_NEXT','input_blend_sha256':before_file,'geometry_normals_topology_uv_materials_exact_unchanged':True,'verified_mesh_objects':len(allparts),'rig_145_pose_matrices_exact_unchanged':True,'pose_sha256':pose_before,'packed_images_exact_unchanged':images_before,'max_influences':4,'weights_normalized':True,'rebound_native_meshes':rebound,'rigid_bone_bound_meshes_preserved':rigid_preserved,'runtime_rest_vertex_match_max_error':maximum_match_error,'cause':'Euclidean closest-centre weighting ignored torso/tail radius; Tail_Tip leaked onto the plump Spine_Bend surface. Normalized elliptical sweep distance prevents remote thin-tail ownership.','animation_amplitudes_reduced':False,'distance_aware_inverse_squared_edge_conductance':True,'head_gate_smooth_x_range':[-.46,-.04],'source_original_unchanged':h(src.read_bytes())==before_file}
with (out/'weight-binding-repair-report.json').open('x',encoding='utf8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report),flush=True)