import bpy,os,json,math,fcntl,numpy as np,hashlib
from PIL import Image
P=os.path.dirname(os.path.abspath(__file__));T=P+'/runtime/textures';os.makedirs(T,exist_ok=True);params=json.load(open(P+'/flow_parameters.json'))
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=1;s.cycles.use_adaptive_sampling=False;s.cycles.use_denoising=False;s.cycles.pixel_filter_type='BOX';s.render.filter_size=.01;s.render.threads_mode='FIXED';s.render.threads=2
bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.scale.y=.5
mat=bpy.data.materials.new('Exact Blender noise-field data');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();l=mat.node_tree.links;out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');em.inputs['Strength'].default_value=1;l.new(em.outputs[0],out.inputs['Surface']);plane.data.materials.append(mat)
tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['UV'],sep.inputs[0])
def op(kind,a,b=None):
 q=n.new('ShaderNodeMath');q.operation=kind
 for i,v in enumerate([a,b] if b is not None else [a]):
  if isinstance(v,(float,int)):q.inputs[i].default_value=v
  else:l.new(v,q.inputs[i])
 return q.outputs[0]
u=op('MULTIPLY',sep.outputs['X'],16);v=op('MULTIPLY',sep.outputs['Y'],8)
x=op('DIVIDE',op('SUBTRACT',op('MULTIPLY',op('FRACT',u),128),.5),127);y=op('DIVIDE',op('SUBTRACT',op('MULTIPLY',op('FRACT',v),128),.5),127);z=op('DIVIDE',op('ADD',op('FLOOR',u),op('MULTIPLY',op('FLOOR',v),16)),127)
coord=n.new('ShaderNodeCombineXYZ')
for i,sock in enumerate([x,y,z]):l.new(sock,coord.inputs[i])
scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1.4,1.25,1.4);l.new(coord.outputs[0],scale.inputs[0]);shift=n.new('ShaderNodeVectorMath');shift.operation='ADD';shift.inputs[1].default_value=(-.2,-.05,-.3);l.new(scale.outputs[0],shift.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions=params['noise_dimensions'];noise.noise_type=params['noise_type'];noise.normalize=params['noise_normalize']
for k,val in params['noise_inputs'].items():
 if k in noise.inputs:noise.inputs[k].default_value=val
l.new(shift.outputs[0],noise.inputs['Vector']);l.new(noise.outputs['Fac'],em.inputs['Color'])
camd=bpy.data.cameras.new('Data camera');cam=bpy.data.objects.new('Data camera',camd);s.collection.objects.link(cam);cam.location=(0,0,2);camd.type='ORTHO';camd.ortho_scale=2;s.camera=cam;s.render.resolution_x=2048;s.render.resolution_y=1024;s.render.resolution_percentage=100;s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_depth='32';s.render.image_settings.color_mode='RGB';s.render.filepath=T+'/jade_field_atlas_native.exr'
# 256 independently sampled golden probes, via the same native shader and floating-point coordinate image.
rng=np.random.default_rng(20261006);points=rng.uniform(0,1,(256,3))*np.array([1.4,1.25,1.4])+np.array([-.2,-.05,-.3]);points[:8]=np.array([[x,y,z] for x in [-.2,1.2] for y in [-.05,1.2] for z in [-.3,1.1]])
im2=bpy.data.images.new('Probe coordinates',width=256,height=1,float_buffer=True,alpha=True);im2.colorspace_settings.name='Non-Color';pixels=np.column_stack([points,np.ones(256)]).astype(np.float32);im2.pixels.foreach_set(pixels.ravel());im2.update();tn=n.new('ShaderNodeTexImage');tn.image=im2;tn.interpolation='Closest';tn.extension='EXTEND';l.new(tex.outputs['UV'],tn.inputs['Vector']);l.new(tn.outputs['Color'],noise.inputs['Vector']);plane.scale.y=4/256;s.render.resolution_x=256;s.render.resolution_y=4;s.render.filepath=T+'/jade_field_probes_native_v2.exr'
with open('/tmp/sa-ww2-render.lock','w') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
result=bpy.data.images.load(s.render.filepath,check_existing=False);vals=np.asarray(result.pixels[:],dtype=np.float32).reshape(result.size[1],256,4)[result.size[1]//2,:,0];json.dump({'points':points.tolist(),'nativeValues':vals.tolist()},open(P+'/runtime/native-field-probes.json','w'));print('GOLDEN_NATIVE_PROBES_DONE',flush=True)
