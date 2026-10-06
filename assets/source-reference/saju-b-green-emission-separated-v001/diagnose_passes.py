import bpy,os,json
P=os.path.dirname(os.path.abspath(__file__));SRC=os.path.dirname(P)+'/saju_jade_green050_20261006/SaJu_B_Jade_ClearGreen050_20261006.blend';bpy.ops.wm.open_mainfile(filepath=SRC);s=bpy.context.scene;s.frame_set(1);s.cycles.samples=48;s.render.resolution_x=480;s.render.resolution_y=480;s.render.threads=2;s.cycles.use_denoising=False
s.view_layers[0].use_pass_emit=True;s.view_layers[0].use_pass_glossy_direct=True;s.view_layers[0].use_pass_glossy_indirect=True;s.view_layers[0].use_pass_glossy_color=True
s.use_nodes=True;nodes=s.node_tree.nodes;nodes.clear();r=nodes.new('CompositorNodeRLayers');comp=nodes.new('CompositorNodeComposite');s.node_tree.links.new(r.outputs['Image'],comp.inputs[0]);print('PASSES',[o.name for o in r.outputs])
for socket,name in [('Emit','emission_raw'),('GlossDir','gloss_direct'),('GlossInd','gloss_indirect'),('Image','beauty_raw')]:
 out=nodes.new('CompositorNodeOutputFile');out.base_path=P;out.file_slots[0].path=name+'_';out.format.file_format='OPEN_EXR';out.format.color_depth='32';out.format.color_mode='RGB';s.node_tree.links.new(r.outputs[socket],out.inputs[0])
s.render.filepath=P+'/before_beauty.png';bpy.ops.render.render(write_still=True)
for name in ['emission_raw','gloss_direct','gloss_indirect','beauty_raw']:
 path=P+'/'+name+'_0001.exr';im=bpy.data.images.load(path,check_existing=False)
 s.view_settings.view_transform='AgX';im.save_render(P+'/'+name+'_AgX.png',scene=s)
 s.view_settings.view_transform='Standard';im.save_render(P+'/'+name+'_Standard.png',scene=s)
s.view_settings.view_transform='AgX';print('DIAGNOSTIC_RENDER_PASSES_DONE')
