import bpy,os,math,json,time,fcntl,hashlib
P=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(P)+'/saju_green_emission_separation_v001/SaJu_Jade_GreenEmission_Separated_v001.blend';bpy.ops.wm.open_mainfile(filepath=SRC);s=bpy.context.scene;s.frame_set(1);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens']
# Review only the material flow: retain authored morph data, disable the independent wave action in this copy.
body.data.shape_keys.animation_data_clear()
for key in body.data.shape_keys.key_blocks:key.value=0
mat=bpy.data.materials['Deep cloudy jade green mineral light'];nodes=mat.node_tree.nodes;links=mat.node_tree.links;mask=nodes.get('Same mineral emission mask');isolation=nodes.get('Smooth BRDF isolation without changing luminous pattern');base_noise=mask.inputs['Fac'].links[0].from_node;vec=base_noise.inputs['Vector'].links[0].from_socket
flow_noise=nodes.new(base_noise.bl_idname);flow_noise.name='Moving emission field only';flow_noise.label='Independent field: base jade remains static'
for prop in ['noise_dimensions','noise_type','normalize']:
 if hasattr(base_noise,prop):setattr(flow_noise,prop,getattr(base_noise,prop))
for a,b in zip(base_noise.inputs,flow_noise.inputs):
 if hasattr(a,'default_value'):b.default_value=a.default_value
shift=nodes.new('ShaderNodeVectorMath');shift.operation='ADD';shift.name='Closed spatial light path | six seconds';links.new(vec,shift.inputs[0]);links.new(shift.outputs[0],flow_noise.inputs['Vector']);links.new(flow_noise.outputs['Fac'],mask.inputs['Fac']);links.new(flow_noise.outputs['Fac'],isolation.inputs['Fac'])
expressions=['0.14*sin((frame-1)*2*pi/72)','0.055*(1-cos((frame-1)*2*pi/72))','0.14*(sin((frame-1)*2*pi/72+pi/3)-sin(pi/3))']
for i,expression in enumerate(expressions):
 fc=shift.inputs[1].driver_add('default_value',i);fc.driver.type='SCRIPTED';fc.driver.expression=expression
s.frame_start=1;s.frame_end=72;s.render.fps=12;s.frame_set(1);bpy.context.view_layer.update();s.cycles.samples=24;s.cycles.use_denoising=False;s.cycles.use_animated_seed=False;s.render.threads_mode='FIXED';s.render.threads=2;s.render.resolution_x=320;s.render.resolution_y=320;s.render.resolution_percentage=100;s.use_nodes=False
s['flow_contract']='Emission field only; fixed jade base. Closed6s offset path; strength2 constant. Paired reflection isolation follows emitting field. Frame73 equalsframe1.'
params={'period_seconds':6,'fps':12,'frames_per_loop':72,'emission_strength':2,'emission_rgb_linear':[.001,.65,.08],'emission_thresholds':[.5,.72],'reflection_isolation_thresholds':[.38,.66],'offset_formula':expressions,'noise_inputs':{i.name:list(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value for i in flow_noise.inputs if hasattr(i,'default_value') and i.name!='Vector'},'noise_dimensions':flow_noise.noise_dimensions,'noise_type':flow_noise.noise_type,'noise_normalize':flow_noise.normalize,'texspace_location':list(body.data.texspace_location),'texspace_half_size':list(body.data.texspace_size),'geometry_bounds':[list(map(min,zip(*(v.co[:] for v in body.data.vertices)))),list(map(max,zip(*(v.co[:] for v in body.data.vertices))))],'glb_shader_animation_supported':False,'source_native':SRC}
json.dump(params,open(P+'/flow_parameters.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_Jade_Moving_Green_Light_v001.blend');print('EARLY_NATIVE_SAVED',flush=True)
# Inspect useful quarters first, then fill the movie. Each render releases the shared lock for other work.
order=[1,19,37,55,73]+[f for f in range(1,73) if f not in [1,19,37,55]]
for frame in order:
 s.frame_set(frame);bpy.context.view_layer.update();s.render.filepath=P+'/frames/%03d.png'%frame
 with open('/tmp/sa-ww2-render.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);start=time.time();bpy.ops.render.render(write_still=True);elapsed=time.time()-start;fcntl.flock(lock,fcntl.LOCK_UN)
 print('FLOW_FRAME',frame,'SECONDS',round(elapsed,3),'OFFSET',list(shift.inputs[1].default_value),flush=True);time.sleep(.10)
print('ALL_FLOW_FRAMES_DONE',flush=True)
