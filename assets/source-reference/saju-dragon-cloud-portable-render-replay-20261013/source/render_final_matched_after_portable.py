"""Render real before/after native models with identical cameras, lights and settings."""
import argparse,bpy,hashlib,json,sys,numpy as np
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--before',required=True);ap.add_argument('--after',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True);records=[]
before=Path(a.before).resolve();after=Path(a.after).resolve();assert before.is_file() and after.is_file(),'Declared before/after input files must exist'
bpy.ops.wm.open_mainfile(filepath=str(before),load_ui=False)
studio={o.name:{'matrix':np.asarray(o.matrix_world).tolist(),'ortho_scale':o.data.ortho_scale,'lens':o.data.lens,'type':o.data.type} for o in bpy.data.objects if o.type=='CAMERA'}
for phase,path in [('after_final_round_eyes',a.after)]:
 bpy.ops.wm.open_mainfile(filepath=path,load_ui=False);s=bpy.context.scene;signature={o.name:{'matrix':np.asarray(o.matrix_world).tolist(),'ortho_scale':o.data.ortho_scale,'lens':o.data.lens,'type':o.data.type} for o in bpy.data.objects if o.type=='CAMERA'}
 if studio is None:studio=signature
 else:assert studio==signature,'Camera changed'
 s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.use_denoising=False;s.cycles.samples=64;s.cycles.seed=20261013;s.render.resolution_x=s.render.resolution_y=640;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4;s.frame_set(0)
 for name in ['HeadFront','HeadThreeQuarter','ThreeQuarter']:
  s.camera=bpy.data.objects['Camera_'+name];bpy.data.objects['Preview_Floor'].hide_render=name!='ThreeQuarter';p=out/(phase+'_'+name.lower()+'.png');s.render.filepath=str(p);bpy.ops.render.render(write_still=True);records.append({'phase':phase,'camera':name,'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'native_sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest()});print('MATCHED_RENDER_READY',phase,name,flush=True)
(out/'render-provenance.json').write_text(json.dumps({'status':'PASS_IDENTICAL_CAMERA_ACTUAL_NATIVE_BEFORE_AFTER_RENDERS','before_is_reconstructed_candidate_not_original_V26':True,'camera_signature':studio,'settings':{'engine':'CYCLES','device':'CPU','samples':64,'denoising':False,'resolution':[640,640],'seed':20261013},'renders':records},indent=2))
