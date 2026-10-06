import bpy,os,fcntl,time
P=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.open_mainfile(filepath=P+'/SaJu_Jade_Evolving_Light_v002_Final.blend');s=bpy.context.scene;s.frame_start=1;s.frame_end=72;s.render.fps=12
for frame in [i for i in range(1,73) if i not in [1,13,25,37,49,61]]:
 s.frame_set(frame);bpy.context.view_layer.update();s.render.filepath=P+'/frames/%03d.png'%frame
 with open('/tmp/sa-ww2-render.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);start=time.time();bpy.ops.render.render(write_still=True);elapsed=time.time()-start;fcntl.flock(lock,fcntl.LOCK_UN)
 print('EVOLUTION_FRAME',frame,'SECONDS',round(elapsed,3),flush=True);time.sleep(.1)
# Final-native endpoint proof, separate paths avoid replacing the initial probes.
for frame in [1,73]:
 s.frame_set(frame);s.render.filepath=P+'/final_endpoint_%03d.png'%frame
 with open('/tmp/sa-ww2-render.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);bpy.ops.render.render(write_still=True);fcntl.flock(lock,fcntl.LOCK_UN)
print('EVOLUTION_MOVIE_RENDER_DONE',flush=True)
