import bpy,os,json,math
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/B_candidate5_rebuilt_jade_v003.blend');s=bpy.context.scene;body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];keys=body.data.shape_keys
# Reject gathered/open motion explorations from the release artifact; preserve WIP separately.
keys.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
for name in ['gather','open']:body.shape_key_remove(keys.key_blocks[name])
k=keys.key_blocks['wave'];base=keys.key_blocks['Basis']
for a,b in zip(base.data,k.data):b.co=a.co.lerp(b.co,.72)
k.name='Gentle_wave_pose';k.value=0
# Bounded one-motion prototype, not a recreation of the lost production skeleton.
keys.animation_data_create();act=bpy.data.actions.new('Gentle_wave_study');keys.animation_data.action=act
for f,value in [(1,0),(16,1),(25,.86),(34,1),(48,0)]:k.value=value;k.keyframe_insert(data_path='value',frame=f)
for fc in act.fcurves:
 for kp in fc.keyframe_points:kp.interpolation='LINEAR'
act.use_fake_user=True;s.frame_start=1;s.frame_end=48;s.render.fps=16;s.frame_set(1)
for mat in bpy.data.materials:mat.use_fake_user=True
s['limitations']='New candidate5-based art reconstruction. One limited morph wave study; no full gesture rig, browser runtime or Unity verification. Rejected gather/open experiments excluded. Standard-PBR GLB approximates native jade.'
s.cycles.use_denoising=False;s.cycles.samples=64
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.014);bpy.ops.object.mode_set(mode='OBJECT')
# Bake authored base-colour and selected green emission to deterministic UV textures.
def bake(mat,outname,socket):
 n=mat.node_tree.nodes;l=mat.node_tree.links;out=next(x for x in n if x.type=='OUTPUT_MATERIAL');p=next(x for x in n if x.type=='BSDF_PRINCIPLED');original=out.inputs['Surface'].links[0].from_socket
 image=bpy.data.images.new(outname,width=1024,height=1024,alpha=False);image.colorspace_settings.name='sRGB'
 img=n.new('ShaderNodeTexImage');img.image=image;n.active=img;em=n.new('ShaderNodeEmission');src=p.inputs[socket]
 if src.links:l.new(src.links[0].from_socket,em.inputs['Color'])
 else:em.inputs['Color'].default_value=src.default_value
 em.inputs['Strength'].default_value=1;l.new(em.outputs[0],out.inputs['Surface']);body.data.materials[0]=mat
 s.render.engine='CYCLES';s.cycles.samples=1;s.render.bake.margin=12;bpy.ops.object.bake(type='EMIT')
 image.filepath_raw=P+'/'+outname+'.png';image.file_format='PNG';image.save();image.pack();l.new(original,out.inputs['Surface']);n.remove(em);n.remove(img);return image
native=bpy.data.materials['Deep cloudy jade green mineral light'];baseimg=bake(native,'Jade_BaseColor_1024','Base Color');emimg=bake(native,'Jade_GreenLight_1024','Emission Color')
glbmat=bpy.data.materials.new('Jade GLB approximated surface');glbmat.use_nodes=True;n=glbmat.node_tree.nodes;l=glbmat.node_tree.links;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=.24;p.inputs['Transmission Weight'].default_value=.14;p.inputs['IOR'].default_value=1.54;p.inputs['Coat Weight'].default_value=.25;p.inputs['Coat Roughness'].default_value=.15;p.inputs['Emission Strength'].default_value=.5
for img,sock in [(baseimg,'Base Color'),(emimg,'Emission Color')]:node=n.new('ShaderNodeTexImage');node.image=img;l.new(node.outputs['Color'],p.inputs[sock])
glbmat.use_fake_user=True;body.data.materials[0]=native;s.cycles.samples=64;s['release_variant']='Jade candidate5 reconstruction v004'
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_Reconstruction_v004.blend')
# Export only character, never studio or diagnostic failed shapes.
body.data.materials[0]=glbmat;bpy.ops.object.select_all(action='DESELECT')
for o in s.objects:
 if o==body or o.name.startswith('B |'):o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=P+'/SaJu_B_Jade_Reconstruction_v004.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_morph=True,export_apply=False,export_extras=True)
print('V004_NATIVE_AND_GLB_SAVED',flush=True)
