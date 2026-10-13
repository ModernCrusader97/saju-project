"""Actual visible eye masks under matched cameras, read-only synthetic material diagnostic."""
import argparse,bpy,json,sys,numpy as np
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--before',required=True);ap.add_argument('--after',required=True);ap.add_argument('--out',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True);records={}
for phase,path in [('before',a.before),('after',a.after)]:
 bpy.ops.wm.open_mainfile(filepath=path,load_ui=False)
 def emission(name,value):
  m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();output=n.new('ShaderNodeOutputMaterial');e=n.new('ShaderNodeEmission');e.inputs['Color'].default_value=(value,value,value,1);e.inputs['Strength'].default_value=1;m.node_tree.links.new(e.outputs['Emission'],output.inputs['Surface']);return m
 black=emission('DIAGNOSTIC_BLACK',0);white=emission('DIAGNOSTIC_WHITE',1)
 for o in bpy.data.objects:
  if o.type=='MESH':o.data.materials.clear();o.data.materials.append(white if o.name.startswith('Eye_Closed_Fitted_Convex_Volume_') or o.name.startswith('Eye_Attached_Glint_') else black)
 s=bpy.context.scene;s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0;s.render.engine='CYCLES';s.cycles.use_denoising=False;s.cycles.samples=1;s.cycles.seed=20261013;s.render.resolution_x=s.render.resolution_y=640;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=4;s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1;bpy.data.objects['Preview_Floor'].hide_render=True
 for camera in ['HeadFront','HeadThreeQuarter']:
  s.camera=bpy.data.objects['Camera_'+camera];p=out/(phase+'_'+camera+'.png');s.render.filepath=str(p);bpy.ops.render.render(write_still=True);pixels=np.asarray(bpy.data.images.load(str(p),check_existing=False).pixels[:],dtype=np.float32).reshape(640,640,4);mask=pixels[:,:,:3].mean(axis=2);ys,xs=np.where(mask>.5);records[phase+'_'+camera]={'visible_area_weighted_pixels':float(mask.sum()),'width_pixels':int(xs.max()-xs.min()+1),'height_pixels':int(ys.max()-ys.min()+1)}
comparisons=[]
for camera in ['HeadFront','HeadThreeQuarter']:
 b=records['before_'+camera];c=records['after_'+camera];ratio=c['visible_area_weighted_pixels']/b['visible_area_weighted_pixels'];passed=ratio>=.995 and c['width_pixels']>=b['width_pixels']-1 and c['height_pixels']>=b['height_pixels']-1;comparisons.append({'camera':camera,'before':b,'after':c,'visible_area_ratio':ratio,'pass':passed})
r={'status':'PASS_ACTUAL_RENDERED_EYE_FOOTPRINT_NO_SHRINK' if all(c['pass'] for c in comparisons) else 'FAIL_RENDERED_EYE_FOOTPRINT','comparisons':comparisons,'pixel_sampling_tolerance':{'relative_area':.005,'bounding_dimension_pixels':1},'native_saved_or_changed':False};(out/'rendered-eye-footprint-report.json').write_text(json.dumps(r,indent=2));print(json.dumps(r),flush=True);assert all(c['pass'] for c in comparisons)
