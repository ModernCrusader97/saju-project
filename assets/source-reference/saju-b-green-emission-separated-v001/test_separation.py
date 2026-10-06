import bpy,os,json
P=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(P)+'/saju_jade_green050_20261006/SaJu_B_Jade_ClearGreen050_20261006.blend';bpy.ops.wm.open_mainfile(filepath=SRC);s=bpy.context.scene;s.frame_set(1)
m=bpy.data.materials['Deep cloudy jade green mineral light'];n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');out=next(x for x in n if x.type=='OUTPUT_MATERIAL');old_ramp=p.inputs['Emission Color'].links[0].from_node;noise_socket=old_ramp.inputs['Fac'].links[0].from_socket
mask=n.new('ShaderNodeValToRGB');mask.name='Same mineral emission mask';mask.color_ramp.elements[0].position=old_ramp.color_ramp.elements[0].position;mask.color_ramp.elements[0].color=(0,0,0,1);mask.color_ramp.elements[1].position=old_ramp.color_ramp.elements[-1].position;mask.color_ramp.elements[1].color=(1,1,1,1);l.new(noise_socket,mask.inputs['Fac'])
p.inputs['Emission Strength'].default_value=0
em=n.new('ShaderNodeEmission');em.name='Separated green light | strength 2';em.inputs['Color'].default_value=(.001,.65,.30,1);em.inputs['Strength'].default_value=2
mix=n.new('ShaderNodeMixShader');mix.name='Reduce white BRDF overlap only inside emitting mineral';l.new(mask.outputs['Color'],mix.inputs[0]);l.new(p.outputs['BSDF'],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=480;s.render.resolution_y=480;s.render.threads=2
for label,color in [('separated_same_teal',(.001,.65,.30,1)),('separated_true_green',(.001,.65,.08,1))]:
 em.inputs['Color'].default_value=color;s.render.filepath=P+'/'+label+'.png';bpy.ops.render.render(write_still=True)
 if label=='separated_true_green':bpy.ops.wm.save_as_mainfile(filepath=P+'/B_Jade_Separated_Green_Test.blend')
print('SEPARATED_TESTS_DONE')
