import bpy,bmesh,math,json,os,struct
P=os.path.dirname(os.path.abspath(__file__));native=P+'/SaJu_B_Jade_Character_Study_Native.blend';bpy.ops.wm.open_mainfile(filepath=native);body=bpy.data.objects['B candidate5 reconstructed | seamless body and mittens'];m=body.data;bm=bmesh.new();bm.from_mesh(m)
seen=set();components=[]
for v in bm.verts:
 if v in seen:continue
 todo=[v];seen.add(v);c=0
 while todo:
  q=todo.pop();c+=1
  for e in q.link_edges:
   o=e.other_vert(q)
   if o not in seen:seen.add(o);todo.append(o)
 components.append(c)
non=sum(not e.is_manifold for e in bm.edges);bm.free();base=[v.co.copy() for v in m.vertices];target=m.shape_keys.key_blocks['Gentle_wave_pose'];rows=[]
for i in range(21):
 a=i/20;co=[v.lerp(k.co,a) for v,k in zip(base,target.data)];ratios=[(co[e.vertices[0]]-co[e.vertices[1]]).length/max(1e-9,(base[e.vertices[0]]-base[e.vertices[1]]).length) for e in m.edges]
 rows.append({'amount':a,'finite':all(math.isfinite(x) for v in co for x in v),'max_edge_ratio':max(ratios),'min_edge_ratio':min(ratios)})
r={'native_closed_components':components,'native_nonmanifold_edges':non,'native_sampled_poses':len(rows),'native_finite_all':all(x['finite'] for x in rows),'wave_max_edge_ratio':max(x['max_edge_ratio'] for x in rows),'wave_min_edge_ratio':min(x['min_edge_ratio'] for x in rows),'native_vertices':len(m.vertices),'native_triangles':sum(len(p.vertices)-2 for p in m.polygons),'native_morphs':[k.name for k in m.shape_keys.key_blocks],'full_production_rig':False,'browser_runtime_tested':False,'gather_open_excluded':all(k not in m.shape_keys.key_blocks for k in ['gather','open'])}
assert components==[len(m.vertices)] and non==0 and r['native_finite_all'] and r['gather_open_excluded']
path=P+'/SaJu_B_Jade_Character_Study.glb';data=open(path,'rb').read();size,typ=struct.unpack('<II',data[12:20]);doc=json.loads(data[20:20+size]);r['glb_animation_names']=[x.get('name') for x in doc.get('animations',[])];r['glb_external_uris']=[x.get('uri') for group in ['images','buffers'] for x in doc.get(group,[]) if x.get('uri')];assert not r['glb_external_uris'];assert len(r['glb_animation_names'])==1
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=path)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];r['glb_reimport_meshes']=len(meshes);r['glb_reimport_morphs']={o.name:[k.name for k in o.data.shape_keys.key_blocks] for o in meshes if o.data.shape_keys};r['glb_pose_checks']=[]
for f in [1,8,16,25,34,41,48]:
 bpy.context.scene.frame_set(f);de=bpy.context.evaluated_depsgraph_get();coords=[o.evaluated_get(de).matrix_world@v.co for o in meshes for v in o.evaluated_get(de).data.vertices];finite=all(math.isfinite(x) for v in coords for x in v);assert finite;r['glb_pose_checks'].append({'frame':f,'finite':finite})
json.dump(r,open(P+'/release_qa.json','w'),indent=2);print(json.dumps(r,indent=2));print('RELEASE_NATIVE_CLOSED_21_POSES_AND_GLB_REIMPORT_PASS')
