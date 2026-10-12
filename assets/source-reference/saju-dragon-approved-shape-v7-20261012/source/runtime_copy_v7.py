"""Rebuild runtime copies at explicit world rest transforms; keep authoring intact."""
import bpy,sys,pathlib,argparse,json,hashlib
from collections import defaultdict
from mathutils import Matrix
from mathutils.kdtree import KDTree
ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--out',required=True);ap.add_argument('--expected-input-sha256',required=True);a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);src=pathlib.Path(a.input);out=pathlib.Path(a.out);h=lambda b:hashlib.sha256(b).hexdigest();original=h(src.read_bytes());assert original==a.expected_input_sha256;assert not out.exists();out.mkdir();bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False);scene=bpy.context.scene;rig=bpy.data.objects['Dragon_Rig'];char=bpy.data.collections['Dragon_Approved_Candidate'];runtime=bpy.data.collections['Runtime_GLTF_Meshes'];skin=bpy.data.objects['Dragon_Continuous_Skin'];parts=[o for o in char.objects if o.type=='MESH']
def geom(o):return h(json.dumps({'vertices':[list(v.co) for v in o.data.vertices],'normals':[list(v.normal) for v in o.data.vertices],'faces':[list(p.vertices) for p in o.data.polygons],'weights':[[[o.vertex_groups[g.group].name,g.weight] for g in v.groups] for v in o.data.vertices],'material_indices':[p.material_index for p in o.data.polygons],'materials':[m.name for m in o.data.materials],'uv':{u.name:[list(x.uv) for x in u.data] for u in o.data.uv_layers},'matrix':[list(r) for r in o.matrix_world]},separators=(',',':')).encode())
before={o.name:geom(o) for o in parts};images={im.name:h(im.packed_file.data) for im in bpy.data.images if im.packed_file};pose_position=rig.data.pose_position;rig.data.pose_position='REST';bpy.context.view_layer.update();runtime.hide_viewport=False;runtime.hide_render=False
old_runtime_names=[o.name for o in runtime.objects if o.type=='MESH']
for o in list(runtime.objects):assert o.type=='MESH';bpy.data.objects.remove(o,do_unlink=True)
by=defaultdict(list)
for o in parts:
 assert all(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)
 world=o.matrix_world.copy();copy=o.copy();copy.data=o.data.copy();copy.data.transform(world);copy.matrix_parent_inverse=Matrix.Identity(4);copy.parent=rig;copy.matrix_world=Matrix.Identity(4);runtime.objects.link(copy);copy.name='Runtime_ExplicitWorld_'+o.name;key='Continuous_Teal_Ivory_Textured_PBR' if o==skin else o.data.materials[0].name;by[key].append(copy)
bpy.context.view_layer.update()
for name,group in by.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]
 if len(group)>1:bpy.ops.object.join()
 group[0].name='Dragon_'+name
bpy.context.view_layer.update();rts=[o for o in runtime.objects if o.type=='MESH'];assert len(rts)==10
# Actual raw runtime rest points must reproduce native authoring geometry.
tree=KDTree(sum(len(o.data.vertices) for o in parts));n=0
for o in parts:
 for v in o.data.vertices:tree.insert(o.matrix_world@v.co,n);n+=1
tree.balance();maximum=0
for o in rts:
 for v in o.data.vertices:
  _,_,d=tree.find(o.matrix_world@v.co);maximum=max(maximum,float(d));assert d<.000005,(o.name,v.index,d)
rig.data.pose_position=pose_position;scene.frame_set(0);bpy.context.view_layer.update();after={o.name:geom(o) for o in parts};assert before==after,'Authoring geometry/weights/UV/material drift';assert images=={im.name:h(im.packed_file.data) for im in bpy.data.images if im.packed_file}
text=bpy.data.texts.new('explicit_world_runtime_copy_v7.py');text.write(pathlib.Path(__file__).read_text(encoding='utf8'));text.use_fake_user=True;bpy.ops.object.select_all(action='DESELECT')
for o in rts+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig;opts=dict(filepath=str(out/'SaJu_Dragon_Approved_Shape_v7.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False);props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in opts.items() if k in props});runtime.hide_viewport=True;runtime.hide_render=True;bpy.ops.wm.save_as_mainfile(filepath=str(out/'SaJu_Dragon_Approved_Shape_v7.blend'),compress=True)
report={'status':'PASS_EXPLICIT_WORLD_RUNTIME_COPY_GEOMETRY','input_sha256':original,'authoring_geometry_normals_weights_uv_materials_exact_unchanged':True,'packed_images_exact_unchanged':images,'runtime_meshes':len(rts),'runtime_rest_point_match_max_error':maximum,'old_runtime_names':old_runtime_names,'cause':'Runtime orange copy retained identity matrix while the native mane origin was (-1.06,0.41,3.27). Bake each copied mesh with its explicit world rest matrix before material joins.','source_original_unchanged':h(src.read_bytes())==original}
with (out/'runtime-copy-repair-report.json').open('x',encoding='utf8') as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps(report),flush=True)