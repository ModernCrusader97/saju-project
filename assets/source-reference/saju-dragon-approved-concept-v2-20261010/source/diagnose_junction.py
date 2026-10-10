"""Diagnose actual skin junction curvature and normals; render only real neutral-clay geometry."""
import bpy,bmesh,sys,argparse,json,hashlib
from pathlib import Path
from mathutils import Vector
ap=argparse.ArgumentParser();ap.add_argument("--blend",required=True);ap.add_argument("--out",required=True)
a=ap.parse_args(sys.argv[sys.argv.index("--")+1:])
out=Path(a.out);assert not out.exists();out.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=a.blend,load_ui=False)
skin=bpy.data.objects["Dragon_Continuous_Skin"];me=skin.data
bm=bmesh.new();bm.from_mesh(me);bm.faces.ensure_lookup_table()
old=[f.normal.copy() for f in bm.faces]
boundary=sum(1 for e in bm.edges if e.is_boundary)
nonmanifold=sum(1 for e in bm.edges if not e.is_manifold)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
mismatch=sum(1 for f,n in zip(bm.faces,old) if n.dot(f.normal)<.99)
volume=bm.calc_volume(signed=True);bm.free()
neighbors=[set() for v in me.vertices]
for edge in me.edges:
 x,y=edge.vertices;neighbors[x].add(y);neighbors[y].add(x)
roots={"Front_Left":Vector((-1.47,-.16,2.30)),"Front_Right":Vector((-.55,-.31,2.24)),
"Hind_Far":Vector((.36,.10,.98)),"Hind_Near":Vector((1.12,-.37,.83))}
curvature={}
for name,c in roots.items():
 vals=[]
 for v,ns in zip(me.vertices,neighbors):
  if ns and (v.co-c).length<.43:
   avg=sum((me.vertices[j].co for j in ns),Vector())/len(ns)
   vals.append((avg-v.co).dot(v.normal))
 curvature[name]={"vertices":len(vals),"max_concave_laplacian":max(vals),
  "positive_concave_vertices":sum(x>.0001 for x in vals),
  "mean_positive_concavity":sum(max(0,x) for x in vals)/len(vals)}
report={"status":"ACTUAL_JUNCTION_GEOMETRY_DIAGNOSIS","source_sha256":hashlib.sha256(Path(a.blend).read_bytes()).hexdigest(),
"boundary_edges":boundary,"nonmanifold_edges":nonmanifold,"face_normals_differ_from_recalculation":mismatch,
"signed_mesh_volume":volume,"local_junction_curvature":curvature,
"diagnosis":"Material-independent neutral clay and curvature inspected; a positive concave surface value identifies a real inset, while normal consistency checks identify orientation problems."}
(out/"junction-diagnosis.json").write_text(json.dumps(report,indent=2),encoding="utf8")
for ob in bpy.data.collections["Dragon_Approved_Candidate"].objects:
 if ob not in (skin,bpy.data.objects["Dragon_Rig"]):ob.hide_render=True
clay=bpy.data.materials.new("Diagnostic_Neutral_Clay");clay.use_nodes=True
bs=clay.node_tree.nodes.get("Principled BSDF");bs.inputs["Base Color"].default_value=(.54,.54,.54,1);bs.inputs["Roughness"].default_value=.8
bpy.context.scene.view_layers[0].material_override=clay
cam=bpy.data.objects["Camera_ThreeQuarter"]
cam.location=(-3.0,-5.8,2.65)
cam.rotation_euler=(Vector((.96,-.1,.88))-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.ortho_scale=2.15
s=bpy.context.scene;s.camera=cam;s.frame_set(0)
s.cycles.samples=20;s.render.resolution_x=720;s.render.resolution_y=720
s.render.filepath=str(out/"hind-junction-neutral-clay.png")
bpy.ops.render.render(write_still=True)
print(json.dumps(report),flush=True)

