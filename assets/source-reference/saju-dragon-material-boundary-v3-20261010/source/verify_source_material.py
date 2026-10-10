"""Read-only saved Blender source reload, packed pixel bytes and exact V2 face color checks."""
import bpy,sys,argparse,json,hashlib
from pathlib import Path
import numpy as np
ap=argparse.ArgumentParser()
for name in ('blend','baseline','texture','script','out'):ap.add_argument('--'+name,required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);assert not out.exists()
def body_colors():
    skin=bpy.data.objects['Dragon_Continuous_Skin'];vals=np.empty(len(skin.data.vertices)*4,dtype=np.float32);skin.data.color_attributes['BodyTint'].data.foreach_get('color',vals);return vals.reshape(-1,4)
def inputs(material):
    node=material.node_tree.nodes.get('Principled BSDF');result={}
    for port in node.inputs:
        if not hasattr(port,'default_value'):continue
        v=port.default_value
        result[port.name]=v if isinstance(v,(bool,int,float,str)) else list(v) if hasattr(v,'__iter__') else str(v)
    return result
bpy.ops.wm.open_mainfile(filepath=a.baseline,load_ui=False);old=body_colors();old_hash=hashlib.sha256(old.tobytes()).hexdigest()
old_materials={m.name:inputs(m) for m in bpy.data.materials if m.use_nodes and m.node_tree.nodes.get('Principled BSDF')}
old_skin_parameters=old_materials['Continuous_Teal_Ivory_Vertex_PBR']
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False);new=body_colors();assert np.array_equal(old,new)
for name,parameters in old_materials.items():
    if name=='Continuous_Teal_Ivory_Vertex_PBR':continue
    assert inputs(bpy.data.materials[name])==parameters,('Unrelated material changed',name)
for name in ('Continuous_Head_V2_Preserved_PBR','Continuous_Body_Clean_UV_PBR'):
    assert inputs(bpy.data.materials[name])==old_skin_parameters,('Skin PBR parameters changed',name)
skin=bpy.data.objects['Dragon_Continuous_Skin'];head=skin.data.materials[0]
assert any(n.bl_idname=='ShaderNodeVertexColor' and n.layer_name=='RuntimeTint' for n in head.node_tree.nodes)
colors=skin.data.color_attributes['RuntimeTint'];face_count=0;head_color_max_error=0
for p in skin.data.polygons:
    if p.material_index!=0:continue
    face_count+=1
    for li in p.loop_indices:
        delta=max(abs(x-y) for x,y in zip(colors.data[li].color,old[skin.data.loops[li].vertex_index]));head_color_max_error=max(head_color_max_error,delta)
assert head_color_max_error==0
image=bpy.data.images['Dragon_V3_Body_BaseColor'];assert image.packed_file and list(image.size)==[4096,4096]
packed=bytes(image.packed_file.data);assert packed==Path(a.texture).read_bytes()
script=bpy.data.texts['material_boundary_v3.py'].as_string().encode('utf8');assert script==Path(a.script).read_bytes()
approved=[im for im in bpy.data.images if im.packed_file and hashlib.sha256(bytes(im.packed_file.data)).hexdigest()=='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'];assert len(approved)==1
assert not any(im.name.startswith('TEMP_') for im in bpy.data.images)
report={'status':'PASS_SAVED_SOURCE_RELOAD_FACE_FIELD_AND_PACKED_BYTES',
 'blend_sha256':hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),
 'original_BodyTint_exact_v2':True,'original_BodyTint_sha256':old_hash,
 'unrelated_material_parameters_exact_v2':True,'head_and_body_PBR_parameters_exact_v2':True,
 'face_corner_colors_exact_v2':True,'head_color_max_error':head_color_max_error,'preserved_head_face_count':face_count,
 'packed_texture_sha256':hashlib.sha256(packed).hexdigest(),'packed_generator_sha256':hashlib.sha256(script).hexdigest(),
 'approved_reference_packed_bytes_verified':True,'uv_layers':list(skin.data.uv_layers.keys()),
 'base_color_texture_embedded':True,'temporary_bake_images_removed':True}
out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report),flush=True)
