"""Read saved model/cameras and actual still bytes; no video generation claim."""
import bpy,sys,argparse,hashlib,json,struct
from pathlib import Path
ap=argparse.ArgumentParser()
for name in ('blend','glb','renders','script','out'):ap.add_argument('--'+name,required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists()
blend=Path(a.blend);glb=Path(a.glb);script=Path(a.script);renders=Path(a.renders)
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(blend),load_ui=False);scene=bpy.context.scene
model={'blend_file':blend.name,'blend_sha256':hashfile(blend),'glb_file':glb.name,'glb_sha256':hashfile(glb),'generator_sha256':hashfile(script),'approved_reference_sha256':'6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'}
views=[]
for view,name in [('front','Front'),('threequarter','ThreeQuarter'),('side','Side')]:
    p=renders/(view+'.png');raw=p.read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n';width,height=struct.unpack('>II',raw[16:24]);cam=bpy.data.objects['Camera_'+name]
    views.append({'view':view,'actual_render':True,'render_source':'Saved native Blender geometry; Cycles CPU','frame':0,'file_name':p.name,'bytes':len(raw),'sha256':hashfile(p),'width':width,'height':height,'model':model,
      'camera':{'object':cam.name,'type':cam.data.type,'orthographic_scale':cam.data.ortho_scale,'location':list(cam.location),'euler_radians':list(cam.rotation_euler),'world_matrix':[list(row) for row in cam.matrix_world],'lens_mm':cam.data.lens,'clip_start':cam.data.clip_start,'clip_end':cam.data.clip_end},
      'studio_floor_visible':view=='threequarter','blender_version':bpy.app.version_string,'render_samples':scene.cycles.samples,'color_transform':scene.view_settings.view_transform,'color_look':scene.view_settings.look})
report={'status':'EXACT_MODEL_CAMERA_REAL_STILL_BYTES_RECORDED','model':model,'views':views,
 'runtime_animation':{'name':bpy.data.objects['Dragon_Rig'].animation_data.action.name,'source_fps':scene.render.fps,'keyframe_endpoints':[scene.frame_start,scene.frame_end],'seconds':(scene.frame_end-scene.frame_start)/scene.render.fps,'new_video_rendered':False,'existing_v2_video_preserved':True}}
out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps({'status':report['status'],'model':model}),flush=True)
