import bpy, math, os, json, hashlib
from mathutils import Vector
P=os.path.dirname(os.path.abspath(__file__)); SRC=os.path.dirname(P)+'/source/candidate_5.blend'
bpy.ops.wm.open_mainfile(filepath=SRC); s=bpy.context.scene; s.frame_set(1)
rig=bpy.data.objects['B_shared_gesture_rig']; rig.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
for p in rig.pose.bones:
 p.location=(0,0,0);p.rotation_euler=(0,0,0);p.scale=(1,1,1)
rig.pose.bones['surprise_mouth'].scale=(.001,.001,.001)
body=bpy.data.objects['B | continuous core without fused paddles']; arms=[bpy.data.objects['Candidate 5 attached arm '+x] for x in ['L','R']]
# Remove arm endpoint keys only on this new copy, freeze source transforms in neutral.
for o in [body]+arms:
 o.parent=None
 for m in list(o.modifiers):o.modifiers.remove(m)
 if o.data.shape_keys: o.shape_key_clear()
bpy.ops.object.select_all(action='DESELECT')
for o in [body]+arms:o.select_set(True)
bpy.context.view_layer.objects.active=body; bpy.ops.object.join(); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.name='B candidate5 reconstructed | seamless body and mittens'
body.data.materials.clear()
rem=body.modifiers.new('Continuous welded surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.014;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=body.modifiers.new('Quiet seam smoothing','SMOOTH');sm.factor=.46;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
# Smooth only the shoulder union to remove the visible welded crease.
vg=body.vertex_groups.new(name='Shoulder soft blend')
for v in body.data.vertices:
 x,y,z=v.co;wx=max(0,1-abs(abs(x)-.43)/.24);wz=max(0,1-abs(z-1.16)/.22);vg.add([v.index],wx*wz,'REPLACE')
sm=body.modifiers.new('Seamless shoulder transition','SMOOTH');sm.factor=.58;sm.iterations=14;sm.vertex_group=vg.name;bpy.ops.object.modifier_apply(modifier=sm.name)
# Keep closed topology with moderate render/export budget.
dec=body.modifiers.new('Uniform surface budget','DECIMATE');dec.ratio=.52;bpy.ops.object.modifier_apply(modifier=dec.name)
for p in body.data.polygons:p.use_smooth=True
# Remove orphan rig-controlled surprise mouth, leaving exact neutral face layout.
for o in list(s.objects):
 if o.name=='B | surprise O mouth':bpy.data.objects.remove(o,do_unlink=True)
 elif o.parent==rig:
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
  for m in list(o.modifiers):
   if m.type=='ARMATURE':o.modifiers.remove(m)
bpy.data.objects.remove(rig,do_unlink=True)
# A smooth deformation field follows the selected candidate5 centreline.
base=[Vector(p) for p in [( .34,-.08,1.17),(.58,-.11,1.08),(.68,-.15,.92),(.75,-.19,.71)]]
poses={
 'wave':[(.34,-.08,1.17),(.60,-.12,1.14),(.93,-.22,1.32),(.94,-.29,1.60)],
 'open':[(.34,-.08,1.17),(.60,-.11,1.14),(.89,-.17,1.17),(1.10,-.22,1.17)],
 'gather':[(.34,-.08,1.17),(.67,-.30,1.14),(.52,-.57,1.00),(.19,-.65,1.11)]}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def point(ps,t):return (1-t)**3*ps[0]+3*(1-t)**2*t*ps[1]+3*(1-t)*t*t*ps[2]+t**3*ps[3]
def basis(ps,t):
 tan=(3*(1-t)**2*(ps[1]-ps[0])+6*(1-t)*t*(ps[2]-ps[1])+3*t*t*(ps[3]-ps[2])).normalized()
 wide=Vector((tan.z,0,-tan.x)).normalized();depth=tan.cross(wide).normalized();return tan,wide,depth
samples=[(i/100,point(base,i/100)) for i in range(101)]
body.shape_key_add(name='Basis')
for mode,coords in poses.items():
 target=[Vector(p) for p in coords];key=body.shape_key_add(name=mode)
 for v in key.data:
  orig=v.co.copy();side=1 if orig.x>=0 else -1
  if mode=='wave' and side<0:continue
  q=Vector((abs(orig.x),orig.y,orig.z))
  if q.x<.36 or q.z>1.41 or q.z<.45:continue
  t,c=min(samples,key=lambda tc:(q-tc[1]).length_squared)
  lo=max(0,t-.025);hi=min(1,t+.025)
  for _ in range(22):
   t1=(2*lo+hi)/3;t2=(lo+2*hi)/3
   if (point(base,t1)-q).length_squared < (point(base,t2)-q).length_squared:hi=t2
   else:lo=t1
  t=(lo+hi)/2;c=point(base,t)
  a,w,d=basis(base,t);b,tw,td=basis(target,t);off=q-c
  moved=point(target,t)+b*off.dot(a)+tw*off.dot(w)+td*off.dot(d)
  weight=smooth((q.x-.43)/.15)*smooth((1.41-q.z)/.19)*smooth((q.z-.48)/.14)*smooth((.27-(q-c).length)/.07)*smooth(t/.18)
  new=q.lerp(moved,weight);v.co=(new.x*side,new.y,new.z)
 key.value=0
# Morph clips remain explicitly a new motion study, not a recovered original skeleton.
keys=body.data.shape_keys
for mode in poses:
 keys.animation_data_create();act=bpy.data.actions.new(mode);keys.animation_data.action=act
 for k in keys.key_blocks:
  if k.name=='Basis':continue
  for f,value in [(1,0),(12,1 if k.name==mode else 0),(28,1 if k.name==mode else 0),(40,0)]:
   k.value=value;k.keyframe_insert(data_path='value',frame=f)
 for fc in act.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='BEZIER'
 act.use_fake_user=True
keys.animation_data.action=None
for k in keys.key_blocks:k.value=0
# Jade node graph: coloured mass with broad cloudy inclusions, no stripe/soap finish.
def jade(glow):
 m=bpy.data.materials.new('Deep cloudy jade '+('green mineral light' if glow else 'unlit control'));m.use_nodes=True;n=m.node_tree.nodes;n.clear();l=m.node_tree.links
 out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');l.new(p.outputs['BSDF'],out.inputs['Surface'])
 p.inputs['Roughness'].default_value=.24;p.inputs['Metallic'].default_value=0;p.inputs['IOR'].default_value=1.54;p.inputs['Transmission Weight'].default_value=.14;p.inputs['Subsurface Weight'].default_value=.12;p.inputs['Subsurface Radius'].default_value=(.15,.42,.10);p.inputs['Coat Weight'].default_value=.25;p.inputs['Coat Roughness'].default_value=.15
 tex=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4.3;noise.inputs['Detail'].default_value=3.2;noise.inputs['Roughness'].default_value=.65;l.new(tex.outputs['Generated'],noise.inputs['Vector'])
 ramp=n.new('ShaderNodeValToRGB');r=ramp.color_ramp;r.elements.remove(r.elements[1]);r.elements[0].position=.2;r.elements[0].color=(.002,.015,.006,1)
 for pos,c in [(.41,(.008,.08,.025,1)),(.56,(.025,.23,.065,1)),(.70,(.14,.46,.21,1)),(.84,(.34,.65,.38,1))]:r.elements.new(pos).color=c
 l.new(noise.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
 # Very fine polish variation, small enough to read as mineral rather than stone grit.
 fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=160;fine.inputs['Detail'].default_value=2;l.new(tex.outputs['Generated'],fine.inputs['Vector']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.10;bump.inputs['Distance'].default_value=.002;l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
 if glow:
  er=n.new('ShaderNodeValToRGB');er.color_ramp.elements[0].position=.57;er.color_ramp.elements[0].color=(0,0,0,1);er.color_ramp.elements[1].position=.79;er.color_ramp.elements[1].color=(.13,1,.22,1);l.new(noise.outputs['Fac'],er.inputs['Fac']);l.new(er.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.5
 return m
jade0=jade(False);jade1=jade(True)
# New glass control is intentionally labeled; not claimed identical to inaccessible old shader.
glass=bpy.data.materials.new('New rose glass control');glass.use_nodes=True;p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.72,.15,.28,1);p.inputs['Roughness'].default_value=.14;p.inputs['Transmission Weight'].default_value=.62;p.inputs['IOR'].default_value=1.46;p.inputs['Coat Weight'].default_value=.3
body.data.materials.append(jade1)
# Original facial objects retained; dark ink remains legible against jade.
for m in bpy.data.materials:
 if m.name=='Deep teal expression':
  p=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
  if p:p.inputs['Base Color'].default_value=(.001,.010,.006,1);p.inputs['Roughness'].default_value=.33
s.render.resolution_x=600;s.render.resolution_y=600;s.render.resolution_percentage=100;s.cycles.samples=48;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=2
s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX';s.frame_start=1;s.frame_end=40;s.render.fps=16
# Slightly warmer neutral studio, identical across each material control.
s['provenance']='New reconstruction from accessible candidate_5.blend; not recovered October4 finished master.'
s['limitations']='Three morph motion studies; no production skeleton, browser or Unity validation; new jade/glass shaders, not byte-identical earlier materials.'
bpy.ops.wm.save_as_mainfile(filepath=P+'/B_candidate5_rebuilt_jade_v003.blend')
audit={'source':os.path.relpath(SRC,P),'source_sha256':hashlib.sha256(open(SRC,'rb').read()).hexdigest(),'new_version':True,'original_final_recovered':False,'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'poses':list(poses),'limitations':s['limitations']}
json.dump(audit,open(P+'/build_audit_v003.json','w'),indent=2)
print('NEW_JADE_REBUILD_SAVED',audit,flush=True)
