import bpy,os
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_B_Jade_Green050_WIP.blend');s=bpy.context.scene;s.frame_set(1);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];native=bpy.data.materials['Deep cloudy jade green mineral light'];body.data.materials[0]=native
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body;n=native.node_tree.nodes;l=native.node_tree.links;p=n.get('Principled BSDF');out=next(x for x in n if x.type=='OUTPUT_MATERIAL');em=n.new('ShaderNodeEmission');l.new(p.inputs['Emission Color'].links[0].from_socket,em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface'])
img=bpy.data.images.new('Jade_ClearGreen_Emission_1024',width=1024,height=1024,alpha=False);node=n.new('ShaderNodeTexImage');node.image=img;n.active=node;s.cycles.samples=1;s.render.bake.margin=12;bpy.ops.object.bake(type='EMIT');img.filepath_raw=P+'/Jade_ClearGreen_Emission_1024.png';img.file_format='PNG';img.save();img.pack();l.new(p.outputs['BSDF'],out.inputs['Surface']);n.remove(em);n.remove(node)
glbmat=bpy.data.materials['Jade GLB approximated surface'];gp=glbmat.node_tree.nodes.get('Principled BSDF');assert gp.inputs['Emission Strength'].default_value==2.0;gp.inputs['Emission Color'].links[0].from_node.image=img;s.cycles.samples=64
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_ClearGreen050_20261006.blend')
body.data.materials[0]=glbmat;bpy.ops.object.select_all(action='DESELECT')
for o in s.objects:
 if o==body or o.name.startswith('B |'):o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.export_scene.gltf(filepath=P+'/SaJu_B_Jade_ClearGreen050_20261006.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_morph=True,export_apply=False,export_extras=True)
print('GREEN50_NATIVE_AND_GLB_SAVED')
