import bpy,sys,json,argparse,math,hashlib
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists()
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);scene=bpy.context.scene;scene.frame_set(0)
runtime=bpy.data.collections['Runtime_GLTF_Meshes'];runtime.hide_viewport=False;runtime.hide_render=False
def stats(ob):
 me=ob.data;me.calc_loop_triangles()
 return {'name':ob.name,'vertices':len(me.vertices),'triangles':len(me.loop_triangles),'polygons':len(me.polygons),'uv_layers':list(me.uv_layers.keys()),'color_layers':list(me.color_attributes.keys()),'materials':[m.name for m in me.materials], 'modifiers':[[m.name,m.type] for m in ob.modifiers],'vertex_groups':list(ob.vertex_groups.keys())}
objects=[ob for ob in runtime.objects if ob.type=='MESH'];report={'source_blend_sha256':hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),'runtime_objects':[stats(ob) for ob in objects]}
targets=[ob for ob in objects if ob.name in ['Dragon_Mane_Warm_Orange','Dragon_Belly_Horns_Whiskers_Ivory']]
assert len(targets)==2
probe=[]
for ob in targets:
 copy=ob.copy();copy.data=ob.data.copy();scene.collection.objects.link(copy)
 for m in list(copy.modifiers):copy.modifiers.remove(m)
 before=stats(copy);mod=copy.modifiers.new('Probe_Almost_Planar_Only','DECIMATE');mod.decimate_type='DISSOLVE';mod.angle_limit=math.radians(.5);mod.use_dissolve_boundaries=False;mod.delimit={'NORMAL','MATERIAL','SEAM','UV'}
 bpy.context.view_layer.update();ev=copy.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();me.calc_loop_triangles();after={'vertices':len(me.vertices),'triangles':len(me.loop_triangles),'polygons':len(me.polygons)};ev.to_mesh_clear()
 probe.append({'source_object':ob.name,'before':before,'after':after,'angle_degrees':.5,'delimit':sorted(mod.delimit),'boundary_dissolve':False,'only_probe_in_memory_no_source_save':True})
 bpy.data.objects.remove(copy,do_unlink=True)
report['conservative_probe']=probe;report['decimate_description']=bpy.types.DecimateModifier.bl_rna.description
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report,indent=2))
