import bpy,os
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_B_Jade_Material_Study_20261006_v002.blend');s=bpy.context.scene;s.frame_set(1);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];native=bpy.data.materials['Deep cloudy jade green mineral light'];body.data.materials[0]=native
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
n=native.node_tree.nodes;l=native.node_tree.links;p=n.get('Principled BSDF');out=next(x for x in n if x.type=='OUTPUT_MATERIAL');em=n.new('ShaderNodeEmission');l.new(p.inputs['Emission Color'].links[0].from_socket,em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface'])
img=bpy.data.images.new('Jade_GreenLight_v002_1024',width=1024,height=1024,alpha=False);node=n.new('ShaderNodeTexImage');node.image=img;n.active=node;s.cycles.samples=1;s.render.bake.margin=12;bpy.ops.object.bake(type='EMIT');img.filepath_raw=P+'/Jade_GreenLight_v002_1024.png';img.file_format='PNG';img.save();img.pack();l.new(p.outputs['BSDF'],out.inputs['Surface']);n.remove(em);n.remove(node)
glbmat=bpy.data.materials['Jade GLB approximated surface'];gp=glbmat.node_tree.nodes.get('Principled BSDF');gp.inputs['Emission Strength'].default_value=4.0;gp.inputs['Emission Color'].links[0].from_node.image=img
s.cycles.samples=64;s['release_variant']='New candidate5-based jade material study 2026-10-06';bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_Character_Study_Native.blend')
body.data.materials[0]=glbmat;bpy.ops.object.select_all(action='DESELECT')
for o in s.objects:
 if o==body or o.name.startswith('B |'):o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.export_scene.gltf(filepath=P+'/SaJu_B_Jade_Character_Study.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_morph=True,export_apply=False,export_extras=True)
body.data.materials[0]=native;body.data.shape_keys.animation_data_clear();body.data.shape_keys.key_blocks['Gentle_wave_pose'].value=1;s.render.filepath=P+'/release_wave_v002.png';bpy.ops.render.render(write_still=True)
print('FINAL_ASSETS_READY')
