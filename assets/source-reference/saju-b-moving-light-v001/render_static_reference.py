import bpy,os,fcntl
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=os.path.dirname(P)+'/saju_green_emission_separation_v001/SaJu_Jade_GreenEmission_Separated_v001.blend');s=bpy.context.scene;s.frame_set(1);s.render.resolution_x=320;s.render.resolution_y=320;s.render.resolution_percentage=100;s.cycles.samples=24;s.cycles.use_denoising=False;s.cycles.use_animated_seed=False;s.render.threads_mode='FIXED';s.render.threads=2;s.use_nodes=False;s.render.filepath=P+'/approved_static_reference_320.png'
with open('/tmp/sa-ww2-render.lock','w') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
