import bpy,bmesh,sys,argparse,json,hashlib,math
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);p=Path(a.blend);out=Path(a.out);assert p.is_file(),'Static candidate is not built yet';assert not out.exists()
bpy.ops.wm.open_mainfile(filepath=str(p));c=bpy.data.collections['Dragon_V8_New_Static_Construction'];skin=bpy.data.objects['Dragon_Continuous_Skin'];rows=[]
for o in c.objects:
 if o.type!='MESH':continue
 assert all(math.isfinite(v) for vertex in o.data.vertices for v in vertex.co),'Nonfinite position '+o.name
 o.data.calc_loop_triangles();assert all(t.area>1e-14 for t in o.data.loop_triangles),'Zero-area triangle '+o.name
 assert all(v.normal.length>.999 and v.normal.length<1.001 for v in o.data.vertices),'Invalid normal '+o.name
 bm=bmesh.new();bm.from_mesh(o.data);non=sum(not e.is_manifold for e in bm.edges);euler=len(bm.verts)-len(bm.edges)+len(bm.faces)
 visited=set();components=0
 for v in bm.verts:
  if v.index in visited:continue
  components+=1;stack=[v];visited.add(v.index)
  while stack:
   u=stack.pop()
   for e in u.link_edges:
    w=e.other_vert(u)
    if w.index not in visited:visited.add(w.index);stack.append(w)
 rows.append({'name':o.name,'vertices':len(bm.verts),'polygons':len(bm.faces),'nonmanifold_edges':non,'components':components,'euler':euler,'signed_volume':bm.calc_volume(signed=True)})
 if o is skin:assert non==0 and components==1 and euler==2,'Skin must be one closed seamless genus-0 surface'
 elif not o.name.startswith('Surface_'):assert non==0,'Decorative volume is open '+o.name
 bm.free()
images=[]
for image in bpy.data.images:
 if image.packed_file:images.append({'name':image.name,'bytes':len(image.packed_file.data),'sha256':hashlib.sha256(image.packed_file.data).hexdigest()})
assert any(x['bytes']==1651398 and x['sha256']=='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58' for x in images)
assert not any(o.type=='ARMATURE' for o in c.objects);assert not bpy.data.libraries
r={'status':'PASS_STATIC_TECHNICAL_GEOMETRY_REFERENCE_BYTES_ONLY_VISUAL_REVIEW_REQUIRED','source':str(p),'native_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'geometry':rows,'packed_images':images,'photosimilarity_measured':False,'final_user_appearance_approved':False,'animation_not_started':True}
out.write_text(json.dumps(r,indent=2),encoding='utf8');print(json.dumps({'status':r['status'],'mesh_count':len(rows),'skin':next(x for x in rows if x['name']==skin.name)}))
