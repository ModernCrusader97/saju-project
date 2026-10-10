"""V3 material-only repair, from the exact preserved V2 Blender source.
blender --background --factory-startup --threads 4 --python-exit-code 1
 --python repair_material_boundary.py -- --blend <V2.blend> --out <NEW_FOLDER> [--stills]
No positions, topology, normals, weights, rig, action, face field or studio changes.
"""
import bpy, math, sys, json, hashlib, argparse, struct
from pathlib import Path
import numpy as np
ap=argparse.ArgumentParser();ap.add_argument('--blend',required=True);ap.add_argument('--out',required=True);ap.add_argument('--stills',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.blend).resolve();out=Path(a.out).resolve()
BASE_SHA='0e4cd443c67a180bfff6befd7b2d5b67dca70ad298f0ecea5e83ba1a22396938'
assert hashlib.sha256(source.read_bytes()).hexdigest()==BASE_SHA,'Requires exact V2 source'
assert not out.exists(),'Use new output folder; preserve V2 and earlier trials'
out.mkdir(parents=True);(out/'previews').mkdir();(out/'textures').mkdir()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
scene=bpy.context.scene;scene.frame_set(0);bpy.context.view_layer.update()
skin=bpy.data.objects['Dragon_Continuous_Skin'];runtime=bpy.data.collections['Runtime_GLTF_Meshes']
runtime_skin=next(o for o in runtime.objects if o.type=='MESH' and 'Continuous_Teal_Ivory' in o.name)
def dh(value):return hashlib.sha256(json.dumps(value,separators=(',',':'),sort_keys=True).encode()).hexdigest()
def geometry(ob):
    return dh({'positions':[list(v.co) for v in ob.data.vertices], 'normals':[list(v.normal) for v in ob.data.vertices],
      'polygons':[list(p.vertices) for p in ob.data.polygons],'smooth':[p.use_smooth for p in ob.data.polygons],
      'weights':[[[g.group,g.weight] for g in v.groups] for v in ob.data.vertices],
      'group_names':[g.name for g in ob.vertex_groups],'world':[list(r) for r in ob.matrix_world],
      'parent':ob.parent.name if ob.parent else None,'modifiers':[[m.name,m.type,m.object.name if m.type=='ARMATURE' and m.object else None] for m in ob.modifiers]})
objects=[o for c in ('Dragon_Approved_Candidate','Runtime_GLTF_Meshes','Editable_Construction_Source') for o in bpy.data.collections[c].objects if o.type=='MESH']
before={o.name:geometry(o) for o in objects}
def pose_snapshot():
    rig=bpy.data.objects['Dragon_Rig'];data=[]
    for f in range(145):
        scene.frame_set(f);bpy.context.view_layer.update()
        data.append([[list(r) for r in b.matrix] for b in rig.pose.bones])
    scene.frame_set(0);bpy.context.view_layer.update();return dh(data)
pose_before=pose_snapshot()
studio_before=dh([{'name':o.name,'world':[list(r) for r in o.matrix_world],
 'energy':o.data.energy if o.type=='LIGHT' else None,'size':o.data.size if o.type=='LIGHT' else None,
 'scale':o.data.ortho_scale if o.type=='CAMERA' else None} for o in bpy.data.collections['Preview_Studio'].objects])
vcount=len(skin.data.vertices);lcount=len(skin.data.loops)
rgba=np.empty(vcount*4,dtype=np.float32);skin.data.color_attributes['BodyTint'].data.foreach_get('color',rgba);rgba=rgba.reshape(-1,4)
original_color_sha=hashlib.sha256(rgba.tobytes()).hexdigest()
pos=np.empty(vcount*3,dtype=np.float32);skin.data.vertices.foreach_get('co',pos);pos=pos.reshape(-1,3)
teal=np.array(bpy.data.materials['Body_Teal'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3],dtype=np.float32)
ivory=np.array(bpy.data.materials['Belly_Horns_Whiskers_Ivory'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3],dtype=np.float32)
# Preserve the entire upper head and the lower front facial surface. The
# adjoining neck is body paint, so the old fuzzy neck strip is repaired too.
face_vertices=(pos[:,2]>=2.73)|((pos[:,2]>=2.54)&(pos[:,0]<-.24)&(pos[:,1]<-.33))
body_faces=np.array([not any(face_vertices[i] for i in p.vertices) for p in skin.data.polygons])
# glTF vertex-color multiplier is white on the textured body. Face corner colors are exact V2 values.
runtime_tint=skin.data.color_attributes.new(name='RuntimeTint',type='FLOAT_COLOR',domain='CORNER')
loop_tint=np.ones((lcount,4),dtype=np.float32)
for p in skin.data.polygons:
    if not body_faces[p.index]:
        for li in p.loop_indices:loop_tint[li]=rgba[skin.data.loops[li].vertex_index]
runtime_tint.data.foreach_set('color',loop_tint.reshape(-1));skin.data.color_attributes.active_color_index=list(skin.data.color_attributes.keys()).index('RuntimeTint')
skin.data.color_attributes.render_color_index=list(skin.data.color_attributes.keys()).index('RuntimeTint')
legacy=skin.data.materials[0]
head=legacy.copy();head.name='Continuous_Head_V2_Preserved_PBR'
for n in head.node_tree.nodes:
    if n.bl_idname=='ShaderNodeVertexColor':n.layer_name='RuntimeTint'
body_material=legacy.copy();body_material.name='Continuous_Body_Clean_UV_PBR'
tree=body_material.node_tree;bs=tree.nodes.get('Principled BSDF')
for n in list(tree.nodes):
    if n.bl_idname=='ShaderNodeVertexColor':tree.nodes.remove(n)
skin.data.materials.clear();skin.data.materials.append(head);skin.data.materials.append(body_material)
for p in skin.data.polygons:p.material_index=1 if body_faces[p.index] else 0
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
uv=skin.data.uv_layers.new(name='BoundaryUV')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
uvopts=dict(angle_limit=math.radians(66),island_margin=.014,area_weight=0.0,correct_aspect=True,scale_to_bounds=True)
uvprops=bpy.ops.uv.smart_project.get_rna_type().properties.keys();bpy.ops.uv.smart_project(**{k:v for k,v in uvopts.items() if k in uvprops})
bpy.ops.object.mode_set(mode='OBJECT')
print('UV_READY',len(skin.data.uv_layers.active.data),flush=True)
image=bpy.data.images.new('Dragon_V3_Body_BaseColor',width=4096,height=4096,alpha=True,float_buffer=False)
image.colorspace_settings.name='sRGB';image.file_format='PNG';image.filepath_raw=str(out/'textures'/'Dragon_V3_Body_BaseColor.png')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.margin=24;scene.render.bake.use_clear=True
# Bake normalized rest positions to a FLOAT/NONCOLOR UV buffer. This is a material
# evaluation aid, not a geometry edit; no mesh operation follows the existing UV unwrap.
pos_attr=skin.data.color_attributes.new(name='BoundaryRestPosition',type='FLOAT_COLOR',domain='POINT')
low=np.array([-2.3,-1.4,-.2],dtype=np.float32);span=np.array([5.4,2.8,4.6],dtype=np.float32)
pos_rgba=np.ones((vcount,4),dtype=np.float32);pos_rgba[:,:3]=(pos-low)/span;pos_attr.data.foreach_set('color',pos_rgba.reshape(-1))
position_image=bpy.data.images.new('TEMP_BoundaryRestPosition',width=4096,height=4096,alpha=True,float_buffer=True)
position_image.colorspace_settings.name='Non-Color'
position_mat=bpy.data.materials.new('TEMP_Bake_RestPosition');position_mat.use_nodes=True;pt=position_mat.node_tree;pt.nodes.clear()
po=pt.nodes.new('ShaderNodeOutputMaterial');pe=pt.nodes.new('ShaderNodeEmission');pc=pt.nodes.new('ShaderNodeVertexColor');pc.layer_name='BoundaryRestPosition'
pt.links.new(pc.outputs['Color'],pe.inputs['Color']);pt.links.new(pe.outputs['Emission'],po.inputs['Surface']);pi=pt.nodes.new('ShaderNodeTexImage');pi.image=position_image;pt.nodes.active=pi
skin.data.materials[0]=position_mat;skin.data.materials[1]=position_mat;bpy.ops.object.bake(type='EMIT',margin=24,use_clear=True)
pixels=np.empty(4096*4096*4,dtype=np.float32);position_image.pixels.foreach_get(pixels);pixels=pixels.reshape(-1,4)
valid=(pixels[:,:3].max(axis=1)>.04)&(pixels[:,3]>.1)
points=pixels[valid,:3]*span+low
print('REST_POSITION_PIXELS_READY',len(points),flush=True)
BODY_P=np.array([[-1.05,.03,3.10],[-1.08,.01,2.62],[-.88,.01,2.20],[-.27,.06,2.17],[.44,.13,2.29],[1.06,.16,2.08],[1.22,.13,1.58],[.97,.08,1.13],[.62,.03,.72],[.91,.00,.38],[1.51,.02,.34],[2.08,.08,.53],[2.47,.18,.91],[2.66,.25,1.36],[2.70,.28,1.65]],dtype=np.float32)
BODY_R=np.array([.40,.42,.47,.53,.54,.49,.43,.39,.34,.285,.235,.18,.13,.075,.01],dtype=np.float32)
def catmull(values,u):
    x=min(1,max(0,u))*(len(values)-1);j=min(len(values)-2,int(x));f=x-j
    p0=values[max(0,j-1)];p1=values[j];p2=values[j+1];p3=values[min(len(values)-1,j+2)]
    return .5*(2*p1+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)
centers=np.array([catmull(BODY_P,u) for u in np.linspace(0,1,360)],dtype=np.float32)
radii=np.array([max(.005,float(catmull(BODY_R,u))) for u in np.linspace(0,1,360)],dtype=np.float32)
tangents=np.concatenate((centers[1:2]-centers[:1],centers[2:]-centers[:-2],centers[-1:]-centers[-2:-1]),axis=0)
tangents/=np.linalg.norm(tangents,axis=1)[:,None]
normals=np.stack((-tangents[:,2],np.zeros(360,dtype=np.float32),tangents[:,0]),axis=1);normals/=np.linalg.norm(normals,axis=1)[:,None]
depth=np.cross(tangents,normals);depth[depth[:,1]<0]*=-1
segments=centers[1:]-centers[:-1];length2=np.sum(segments*segments,axis=1)
limbs=[np.array(q,dtype=np.float32) for q in [
 [[-1.30,.01,2.43],[-1.65,-.14,2.25],[-1.66,-.40,2.20]],
 [[-.79,.01,2.32],[-.47,-.32,2.17],[-.43,-.58,2.19]],
 [[.72,.08,1.06],[.22,.27,.98],[.10,.02,.91]],
 [[.98,.03,1.00],[1.28,-.37,.77],[1.30,-.58,.78]]]]
def sstep(lo,hi,x):
    t=np.clip((x-lo)/(hi-lo),0,1);return t*t*(3-2*t)
def continuous_mask(p):
    best_d=np.full(len(p),1e6,dtype=np.float32);best_j=np.zeros(len(p),dtype=np.int32);best_t=np.zeros(len(p),dtype=np.float32)
    for j,v in enumerate(segments):
        rel=p-centers[j];t=np.clip((rel@v)/length2[j],0,1);d=np.sum((rel-t[:,None]*v)**2,axis=1);take=d<best_d
        best_d=np.where(take,d,best_d);best_j=np.where(take,j,best_j);best_t=np.where(take,t,best_t)
    j=best_j;t=best_t;u=(j+t)/(len(centers)-1);c=centers[j]+segments[j]*t[:,None]
    n=normals[j]*(1-t[:,None])+normals[j+1]*t[:,None];n/=np.linalg.norm(n,axis=1)[:,None]
    b=depth[j]*(1-t[:,None])+depth[j+1]*t[:,None];b/=np.linalg.norm(b,axis=1)[:,None]
    rel=p-c;x=np.sum(rel*n,axis=1);y=np.sum(rel*b,axis=1)/.90
    angle=np.arctan2(y,x);central=-math.pi/2-.32*np.clip((u-.12)*4,0,1);delta=(angle-central+math.pi)%(2*math.pi)-math.pi
    half=.82-.16*sstep(.84,.90,u);body_distance=(half-np.abs(delta))*(radii[j]*(1-t)+radii[j+1]*t)
    # Exclude each teal paw with a continuous capsule envelope, replacing the old
    # products of attenuated vertex values. Polynomial min rounds intersections.
    margin=body_distance
    for q in limbs:
        limb_d=np.full(len(p),1e6,dtype=np.float32);progress=np.zeros(len(p),dtype=np.float32)
        for k in range(2):
            v=q[k+1]-q[k];tt=np.clip(((p-q[k])@v)/np.dot(v,v),0,1);dd=np.linalg.norm(p-q[k]-tt[:,None]*v,axis=1);take=dd<limb_d
            limb_d=np.where(take,dd,limb_d);progress=np.where(take,(k+tt)/2,progress)
        radius=.32*sstep(.035,.26,progress)
        exclusion=limb_d-radius
        # A 0.05-unit smooth minimum produces a rounded color join only.
        h=np.clip(.5+.5*(exclusion-margin)/.05,0,1);margin=exclusion*(1-h)+margin*h-.05*h*(1-h)
    # Narrow antialias transition instead of wide material bleed.
    return sstep(-.0025,.0025,margin)
rgb=np.zeros((len(pixels),3),dtype=np.float32);rgb[:]=teal
ids=np.flatnonzero(valid)
for start in range(0,len(points),65536):
    pp=points[start:start+65536];mm=continuous_mask(pp);rgb[ids[start:start+len(pp)]]=teal[None,:]*(1-mm[:,None])+ivory[None,:]*mm[:,None]
    if start%(65536*32)==0:print('CONTINUOUS_BODY_COLOR_PIXELS',start,len(points),flush=True)
# Byte images expose encoded sRGB values through Image.pixels.
rgb=np.where(rgb<=.0031308,12.92*rgb,1.055*np.power(np.maximum(rgb,0),1/2.4)-.055)
pixels[:,:3]=rgb;pixels[:,3]=1;image.pixels.foreach_set(pixels.reshape(-1));image.save();image.pack()
skin.data.color_attributes.remove(pos_attr);bpy.data.images.remove(position_image);bpy.data.materials.remove(position_mat)
skin.data.materials[0]=head;skin.data.materials[1]=body_material
tex=tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear';tex.extension='EXTEND'
tex.label='4096px crisp body boundary; exact head vertex field remains separate'
uvnode=tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map='BoundaryUV';tree.links.new(uvnode.outputs['UV'],tex.inputs['Vector']);tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
print('BODY_TEXTURE_BAKED',str(image.filepath_raw),flush=True)
# Transfer ONLY UV and color/material data to the existing export copy, in matching loop order.
assert len(runtime_skin.data.vertices)==vcount and [list(p.vertices) for p in runtime_skin.data.polygons]==[list(p.vertices) for p in skin.data.polygons]
uvcoords=np.empty(lcount*2,dtype=np.float32);skin.data.uv_layers['BoundaryUV'].data.foreach_get('uv',uvcoords)
rtuv=runtime_skin.data.uv_layers.new(name='BoundaryUV');rtuv.data.foreach_set('uv',uvcoords)
for ca in list(runtime_skin.data.color_attributes):runtime_skin.data.color_attributes.remove(ca)
rtcolor=runtime_skin.data.color_attributes.new(name='RuntimeTint',type='FLOAT_COLOR',domain='CORNER');rtcolor.data.foreach_set('color',loop_tint.reshape(-1))
runtime_skin.data.color_attributes.active_color_index=0;runtime_skin.data.color_attributes.render_color_index=0
runtime_skin.data.materials.clear();runtime_skin.data.materials.append(head);runtime_skin.data.materials.append(body_material)
for p in runtime_skin.data.polygons:p.material_index=1 if body_faces[p.index] else 0
after={o.name:geometry(o) for o in objects};assert before==after,'Geometry/normal/weight/object drift'
pose_after=pose_snapshot();assert pose_before==pose_after,'Rig/animation drift'
recheck=np.empty(vcount*4,dtype=np.float32);skin.data.color_attributes['BodyTint'].data.foreach_get('color',recheck)
assert hashlib.sha256(recheck.tobytes()).hexdigest()==original_color_sha,'Original face color field changed'
scene.cycles.samples=48;scene.camera=bpy.data.objects['Camera_ThreeQuarter'];scene.frame_set(0)
studio_after=dh([{'name':o.name,'world':[list(r) for r in o.matrix_world],
 'energy':o.data.energy if o.type=='LIGHT' else None,'size':o.data.size if o.type=='LIGHT' else None,
 'scale':o.data.ortho_scale if o.type=='CAMERA' else None} for o in bpy.data.collections['Preview_Studio'].objects]);assert studio_before==studio_after
text=bpy.data.texts.new('material_boundary_v3.py');text.write(Path(__file__).read_text(encoding='utf8'));text.use_fake_user=True
rig=bpy.data.objects['Dragon_Rig'];runtime.hide_viewport=False;runtime.hide_render=False
bpy.ops.object.select_all(action='DESELECT')
for ob in list(runtime.objects)+[rig]:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
opts=dict(filepath=str(out/'SaJu_Dragon_Approved_Candidate_v3.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_materials='EXPORT',export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in opts.items() if k in props})
runtime.hide_render=True;runtime.hide_viewport=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'SaJu_Dragon_Approved_Candidate_v3.blend'),compress=True)
report={'status':'MATERIAL_ONLY_V3_GENERATED','source_v2_blend_sha256':BASE_SHA,
 'geometry_normals_weights_objects_exact_unchanged':before==after,'verified_mesh_objects':len(objects),
 'original_BodyTint_exact_unchanged':True,'preserved_face_region':'All vertices z >= 2.73, plus lower front face x < -0.24 / y < -0.33 / z >= 2.54','preserved_head_face_count':int(np.count_nonzero(~body_faces)),
 'repaired_body_face_count':int(np.count_nonzero(body_faces)),'pose_145_frames_exact_unchanged':True,'pose_matrix_sha256':pose_before,
 'studio_camera_lights_exact_unchanged':True,'uv_layer':'BoundaryUV','texture_pixels':[4096,4096],
 'texture_sha256':hashlib.sha256((out/'textures'/'Dragon_V3_Body_BaseColor.png').read_bytes()).hexdigest(),
 'changes':'Only body material/UV: continuous rest-position contour and rounded paw color exclusions, baked into embedded PBR base-color PNG. Face retains exact original corner-color interpolation; all original BodyTint data retained.',
 'remaining_scope':'222646 triangles and 10 Khronos hierarchy warnings are existing separate items; no mobile optimization or hierarchy modification.'}
(out/'material-only-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps(report),flush=True)
if a.stills:
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    for view,name in [('front','Front'),('threequarter','ThreeQuarter'),('side','Side')]:
        scene.camera=bpy.data.objects['Camera_'+name];bpy.data.objects['Preview_Floor'].hide_render=(view!='threequarter')
        scene.render.filepath=str(out/'previews'/(view+'.png'));bpy.ops.render.render(write_still=True)
    print('V3_ACTUAL_STILLS_READY',flush=True)
