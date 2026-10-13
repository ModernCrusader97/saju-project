import argparse,bpy,json,math,sys,numpy as np
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--blend',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists();out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False)
H=-1.10;angle=math.radians(-8);co=math.cos(angle);si=math.sin(angle)
def unmap(p):
 y=p.y*co+(p.z-3.03)*si;z=3.03-p.y*si+(p.z-3.03)*co
 return np.array([H+(p.x-H)/1.24,y/1.19,3.55+(z-3.55)/1.18])
eyes=[]
for sign in (-1,1):
 o=bpy.data.objects['Eye_Closed_Fitted_Convex_Volume_'+str(sign)];q=np.array([unmap(o.matrix_world@v.co) for v in o.data.vertices[:1409]]);r=q[1345:1409][:,[0,2]];mn=r.min(axis=0);mx=r.max(axis=0);center=(mn+mx)/2;rad=(mx-mn)/2;nr=np.linalg.norm((r-center)/rad,axis=1);area=.5*abs(np.dot(r[:,0],np.roll(r[:,1],-1))-np.dot(r[:,1],np.roll(r[:,0],-1)));perimeter=np.linalg.norm(r-np.roll(r,1,axis=0),axis=1).sum()
 eyes.append({'eye':o.name,'center':center.tolist(),'radius':rad.tolist(),'area':float(area),'ellipse_area':float(math.pi*np.prod(rad)),'radial_std':float(nr.std()),'circularity':float(4*math.pi*area/perimeter**2),'front_apex':q[0].tolist(),'rim_y_range':[float(q[1345:1409,1].min()),float(q[1345:1409,1].max())]})
(out/'eye-outline-inspection.json').write_text(json.dumps({'eyes':eyes,'blender':bpy.app.version_string,'baseline':'V25 regenerated, not original V26'},indent=2));print(json.dumps(eyes),flush=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.use_denoising=False;s.cycles.samples=12;s.render.resolution_x=s.render.resolution_y=480;s.render.resolution_percentage=100;s.render.threads_mode='FIXED';s.render.threads=4
s.camera=bpy.data.objects['Camera_HeadFront'];bpy.data.objects['Preview_Floor'].hide_render=True;s.render.filepath=str(out/'headfront.png');bpy.ops.render.render(write_still=True)
print('BASELINE_INSPECTION_RENDER_SUCCESS',flush=True)
