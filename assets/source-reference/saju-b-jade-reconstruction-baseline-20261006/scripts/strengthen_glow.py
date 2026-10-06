import bpy,os
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_B_Jade_Material_Study_20261006.blend');s=bpy.context.scene;body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];m=bpy.data.materials['Deep cloudy jade green mineral light'];p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Strength'].default_value=4.0
# Keep the approved cloudy mass; make its selective green light visibly distinguishable in the same studio.
er=p.inputs['Emission Color'].links[0].from_node;er.color_ramp.elements[0].position=.50;er.color_ramp.elements[1].position=.72
s['release_variant']='SaJu B new candidate5-based jade material study v002, 2026-10-06';s.frame_set(1);body.data.materials[0]=m
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_Material_Study_20261006_v002.blend');s.render.filepath=P+'/release_jade_glow_v002.png';bpy.ops.render.render(write_still=True)
