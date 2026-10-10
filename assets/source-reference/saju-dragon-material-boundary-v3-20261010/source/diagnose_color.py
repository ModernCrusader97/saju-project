"""Read-only diagnosis of the V2 continuous skin color pipeline."""
import bpy, sys, argparse, json, hashlib, struct
from pathlib import Path
import numpy as np
ap=argparse.ArgumentParser()
ap.add_argument('--blend',required=True);ap.add_argument('--glb',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]); out=Path(a.out)
assert not out.exists()
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False)
skin=bpy.data.objects['Dragon_Continuous_Skin']; mat=skin.data.materials[0]
colors=skin.data.color_attributes['BodyTint']
rgba=np.zeros(len(colors.data)*4,dtype=np.float32);colors.data.foreach_get('color',rgba);rgba=rgba.reshape(-1,4)
teal=np.array(bpy.data.materials['Body_Teal'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3])
ivory=np.array(bpy.data.materials['Belly_Horns_Whiskers_Ivory'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3])
mix=((rgba[:,:3]-teal)@(ivory-teal))/np.dot(ivory-teal,ivory-teal)
positions=np.zeros(len(skin.data.vertices)*3,dtype=np.float32);skin.data.vertices.foreach_get('co',positions);positions=positions.reshape(-1,3)
body=positions[:,2]<2.54
head=~body
raw=Path(a.glb).read_bytes();json_len=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+json_len])
attribute_sets=[list(p['attributes']) for m in g['meshes'] for p in m['primitives']]
report={'status':'CAUSE_CONFIRMED_VERTEX_COLOR_FIELD_AND_INTERPOLATION',
 'source_blend_sha256':hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),'source_glb_sha256':hashlib.sha256(raw).hexdigest(),
 'skin':{'vertices':len(skin.data.vertices),'polygons':len(skin.data.polygons),'material_slots':len(skin.data.materials),'uv_layers':list(skin.data.uv_layers.keys()),
 'color_attribute':colors.name,'color_domain':colors.domain,'color_type':colors.data_type,
 'intermediate_mix_vertices_001_099':int(np.count_nonzero((mix>.01)&(mix<.99))),
 'body_intermediate_mix_vertices_001_099':int(np.count_nonzero(body&(mix>.01)&(mix<.99))),
 'head_vertices_preserve_count':int(np.count_nonzero(head)),
 'nodes':[{'name':n.name,'type':n.bl_idname} for n in mat.node_tree.nodes],
 'links':[{'from_node':l.from_node.name,'from_socket':l.from_socket.name,'to_node':l.to_node.name,'to_socket':l.to_socket.name} for l in mat.node_tree.links]},
 'glb':{'attributes':attribute_sets,'has_textures':bool(g.get('textures')),'images':len(g.get('images',[]))},
 'cause':'One POINT/FLOAT_COLOR BodyTint attribute feeds Base Color. The stored belly field includes radial/limb attenuation and two adjacency smoothing passes. Intermediate vertex colors are interpolated over triangles, creating a wide soft edge and uneven limb-root contours. There is no UV or texture; material assignment is a single slot.',
 'scope':'Preserve exact V2 positions, topology, normals, weights, rig/action, face colors, eyes, mane, and other material parameters.'}
out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps(report),flush=True)
