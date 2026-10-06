import bpy,os
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/B_Jade_Green_Emission_Isolated_v001.blend');s=bpy.context.scene;m=bpy.data.materials['Deep cloudy jade green mineral light'];n=m.node_tree.nodes;l=m.node_tree.links;mask=n.get('Same mineral emission mask');power=n.get('Emission-region BRDF isolation');noise=mask.inputs['Fac'].links[0].from_socket
isolation=n.new('ShaderNodeValToRGB');isolation.name='Smooth BRDF isolation without changing luminous pattern';isolation.color_ramp.interpolation='EASE';isolation.color_ramp.elements[0].position=.38;isolation.color_ramp.elements[0].color=(0,0,0,1);isolation.color_ramp.elements[1].position=.66;isolation.color_ramp.elements[1].color=(1,1,1,1);l.new(noise,isolation.inputs['Fac'])
for link in list(power.outputs[0].links):l.new(isolation.outputs['Color'],link.to_socket)
n.remove(power)
s.render.filepath=P+'/after_green_smooth.png';bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=P+'/B_Jade_Green_Emission_Separated_v002.blend');print('SMOOTH_ISOLATION_RENDER_DONE')
