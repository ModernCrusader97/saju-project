import bpy,os,sys,shutil
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_B_Jade_Reconstruction_v004.blend');s=bpy.context.scene;body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];keys=body.data.shape_keys;keys.animation_data_clear()
for k in keys.key_blocks:k.value=0
native=bpy.data.materials['Deep cloudy jade green mineral light'];control=native.copy();control.name='Deep cloudy jade unlit control';control.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=0;control.use_fake_user=True
glass=bpy.data.materials.new('New rose glass control');glass.use_nodes=True;p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.72,.15,.28,1);p.inputs['Roughness'].default_value=.14;p.inputs['Transmission Weight'].default_value=.62;p.inputs['IOR'].default_value=1.46;p.inputs['Coat Weight'].default_value=.3;glass.use_fake_user=True
body.data.materials[0]=native;s.render.resolution_x=480;s.render.resolution_y=480;s.cycles.samples=64;s.cycles.use_denoising=False;s['release_variant']='SaJu B new candidate5-based jade material study, 2026-10-06';s['motion_status']='Gentle wave pose only; full rig not recreated. Gather/open rejected and excluded.'
# Native file retains bounded wave action but no failed studies.
keys.animation_data_create();keys.animation_data.action=bpy.data.actions.get('Gentle_wave_study');s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=P+'/SaJu_B_Jade_Material_Study_20261006.blend');keys.animation_data_clear()
for k in keys.key_blocks:k.value=0
for name,mat in [('glass',glass),('jade_control',control),('jade_glow',native),('wave',native)]:
 body.data.materials[0]=mat
 keys.key_blocks['Gentle_wave_pose'].value=1 if name=='wave' else 0
 s.render.filepath=P+'/release_'+name+'.png';bpy.ops.render.render(write_still=True)
print('RELEASE_RENDERS_DONE')
