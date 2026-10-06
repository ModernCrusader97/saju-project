import bpy,os,numpy as np,json
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/B_Jade_Green_Emission_Separated_v002.blend');s=bpy.context.scene;s.frame_set(1);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];native=bpy.data.materials['Deep cloudy jade green mineral light'];n=native.node_tree.nodes;l=native.node_tree.links;p=n.get('Principled BSDF');out=next(x for x in n if x.type=='OUTPUT_MATERIAL');native_output=out.inputs['Surface'].links[0].from_socket;mask=n.get('Same mineral emission mask');iso=n.get('Smooth BRDF isolation without changing luminous pattern')
inv=n.new('ShaderNodeMath');inv.name='Remaining reflected fraction';inv.operation='SUBTRACT';inv.inputs[0].default_value=1;l.new(iso.outputs['Color'],inv.inputs[1]);base=n.new('ShaderNodeMixRGB');base.blend_type='MULTIPLY';base.inputs[0].default_value=1;l.new(p.inputs['Base Color'].links[0].from_socket,base.inputs[1]);l.new(inv.outputs[0],base.inputs[2]);emit=n.new('ShaderNodeMixRGB');emit.blend_type='MULTIPLY';emit.inputs[0].default_value=1;emit.inputs[1].default_value=(.001,.65,.08,1);l.new(mask.outputs['Color'],emit.inputs[2])
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
s.cycles.samples=1;s.render.bake.margin=12
textures={}
for name,sock,color_space in [('Jade_ReflectanceBase_1024',base.outputs[0],'sRGB'),('Jade_GreenEmission_1024',emit.outputs[0],'sRGB'),('Jade_ReflectionMask_1024',inv.outputs[0],'Non-Color')]:
 im=bpy.data.images.new(name,width=1024,height=1024,alpha=True);im.colorspace_settings.name=color_space;im.alpha_mode='STRAIGHT';tex=n.new('ShaderNodeTexImage');tex.image=im;n.active=tex;em=n.new('ShaderNodeEmission');l.new(sock,em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='EMIT');l.new(native_output,out.inputs['Surface']);n.remove(em);n.remove(tex)
 if name=='Jade_ReflectionMask_1024':
  a=np.asarray(im.pixels[:],dtype=np.float32).reshape(-1,4);a[:,3]=a[:,0];im.pixels.foreach_set(a.ravel());im.update()
 im.filepath_raw=P+'/'+name+'.png';im.file_format='PNG';im.save();im.pack();textures[name]=im
# glTF-compatible PBR approximation. Original jade BRDF remains intact in native shader; these UV maps isolate emission for real-time viewers.
gm=bpy.data.materials.new('Jade Green Emission Separated | PBR');gm.use_nodes=True;gm.use_fake_user=True;gn=gm.node_tree.nodes;gl=gm.node_tree.links;gp=gn.get('Principled BSDF');gp.inputs['Roughness'].default_value=.24;gp.inputs['IOR'].default_value=1.54;gp.inputs['Coat Roughness'].default_value=.15;gp.inputs['Emission Strength'].default_value=2
for key,socket in [('Jade_ReflectanceBase_1024','Base Color'),('Jade_GreenEmission_1024','Emission Color')]:
 tn=gn.new('ShaderNodeTexImage');tn.image=textures[key];gl.new(tn.outputs['Color'],gp.inputs[socket])
tn=gn.new('ShaderNodeTexImage');tn.image=textures['Jade_ReflectionMask_1024'];sep=gn.new('ShaderNodeSeparateColor');gl.new(tn.outputs['Color'],sep.inputs[0])
for socket,factor,signal in [('Specular IOR Level',.5,tn.outputs['Alpha']),('Coat Weight',.25,sep.outputs['Red']),('Transmission Weight',.14,sep.outputs['Red'])]:
 mult=gn.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=factor;gl.new(signal,mult.inputs[0]);gl.new(mult.outputs[0],gp.inputs[socket])
body.data.materials[0]=native;s.cycles.samples=48;s['release_note']='Green emitted-light separation. Same geometry and original mineral emission pattern; multiplier2 retained. Reflection overlap is selectively reduced. Dedicated emit shader hue is green (.001,.65,.08); no extra bloom or exposure lift.'
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_Jade_GreenEmission_Separated_v001.blend')
body.data.materials[0]=gm;bpy.ops.object.select_all(action='DESELECT')
for o in s.objects:
 if o==body or o.name.startswith('B |'):o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.export_scene.gltf(filepath=P+'/SaJu_Jade_GreenEmission_Separated_v001.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_morph=True,export_apply=False,export_extras=True)
# Save separate preview .blend for exact PBR roundtrip comparison, never substitute it for the native authoritative shader.
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_Jade_GreenEmission_PBR_review.blend')
body.data.materials[0]=native;s.use_nodes=True;s.view_layers[0].use_pass_emit=True;cn=s.node_tree.nodes;cn.clear();rl=cn.new('CompositorNodeRLayers');cp=cn.new('CompositorNodeComposite');s.node_tree.links.new(rl.outputs['Image'],cp.inputs[0]);fo=cn.new('CompositorNodeOutputFile');fo.base_path=P;fo.file_slots[0].path='after_emission_raw_';fo.format.file_format='OPEN_EXR';fo.format.color_depth='32';fo.format.color_mode='RGB';s.node_tree.links.new(rl.outputs['Emit'],fo.inputs[0]);s.render.filepath=P+'/after_green_verified.png';bpy.ops.render.render(write_still=True)
im=bpy.data.images.load(P+'/after_emission_raw_0001.exr',check_existing=False);im.save_render(P+'/after_emission_only_AgX.png',scene=s)
print('BAKED_PBR_EXPORTED_AND_EMISSION_PASS_SAVED')
