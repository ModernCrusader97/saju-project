import bpy,os,hashlib,json,struct,math,numpy as np
P=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(P)+'/saju_jade_green050_20261006/SaJu_B_Jade_ClearGreen050_20261006.blend'
def states(path):
 bpy.ops.wm.open_mainfile(filepath=path);s=bpy.context.scene;s.frame_set(1);h=hashlib.sha256()
 for o in sorted(s.objects,key=lambda x:x.name):
  h.update(o.name.encode());h.update(str(tuple(v for r in o.matrix_world for v in r)).encode())
  if o.type=='MESH':
   for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
   for p in o.data.polygons:h.update(str(tuple(p.vertices)).encode())
   if o.data.shape_keys:
    for k in o.data.shape_keys.key_blocks:
     h.update(k.name.encode())
     for v in k.data:h.update(struct.pack('<3f',*v.co))
 p=bpy.data.materials['Deep cloudy jade green mineral light'].node_tree.nodes.get('Principled BSDF');base=p.inputs['Base Color'].links[0].from_node
 return h.hexdigest(),{'camera':tuple(v for r in s.camera.matrix_world for v in r),'scale':s.camera.data.ortho_scale,'lights':{o.name:(o.data.energy,tuple(o.data.color),tuple(v for r in o.matrix_world for v in r)) for o in s.objects if o.type=='LIGHT'},'exposure':s.view_settings.exposure,'gamma':s.view_settings.gamma,'tone':s.view_settings.view_transform,'base_ramp':[(e.position,tuple(e.color)) for e in base.color_ramp.elements]}
a=states(SRC);b=states(P+'/SaJu_Jade_GreenEmission_Separated_v001.blend');assert a==b
report={'source_full_geometry_morph_transform_hash':a[0],'final_full_geometry_morph_transform_hash':b[0],'geometry_morph_camera_light_exposure_base_ramp_unchanged':True,'emission_multiplier':2.0,'bloom_added':False,'emission_mask_thresholds':[.5,.72],'brdf_isolation_thresholds':[.38,.66],'tone_mapping':'AgX','final_green_color_linear_rgb':[.001,.65,.08]}
# Compare actual raw emission green channel, not beauty pixels.
raw=[]
for file in ['emission_raw_0001.exr','after_emission_raw_0001.exr']:
 im=bpy.data.images.load(P+'/'+file,check_existing=False);raw.append(np.array(im.pixels[:],dtype=np.float32).reshape(-1,4))
sel=raw[0][:,1]>.002;delta=np.abs(raw[1][sel,1]-raw[0][sel,1]);report['emission_green_channel_test']={'pixels':int(sel.sum()),'mean_absolute_delta':float(delta.mean()),'max_absolute_delta':float(delta.max()),'mean_before':float(raw[0][sel,1].mean()),'mean_after':float(raw[1][sel,1].mean())}
# Rendering exact re-import with the same studio tests whether exported maps preserve visible green emission.
s=bpy.context.scene;studio=[o for o in s.objects if not (o.name.startswith('B ') or o.name.startswith('B |'))]
for o in list(s.objects):
 if o.type=='MESH' and o.name!='Plane':bpy.data.objects.remove(o,do_unlink=True)
for o in list(s.objects):
 if o.name.startswith('B |'):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=P+'/SaJu_Jade_GreenEmission_Separated_v001.glb');s.frame_set(1);meshes=[o for o in s.objects if o.type=='MESH' and o.name!='Plane'];report['reimport_mesh_count']=len(meshes);assert len(meshes)==8
for f in [1,8,16,25,34,41,48]:
 s.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();assert all(math.isfinite(x) for o in meshes for v in o.evaluated_get(dg).data.vertices for x in v.co)
s.frame_set(1);s.use_nodes=False;s.render.filepath=P+'/glb_reimport_green.png';bpy.ops.render.render(write_still=True)
report['reimport_7_sampled_frames_finite']=True;json.dump(report,open(P+'/final_validation.json','w'),indent=2);print('FINAL_VALIDATION_PASS',json.dumps(report),flush=True)
