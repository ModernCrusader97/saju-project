import bpy,os,math,json,time,fcntl,hashlib,sys
P=os.environ.get('SAJU_OUTPUT_DIR',os.path.dirname(os.path.abspath(__file__)));os.makedirs(P+'/frames',exist_ok=True);SRC=os.environ.get('SAJU_APPROVED_SOURCE',os.path.dirname(P)+'/saju_green_emission_separation_v001/SaJu_Jade_GreenEmission_Separated_v001.blend');bpy.ops.wm.open_mainfile(filepath=SRC);s=bpy.context.scene;s.frame_set(1);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];body.data.shape_keys.animation_data_clear()
for k in body.data.shape_keys.key_blocks:k.value=0
m=bpy.data.materials['Deep cloudy jade green mineral light'];n=m.node_tree.nodes;l=m.node_tree.links;mask=n.get('Same mineral emission mask');iso=n.get('Smooth BRDF isolation without changing luminous pattern');original=mask.inputs['Fac'].links[0].from_node;vec=original.inputs['Vector'].links[0].from_socket
fields=[original];offsets=[(0,0,0),(5.21,8.73,2.91),(-7.43,3.17,11.61)]
for idx,offset in enumerate(offsets[1:],1):
 noise=n.new('ShaderNodeTexNoise');noise.name='Fixed independent cloud field '+str(idx)
 for prop in ['noise_dimensions','noise_type','normalize']:setattr(noise,prop,getattr(original,prop))
 for sock in original.inputs:
  if hasattr(sock,'default_value') and sock.name in noise.inputs:noise.inputs[sock.name].default_value=sock.default_value
 add=n.new('ShaderNodeVectorMath');add.operation='ADD';add.name='STATIC field offset '+str(idx);add.inputs[1].default_value=offset;l.new(vec,add.inputs[0]);l.new(add.outputs[0],noise.inputs['Vector']);fields.append(noise)
def op(operation,a,b):
 o=n.new('ShaderNodeMath');o.operation=operation
 for i,x in enumerate([a,b]):
  if isinstance(x,(int,float)):o.inputs[i].default_value=x
  else:l.new(x,o.inputs[i])
 return o.outputs[0]
phase=n.new('ShaderNodeValue');phase.name='Evolution phase | simple arithmetic driver';fc=phase.outputs[0].driver_add('default_value');fc.driver.type='SCRIPTED';fc.driver.expression='(frame-1)/24';expr=[fc.driver.expression];wrap=n.new('ShaderNodeMath');wrap.operation='MODULO';wrap.name='Shader-only phase wrap';wrap.inputs[1].default_value=3;l.new(phase.outputs[0],wrap.inputs[0])
segment=n.new('ShaderNodeMath');segment.operation='FLOOR';l.new(wrap.outputs[0],segment.inputs[0]);u=n.new('ShaderNodeMath');u.operation='FRACT';l.new(wrap.outputs[0],u.inputs[0]);e=op('MULTIPLY',op('MULTIPLY',u.outputs[0],u.outputs[0]),op('SUBTRACT',3,op('MULTIPLY',2,u.outputs[0])));angle=op('MULTIPLY',e,math.pi/2)
cosine=n.new('ShaderNodeMath');cosine.operation='COSINE';l.new(angle,cosine.inputs[0]);sine=n.new('ShaderNodeMath');sine.operation='SINE';l.new(angle,sine.inputs[0]);weights=[]
for i in range(3):
 switches=[]
 for index in [i,(i-1)%3]:
  comp=n.new('ShaderNodeMath');comp.operation='COMPARE';comp.inputs[1].default_value=index;comp.inputs[2].default_value=.01;l.new(segment.outputs[0],comp.inputs[0]);switches.append(comp.outputs[0])
 weight=op('ADD',op('MULTIPLY',cosine.outputs[0],switches[0]),op('MULTIPLY',sine.outputs[0],switches[1]));weight.node.name='Evolution weight '+str(i);weights.append(weight.node)
terms=[op('MULTIPLY',op('SUBTRACT',f.outputs['Fac'],.5),w.outputs[0]) for f,w in zip(fields,weights)];total=op('ADD',op('ADD',terms[0],terms[1]),terms[2]);out=op('ADD',total,.5);out.node.name='Locally evolving field | coordinates never animate';out.node.use_clamp=True;l.new(out,mask.inputs['Fac']);l.new(out,iso.inputs['Fac'])
s.frame_start=1;s.frame_end=72;s.render.fps=12;s.render.resolution_x=320;s.render.resolution_y=320;s.render.resolution_percentage=100;s.cycles.samples=24;s.cycles.use_denoising=False;s.cycles.use_animated_seed=False;s.render.threads_mode='FIXED';s.render.threads=2;s.use_nodes=False;s.frame_set(1);bpy.context.view_layer.update()
params={'version':2,'period_seconds':6,'fps':12,'frames_per_loop':72,'time_dependent_coordinate_translation':False,'fixed_field_offsets':offsets,'field_formula':'clamp(0.5 + dot(weights, fields-0.5),0,1)','weights_formula':'segment=floor(wrap(t,6)/2);u=fract(wrap(t,6)/2);a=pi/2*u*u*(3-2*u);w[segment]=cos(a);w[next]=sin(a);other=0','weight_squared_sum':1,'emission_strength':2,'emission_rgb_linear':[.001,.65,.08],'emission_thresholds':[.5,.72],'reflection_isolation_thresholds':[.38,.66],'noise_inputs':{i.name:list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value for i in original.inputs if hasattr(i,'default_value') and i.name!='Vector'},'noise_dimensions':original.noise_dimensions,'noise_type':original.noise_type,'noise_normalize':original.normalize,'texspace_location':list(body.data.texspace_location),'texspace_half_size':list(body.data.texspace_size),'glb_shader_animation_supported':False,'source_native':SRC,'driver_expressions':expr}
json.dump(params,open(P+'/flow_parameters_v002.json','w'),indent=2);s['evolution_contract']='No time-dependent source-coordinate movement. Three fixed independent fields morph locally with variance-preserving weights. Base jade/green strength2 remain fixed.'
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_Jade_Evolving_Light_v002_Final.blend');print('EVOLVING_NATIVE_SAVED',flush=True)
assert fc.driver.is_simple_expression and fc.driver.is_valid
if '--build-only' in sys.argv:print('SAFE_BUILD_ONLY_PASS');sys.exit(0)
for frame in [1,13,25,37,49,61,73]:
 s.frame_set(frame);bpy.context.view_layer.update();s.render.filepath=P+'/frames/%03d.png'%frame
 with open('/tmp/sa-ww2-render.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
 q=((frame-1)%72)/24;seg=int(q);t=q-seg;theta=math.pi/2*t*t*(3-2*t);w=[0,0,0];w[seg]=math.cos(theta);w[(seg+1)%3]=math.sin(theta);print('KEYFRAME',frame,'DRIVER_PHASE',phase.outputs[0].default_value,'EXPECTED_WEIGHTS',w,'L2',sum(x*x for x in w),'SIMPLE_DRIVER',fc.driver.is_simple_expression,flush=True)
print('EVOLVING_KEYFRAMES_DONE',flush=True)
