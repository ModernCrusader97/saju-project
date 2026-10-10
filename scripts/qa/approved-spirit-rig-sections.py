import json, struct, math, os, hashlib
import numpy as np
from pathlib import Path

root=Path.cwd()
raw=(root/'public/spirits/jade-v002/body.glb').read_bytes()
jlen=struct.unpack_from('<I',raw,12)[0]; doc=json.loads(raw[20:20+jlen]);bstart=20+jlen+8
def accessor(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
 return np.frombuffer(raw,dtype=dtype,count=a['count']*width,offset=bstart+v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],width)
primitive=next(p for m in doc['meshes']for p in m['primitives']if doc['accessors'][p['attributes']['POSITION']]['count']==33207)
rest=accessor(primitive['attributes']['POSITION']).astype(float);tri=accessor(primitive['indices']).reshape(-1,3).astype(int)
center=np.array([[.34,1.17,.08],[.58,1.08,.11],[.68,.92,.15],[.75,.71,.19]])
def curve(t):return (1-t)**3*center[0]+3*(1-t)**2*t*center[1]+3*(1-t)*t*t*center[2]+t**3*center[3]
def tangent(t):
 d=3*(1-t)**2*(center[1]-center[0])+6*(1-t)*t*(center[2]-center[1])+3*t*t*(center[3]-center[2]);return d/np.linalg.norm(d)
ts=np.linspace(0,1,4097);cp=np.array([curve(t)for t in ts]);arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(cp,axis=0),axis=1))]
_,weld=np.unique(np.round(rest*1e6).astype(int),axis=0,return_inverse=True)

def poly_metrics(points):
 c=points.mean(axis=0);_,ss,vh=np.linalg.svd(points-c,full_matrices=False);axes=vh[:2];uv=(points-c)@axes.T
 nxt=np.roll(uv,-1,axis=0);a=uv[:,0]*nxt[:,1]-nxt[:,0]*uv[:,1];area=a.sum()/2
 uv_center=((uv+nxt)*a[:,None]).sum(axis=0)/(6*area);centroid=c+uv_center@axes
 perimeter=np.linalg.norm(np.roll(points,-1,axis=0)-points,axis=1).sum()
 radius=np.linalg.norm(uv-uv_center,axis=1)
 return {'centroid':centroid.tolist(),'perimeter':float(perimeter),'area':float(abs(area)),'diameters':np.ptp(uv,axis=0).tolist(),'radialMin':float(radius.min()),'radialMax':float(radius.max()),'nonplanarity':float(np.ptp((points-c)@vh[2]))}

def slice_sections(u):
 t=np.interp(u,arc/arc[-1],ts);c=curve(t);tan=tangent(t);d=(rest-c)@tan
 crosses=np.where((d[tri].min(axis=1)<-1e-10)&(d[tri].max(axis=1)>1e-10))[0]
 vertices={};links={}
 for face in crosses:
  ids=tri[face];seg=[]
  for k in range(3):
   a,b=ids[k],ids[(k+1)%3]
   if d[a]*d[b]<0:
    h=d[a]/(d[a]-d[b]);key=tuple(sorted((int(weld[a]),int(weld[b]))));vertices[key]=(a,b,h);seg.append(key)
  if len(seg)==2:
   a,b=seg;links.setdefault(a,[]).append(b);links.setdefault(b,[]).append(a)
 loops=[];pending=set(vertices)
 while pending:
  a=next(iter(pending));keys=[];prev=None;cur=a
  while cur in pending:
   pending.remove(cur);keys.append(cur);nxt=[k for k in links[cur]if k!=prev]
   if not nxt:break
   prev,cur=cur,nxt[0]
  if len(keys)>2:
   bindings=[vertices[k]for k in keys];points=np.array([rest[a]+(rest[b]-rest[a])*h for a,b,h in bindings]);metrics=poly_metrics(points)
   loops.append({'bindings':bindings,'points':points,'metrics':metrics})
 loops.sort(key=lambda q:np.linalg.norm(np.array(q['metrics']['centroid'])-c))
 return {'u':u,'t':float(t),'authorCenter':c.tolist(),'loopCount':len(loops),'loops':loops}

slices=[slice_sections(u)for u in np.arange(.35,.951,.05)]
posefile=root/'outputs/rigged-greeting/cpu/explicit-poses.json'
poses={q['name']:np.array(q['positions']).reshape(-1,3) for q in json.loads(posefile.read_text())}
output={'sourceSHA256':hashlib.sha256(raw).hexdigest(),'poseInputSHA256':hashlib.sha256(posefile.read_bytes()).hexdigest(),'sections':[],'centerlineComparisons':[]}
for section in slices:
 chosen=section['loops'][0];entry={k:section[k]for k in ['u','t','authorCenter','loopCount']};entry['source']=chosen['metrics'];entry['pointCount']=len(chosen['points']);entry['posed']={}
 for mode,pose in poses.items():
  points=np.array([pose[a]+(pose[b]-pose[a])*h for a,b,h in chosen['bindings']]);metrics=poly_metrics(points)
  metrics['perimeterRatio']=metrics['perimeter']/chosen['metrics']['perimeter'];metrics['diameterRatios']=(np.array(metrics['diameters'])/chosen['metrics']['diameters']).tolist();entry['posed'][mode]=metrics
 output['sections'].append(entry)
for urange in [[.35,.95],[.4,.9]]:
 selected=[s for s in output['sections']if s['u']>=urange[0]-1e-8 and s['u']<=urange[1]+1e-8]
 def length(ps):return np.linalg.norm(np.diff(np.array(ps),axis=0),axis=1).sum()
 original=length([s['source']['centroid']for s in selected]);q={'uRange':urange,'originalSectionCenterlineLength':float(original),'posed':{}}
 for mode in poses:
  l=length([s['posed'][mode]['centroid']for s in selected]);q['posed'][mode]={'length':float(l),'ratio':float(l/original)}
 output['centerlineComparisons'].append(q)
visible=[s for s in output['sections']if .4-1e-8<=s['u']<=.9+1e-8]
lengths=[v['ratio']for v in output['centerlineComparisons'][1]['posed'].values()]
diameters=[r for s in visible for m in s['posed'].values()for r in m['diameterRatios']]
assert all(.99<r<1.01 for r in lengths), 'Visible arm material centerline exceeds one percent length change'
assert all(.99<r<1.01 for r in diameters), 'Visible arm material cross section exceeds one percent diameter change'
output['status']='PASS';output['measuredPoses']=len(poses);output['visibleArmLengthRatioRange']=[min(lengths),max(lengths)];output['visibleDiameterRatioRange']=[min(diameters),max(diameters)]
output['limits']=['Material rings sliced on the actual source triangles then tracked barycentrically, not the embedded full author curve.', 'Torso socket and inward wrist edge strain remain separate documented measurements.', 'No artistic approval or exhaustive intersection claim.']
path=root/'outputs/rigged-greeting/cpu/material-sections.json';path.write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({k:v for k,v in output.items()if k not in ['sections','centerlineComparisons']}))
