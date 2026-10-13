"""Verify actual native geometry, weights, sampled loop and GLB round trip; render real idle.
Run with installed Blender: --background --threads 4 --python-exit-code 1 --python verify_native.py --
  --blend ... --glb ... --out NEW_ABSOLUTE_DIRECTORY [--movie]
"""
import bpy, math, json, sys, argparse, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
ap=argparse.ArgumentParser()
ap.add_argument("--blend",required=True)
ap.add_argument("--glb",required=True)
ap.add_argument("--out",required=True)
ap.add_argument("--movie",action="store_true")
ap.add_argument("--source-static",required=True)
ap.add_argument("--source-bind",required=True)
a=ap.parse_args(argv)
out=Path(a.out).resolve()
assert not out.exists(),"Use a new QA folder"
out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(a.blend).resolve()),load_ui=False)
scene=bpy.context.scene
scene.frame_set(0); bpy.context.view_layer.update()
char=bpy.data.collections["Dragon_V8_New_Static_Construction"]
skin=bpy.data.objects["Dragon_Continuous_Skin"]
rig=bpy.data.objects["Dragon_V8_Rig"]
report={"status":"RUNNING","source_blend_sha256":hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),
        "glb_sha256":hashlib.sha256(Path(a.glb).read_bytes()).hexdigest(),"checks":{}}
parent=list(range(len(skin.data.vertices)))
def find(x):
    while parent[x]!=x:
        parent[x]=parent[parent[x]];x=parent[x]
    return x
for edge in skin.data.edges:
    x,y=map(find,edge.vertices)
    if x!=y:parent[y]=x
components=len({find(i) for i in range(len(parent))})
assert components==1,("Continuous skin disconnected",components)
report["checks"]["continuous_skin_components"]=components
import bmesh
for ob in [skin]:
    bm=bmesh.new();bm.from_mesh(ob.data);seen=set();cc=0
    for vertex in bm.verts:
        if vertex in seen:continue
        cc+=1;seen.add(vertex);todo=[vertex]
        while todo:
            for edge in todo.pop().link_edges:
                for q in edge.verts:
                    if q not in seen:seen.add(q);todo.append(q)
    chi=len(bm.verts)-len(bm.edges)+len(bm.faces);nonmanifold=sum(not e.is_manifold for e in bm.edges);handles=(2*cc-chi)//2
    assert nonmanifold==0 and handles==0,(ob.name,'Surface holes or nonmanifold geometry',nonmanifold,handles)
    report['checks'][ob.name+'_topology']={'closed_components':cc,'euler_characteristic':chi,'unintended_handles':handles,'nonmanifold_edges':nonmanifold}
    bm.free()
weight_errors=[]
for ob in [o for o in char.objects if o.type=="MESH"]:
    for v in ob.data.vertices:
        total=sum(g.weight for g in v.groups)
        if abs(total-1)>1e-4 or len(v.groups)>4:weight_errors.append([ob.name,v.index,total,len(v.groups)])
assert not weight_errors,weight_errors[:10]
report["checks"]["skin_weights_normalized"]=True
report["checks"]["bones"]=len(rig.pose.bones)
report["checks"]["vertex_color_on_same_skin"]=skin.data.color_attributes.get("BodyTint") is not None
assert report["checks"]["vertex_color_on_same_skin"]
runtime=bpy.data.collections["V8_Runtime_GLTF_Meshes"]
native_parts=[o for o in char.objects if o.type=="MESH"]
def vertices(parts,frame):
    scene.frame_set(frame);bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    result=[]
    for ob in parts:
        ev=ob.evaluated_get(dg)
        me=ev.to_mesh()
        matrix=ev.matrix_world
        result.extend([matrix@v.co for v in me.vertices])
        ev.to_mesh_clear()
    return result
frames=[0,36,72,108,144]
native_clouds={f:vertices(native_parts,f) for f in frames}
assert len(native_clouds[0])==len(native_clouds[144])
closure=max((x-y).length for x,y in zip(native_clouds[0],native_clouds[144]))
assert closure<1e-5,("Native loop closure",closure)
report["checks"]["native_loop_max_vertex_error"]=closure

# Sample all skin vertices and a spread of edges at the four motion extrema.
scene.frame_set(0);bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
ev=skin.evaluated_get(dg); me=ev.to_mesh()
base=[skin.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
edge_ids=[tuple(e.vertices) for e in skin.data.edges][::9]
base_lengths=[(base[x]-base[y]).length for x,y in edge_ids]
max_ratio=1.;min_ratio=1.;max_motion=0.
deformation_frames=list(range(12,145,12))
for f in deformation_frames:
    scene.frame_set(f);bpy.context.view_layer.update()
    ev=skin.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
    coords=[skin.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
    for p,q in zip(base,coords):max_motion=max(max_motion,(p-q).length)
    for (x,y),before in zip(edge_ids,base_lengths):
        if before<1e-6:continue
        ratio=(coords[x]-coords[y]).length/before
        max_ratio=max(max_ratio,ratio);min_ratio=min(min_ratio,ratio)
assert .78<min_ratio<=max_ratio<1.23,("Joint edge distortion",min_ratio,max_ratio)
assert max_motion>.03,("Idle did not move actual skin",max_motion)
report["checks"]["sampled_edge_length_ratio"]=[min_ratio,max_ratio]
report["checks"]["sampled_skin_motion_max"]=max_motion
report["checks"]["sampled_frames"]=frames
report["checks"]["deformation_frames"]=deformation_frames
report["checks"]["deformation_guards_unchanged"]=[.78,1.23]
report["checks"]["sampled_edge_count"]=len(edge_ids)
near_start=vertices(native_parts,1);near_end=vertices(native_parts,143)
velocity_error=max(((p1-p0)-(p144-p143)).length for p0,p1,p143,p144 in zip(native_clouds[0],near_start,near_end,native_clouds[144]))
assert velocity_error<.006,('Loop boundary first/last sampled velocity mismatch',velocity_error)
report['checks']['native_loop_sampled_boundary_velocity_error_per_frame']=velocity_error
# Native normals must be finite and nonzero, including the separate fitted eye caps.
badnormals=0
for ob in native_parts:
    for v in ob.data.vertices:
        if not all(math.isfinite(x) for x in v.normal) or v.normal.length<.5:badnormals+=1
assert badnormals==0,("Invalid native normals",badnormals)
report["checks"]["invalid_native_vertex_normals"]=badnormals
# Packed approved pixels and both literal authoring scripts must match their delivered bytes.
packed=[]
for image in bpy.data.images:
    if image.packed_file:packed.append({'name':image.name,'bytes':len(image.packed_file.data),'sha256':hashlib.sha256(image.packed_file.data).hexdigest()})
assert any(x['bytes']==1651398 and x['sha256']=='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58' for x in packed)
texts=[]
for name,path in [('REGENERATE_build_dragon_v8_static.py',a.source_static),('REGENERATE_bind_idle_export_v8.py',a.source_bind)]:
    expected=Path(path).read_bytes();actual=bpy.data.texts[name].as_string().encode('utf8')
    assert actual==expected,('Packed source bytes differ',name)
    texts.append({'name':name,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()})
assert not bpy.data.libraries
report['checks']['packed_approved_source_image']=packed
report['checks']['packed_authoring_literal_bytes']=texts
report['user_final_appearance_approved']=False
report['technical_checks_do_not_measure_photo_fidelity']=True
# Capture native sample bounds.
allpoints=[p for cloud in native_clouds.values() for p in cloud]
mins=[min(p[k] for p in allpoints) for k in range(3)]
maxs=[max(p[k] for p in allpoints) for k in range(3)]
report["checks"]["native_sampled_bounds_zup"]={"min":mins,"max":maxs}
# GLB import in the same isolated background scene: studio is preserved, original character hidden.
char.hide_render=True
runtime.hide_render=True
scene.frame_set(0)
oldobjects=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
imported=[o for o in bpy.data.objects if o not in oldobjects]
# The official importer creates an Icosphere for bone custom-shapes in
# glTF_not_exported. It is an editing control, absent from the GLB mesh nodes.
controls={pb.custom_shape for ob in imported if ob.type=="ARMATURE"
          for pb in ob.pose.bones if pb.custom_shape is not None}
meshes=[o for o in imported if o.type=="MESH" and o not in controls]
for ob in controls:ob.hide_render=True
raw=Path(a.glb).read_bytes()
spec=json.loads(raw[20:20+int.from_bytes(raw[12:16],"little")])
assert len(meshes)==len(spec["meshes"]),("Imported model mesh count",len(meshes),len(spec["meshes"]))
report["checks"]["importer_control_objects_excluded"]=[o.name for o in controls]
assert meshes, "Official Blender glTF importer produced no meshes"
report["checks"]["glb_import_mesh_count"]=len(meshes)
import_clouds={}
nearest_errors={}
for f in frames:
    cloud=vertices(meshes,f)
    kd=KDTree(len(native_clouds[f]))
    for i,p in enumerate(native_clouds[f]):kd.insert(p,i)
    kd.balance()
    err=max(kd.find(p)[2] for p in cloud)
    nearest_errors[str(f)]=err
    import_clouds[f]=cloud
report["checks"]["glb_roundtrip_max_nearest_vertex_error"]=nearest_errors
(out/"native-glb-verification.json").write_text(json.dumps(report,indent=2),encoding="utf8")
assert max(nearest_errors.values())<.0005,("GLB/native geometric mismatch",nearest_errors)
report["checks"]["glb_roundtrip_max_nearest_vertex_error"]=nearest_errors
report["checks"]["glb_source_geometry_preserved"]=True
report["checks"]["glb_animation_reimported"]=any(
    o.animation_data and o.animation_data.action for o in imported)
assert report["checks"]["glb_animation_reimported"]
scene.frame_set(0);bpy.context.view_layer.update()
scene.camera=bpy.data.objects["Camera_ThreeQuarter"]
bpy.data.objects["Preview_Floor"].hide_render=False
scene.render.engine="CYCLES";scene.cycles.device="CPU";scene.cycles.samples=24
scene.cycles.use_denoising=False
scene.render.threads_mode="FIXED";scene.render.threads=4
scene.render.resolution_x=640;scene.render.resolution_y=640
scene.render.image_settings.file_format="PNG"
camera_records={}
for view,name in [('front','Front'),('threequarter','ThreeQuarter'),('side','Side'),('headfront','HeadFront'),('headthreequarter','HeadThreeQuarter')]:
    scene.camera=bpy.data.objects['Camera_'+name];bpy.data.objects['Preview_Floor'].hide_render=view!='threequarter'
    scene.render.filepath=str(out/('glb-reimport-'+view+'.png'));bpy.ops.render.render(write_still=True)
    cam=scene.camera;camera_records[view]={'location':list(cam.location),'rotation_euler':list(cam.rotation_euler),'ortho_scale':cam.data.ortho_scale,'resolution':[640,640],'frame':0,'cycles_samples':24}
report['checks']['actual_imported_glb_camera_records']=camera_records
scene.camera=bpy.data.objects['Camera_ThreeQuarter'];bpy.data.objects['Preview_Floor'].hide_render=False
report["checks"]["glb_actual_render"]="glb-reimport-threequarter.png"
formats=[x.identifier for x in scene.render.image_settings.bl_rna.properties["file_format"].enum_items]
report["video_formats_available"]=formats
report["status"]="PASS_NATIVE_AND_GLB_ROUNDTRIP"
(out/"native-glb-verification.json").write_text(json.dumps(report,indent=2),encoding="utf8")
print("NATIVE_GLB_QA_PASS",json.dumps(report["checks"]),flush=True)
if a.movie:
    scene.render.engine="CYCLES";scene.cycles.samples=10;scene.cycles.use_denoising=False
    scene.render.resolution_x=640;scene.render.resolution_y=640
    scene.render.fps=12;scene.frame_start=0;scene.frame_end=143;scene.frame_step=2
    # PNG frames are portable across Blender builds; encode with encode_idle.mjs.
    frames_dir=out/"idle-frames";frames_dir.mkdir()
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(frames_dir/"frame_")
    bpy.ops.render.render(animation=True)
    print("ACTUAL_GLB_IDLE_FRAMES_READY",flush=True)

