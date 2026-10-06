import bpy,os,json,fcntl,numpy as np,hashlib
from PIL import Image
P=os.path.dirname(os.path.abspath(__file__));T=P+'/runtime/textures';os.makedirs(T,exist_ok=True);params=json.load(open(P+'/flow_parameters_v002.json'))
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=1;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.pixel_filter_type='BOX';s.render.filter_size=.01;s.render.threads_mode='FIXED';s.render.threads=2
bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.scale.y=.5;mat=bpy.data.materials.new('Three fixed native noise fields');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();l=mat.node_tree.links;out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');l.new(em.outputs[0],out.inputs['Surface']);plane.data.materials.append(mat);tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['UV'],sep.inputs[0])
def op(kind,a,b=None):
 q=n.new('ShaderNodeMath');q.operation=kind
 for i,v in enumerate([a,b] if b is not None else [a]):
  if isinstance(v,(float,int)):q.inputs[i].default_value=v
  else:l.new(v,q.inputs[i])
 return q.outputs[0]
u=op('MULTIPLY',sep.outputs['X'],16);v=op('MULTIPLY',sep.outputs['Y'],8);x=op('DIVIDE',op('SUBTRACT',op('MULTIPLY',op('FRACT',u),128),.5),127);y=op('DIVIDE',op('SUBTRACT',op('MULTIPLY',op('FRACT',v),128),.5),127);z=op('DIVIDE',op('ADD',op('FLOOR',u),op('MULTIPLY',op('FLOOR',v),16)),127);coords=n.new('ShaderNodeCombineXYZ')
for i,c in enumerate([x,y,z]):l.new(c,coords.inputs[i])
color=n.new('ShaderNodeCombineColor');color.mode='RGB';l.new(color.outputs[0],em.inputs['Color']);adds=[]
for i,offset in enumerate(params['fixed_field_offsets']):
 add=n.new('ShaderNodeVectorMath');add.operation='ADD';add.inputs[1].default_value=offset;l.new(coords.outputs[0],add.inputs[0]);adds.append(add)
 noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions=params['noise_dimensions'];noise.noise_type=params['noise_type'];noise.normalize=params['noise_normalize']
 for key,val in params['noise_inputs'].items():
  if key in noise.inputs:noise.inputs[key].default_value=val
 l.new(add.outputs[0],noise.inputs['Vector']);l.new(noise.outputs['Fac'],color.inputs[i])
camd=bpy.data.cameras.new('Data camera');cam=bpy.data.objects.new('Data camera',camd);s.collection.objects.link(cam);cam.location=(0,0,2);camd.type='ORTHO';camd.ortho_scale=2;s.camera=cam;s.render.resolution_x=2048;s.render.resolution_y=1024;s.render.resolution_percentage=100;s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='32';s.render.image_settings.color_mode='RGB';s.render.filepath=T+'/jade_fields_atlas_native.exr'
with open('/tmp/sa-ww2-render.lock','w') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
im=bpy.data.images.load(s.render.filepath,check_existing=False);a=np.asarray(im.pixels[:],dtype=np.float32).reshape(1024,2048,4)[:,:,:3];rgba=np.empty((1024,2048,4),dtype=np.uint8);rgba[:,:,:3]=np.rint(np.clip(a,0,1)*255).astype(np.uint8);rgba[:,:,3]=255;rgba.tofile(T+'/jade_fields_atlas_128.rgba8');Image.fromarray(rgba).save(T+'/jade_fields_atlas_128.png')
meta={'version':2,'dimension':128,'columns':16,'rows':8,'width':2048,'height':1024,'domainMin':[0,0,0],'domainMax':[1,1,1],'sampleGrid':'grid endpoints i/127','sourceRow0':'z-tile-row0; within-tile y-minimum; source rows increase toward y maximum','pixelFormat':'interleaved RGBA8;R=fieldA,G=fieldB,B=fieldC,A=255;normalizeRGBby255','atlasPng':'jade_fields_atlas_128.png','atlasRaw':'jade_fields_atlas_128.rgba8','raw_sha256':hashlib.sha256(rgba.tobytes()).hexdigest(),'fixed_field_offsets':params['fixed_field_offsets'],'noise':params['noise_inputs'],'source':'Three exact native Blender noise fields at fixed independent offsets; positions never depend on time.'}
json.dump(meta,open(P+'/runtime/atlas-metadata.json','w'),indent=2);print('TRIPLET_ATLAS_DONE',json.dumps(meta),flush=True)
rng=np.random.default_rng(20261006);points=rng.uniform(0,1,(256,3));points[:8]=np.array([[x,y,z] for x in [0,1] for y in [0,1] for z in [0,1]]);im2=bpy.data.images.new('Native probe coordinates',width=256,height=1,float_buffer=True,alpha=True);im2.colorspace_settings.name='Non-Color';pixels=np.column_stack([points,np.ones(256)]).astype(np.float32);im2.pixels.foreach_set(pixels.ravel());im2.update();tn=n.new('ShaderNodeTexImage');tn.image=im2;tn.interpolation='Closest';tn.extension='EXTEND';l.new(tex.outputs['UV'],tn.inputs['Vector'])
for add in adds:l.new(tn.outputs['Color'],add.inputs[0])
plane.scale.y=4/256;s.render.resolution_x=256;s.render.resolution_y=4;s.render.filepath=T+'/jade_fields_native_probes.exr'
with open('/tmp/sa-ww2-render.lock','w') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
im3=bpy.data.images.load(s.render.filepath,check_existing=False);val=np.asarray(im3.pixels[:],dtype=np.float32).reshape(im3.size[1],256,4)[im3.size[1]//2,:,:3];json.dump({'points':points.tolist(),'nativeValues':val.tolist()},open(P+'/runtime/native-field-probes.json','w'));print('NATIVE_TRIPLET_PROBES_DONE',flush=True)
