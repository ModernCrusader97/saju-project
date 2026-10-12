"""SaJu approved mini dragon: editable native source, skinned GLB and real renders.
Run: blender --background --factory-startup --threads 4 --python build_dragon.py --
     --out D:/absolute/new-output --reference D:/absolute/approved.png
Requires installed Blender only. Does not open or modify any existing project.
"""
import bpy, bmesh, math, json, os, sys, hashlib, argparse
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from collections import defaultdict

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--reference", required=True)
ap.add_argument("--stills", action="store_true")
ap.add_argument("--preview-resolution",type=int,default=900)
ap.add_argument("--preview-samples",type=int,default=48)
args = ap.parse_args(argv)
OUT = Path(args.out).resolve()
REF = Path(args.reference).resolve()
REF_SHA = "6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58"
assert REF.is_file() and REF.stat().st_size == 1651398, "Approved reference bytes missing"
assert hashlib.sha256(REF.read_bytes()).hexdigest() == REF_SHA, "Approved reference SHA mismatch"
assert not OUT.exists(), "Use a new output folder to preserve earlier iterations"
OUT.mkdir(parents=True)
(OUT/"previews").mkdir()
bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
SCENE.render.engine = "CYCLES"
SCENE.cycles.device = "CPU"
SCENE.cycles.samples = args.preview_samples
SCENE.cycles.use_denoising = True
SCENE.render.threads_mode = "FIXED"
SCENE.render.threads = 4
SCENE.render.resolution_x = args.preview_resolution
SCENE.render.resolution_y = args.preview_resolution
SCENE.render.resolution_percentage = 100
SCENE.render.image_settings.file_format = "PNG"
SCENE.render.fps = 24
SCENE.frame_start = 0
SCENE.frame_end = 144
SCENE.view_settings.view_transform = "AgX"
SCENE.view_settings.look = "AgX - Medium High Contrast"
SCENE.render.film_transparent = False
CHAR = bpy.data.collections.new("Dragon_Approved_Candidate")
SOURCE = bpy.data.collections.new("Editable_Construction_Source")
STUDIO = bpy.data.collections.new("Preview_Studio")
for col in (CHAR, SOURCE, STUDIO): SCENE.collection.children.link(col)
SOURCE.hide_render = True
SOURCE.hide_viewport = True
model_objects = []
skin_parts = []

def srgb(v):
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4

def mat(name, hx, rough=.65):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = [srgb(int(hx[i:i+2],16)/255) for i in (0,2,4)]
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*rgb,1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["IOR"].default_value = 1.40
    bs.inputs["Coat Weight"].default_value = 0
    bs.inputs["Specular IOR Level"].default_value = .28
    bs.inputs["Coat Roughness"].default_value = .35
    m.diffuse_color = (*rgb,1)
    return m
TEAL = mat("Body_Teal", "39AA8F")
CREAM = mat("Belly_Horns_Whiskers_Ivory", "F4DEB0")
ORANGE = mat("Mane_Warm_Orange", "F07852", .70)
BROWN = mat("Eyes_Warm_Brown", "4A2C1D", .38)
WHITE = mat("Eyes_Soft_Ivory", "FFF7E5", .48)
DARK = mat("Nostrils_Deep_Teal", "216551", .55)
MOUTH = mat("Smile_Warm_Deep_Teal", "387A65", .50)
GROOVE = mat("Belly_Subtle_Seams", "E9D2A7", .72)
INNER = mat("Ear_Inner_Ivory", "EED6AA")
FLOOR = mat("Studio_Warm_Neutral", "EDE4D7", .8)

def in_collection(obj, col=CHAR):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)

def mesh(name, vertices, faces, material=TEAL, model=True):
    me = bpy.data.meshes.new(name+"_Mesh")
    me.from_pydata(vertices, [], faces)
    me.update()
    bm=bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    CHAR.objects.link(ob)
    ob.data.materials.append(material)
    for poly in me.polygons: poly.use_smooth = True
    if model: model_objects.append(ob)
    return ob

def ellipsoid(name, loc, scale, material=TEAL, rot=(0,0,0), segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.rotation_euler = rot
    in_collection(ob)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth = True
    model_objects.append(ob)
    return ob

def catmull(values, u):
    n=len(values)
    x=max(0,min(1,u))*(n-1)
    i=min(n-2, int(x))
    f=x-i
    p0=values[max(0,i-1)]; p1=values[i]; p2=values[i+1]; p3=values[min(n-1,i+2)]
    return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)

def sample_path(points, radii, count):
    pts=[Vector(p) for p in points]
    rr=[float(r) for r in radii]
    centers=[catmull(pts,i/(count-1)) for i in range(count)]
    rs=[max(.005,catmull(rr,i/(count-1))) for i in range(count)]
    return centers,rs

def frames(centers):
    nn=[]; bb=[]
    for i,c in enumerate(centers):
        tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
        side=Vector((-tangent.z,0,tangent.x))
        if side.length<.001: side=Vector((1,0,0))
        side.normalize()
        depth=tangent.cross(side).normalized()
        if depth.y<0: depth=-depth
        nn.append(side); bb.append(depth)
    return nn,bb

def sweep(name, points, radii, material=TEAL, rings=70, sides=28, depth_scale=1):
    cc, rr = sample_path(points,radii,rings)
    nn,bb=frames(cc)
    vv=[]; ff=[]
    for i,c in enumerate(cc):
        for j in range(sides):
            a=2*math.pi*j/sides
            vv.append(tuple(c+nn[i]*(math.cos(a)*rr[i])+bb[i]*(math.sin(a)*rr[i]*depth_scale)))
    for i in range(rings-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            ff.append((a,b,b+sides,a+sides))
    vv.extend([tuple(cc[0]),tuple(cc[-1])])
    cap0=len(vv)-2; cap1=len(vv)-1
    for j in range(sides):
        ff.append((cap0,(j+1)%sides,j))
        a=(rings-1)*sides+j; b=(rings-1)*sides+(j+1)%sides
        ff.append((cap1,a,b))
    return mesh(name,vv,ff,material),cc,rr

BODY_P = [
 (-1.05,.03,3.10),(-1.11,.01,2.65),(-1.00,.01,2.34),(-.38,.06,2.34),
 (.30,.11,2.39),(.89,.13,2.06),(.94,.12,1.62),(.66,.07,1.23),
 (.40,.03,.91),(.62,.00,.58),(1.14,.02,.54),(1.68,.08,.70),
 (2.00,.16,1.08),(2.10,.23,1.46),(2.07,.27,1.73)]
BODY_R = [.47,.51,.59,.66,.68,.64,.55,.50,.44,.355,.285,.215,.15,.09,.012]
body, BC, BR = sweep("Continuous_Body_Seed",BODY_P,BODY_R,rings=180,sides=40,depth_scale=.90)
skin_parts.append(body)
BN,BB=frames(BC)
skin_parts.extend([
 ellipsoid("Round_Head_Seed",(-1.06,-.01,3.25),(.79,.60,.62)),
 ellipsoid("Short_Muzzle_Seed",(-1.06,-.65,3.04),(.65,.40,.31)),
 ellipsoid("Left_Cheek_Seed",(-1.62,-.39,3.015),(.345,.335,.32)),
 ellipsoid("Right_Cheek_Seed",(-.50,-.39,3.015),(.345,.335,.32))])

LIMBS = {
 "Front_Left":[(-1.34,.01,2.57),(-1.70,-.17,2.42),(-1.71,-.42,2.42)],
 "Front_Right":[(-.78,.01,2.49),(-.52,-.33,2.34),(-.50,-.62,2.35)],
 "Hind_Far":[(.55,.08,1.31),(.08,.28,1.17),(-.10,.03,1.11)],
 "Hind_Near":[(.85,.03,1.25),(1.06,-.36,1.02),(1.07,-.61,1.06)]}
limb_samples={}
for name,pts in LIMBS.items():
    ob, cc, rr=sweep(name+"_Seed",pts,[.30,.265,.23],rings=32,sides=28)
    skin_parts.append(ob)
    limb_samples[name]=(cc,rr)
    paw=ellipsoid(name+"_Paw_Seed",pts[-1],(.285,.315,.235))
    skin_parts.append(paw)

# Almond-shaped ears; the external teal volume is part of the unified skin.
for sign in (-1,1):
    base=Vector((-1.06+sign*.57,.025,3.43))
    tip=base+Vector((sign*.43,.0,.26))
    outer,_,_=sweep("Ear_Outer_Seed_"+str(sign),
        [base,base.lerp(tip,.50),base.lerp(tip,.87),tip],
        [.08,.20,.115,.015],rings=30,sides=24,depth_scale=.58)
    skin_parts.append(outer)

# Preserve the editable seeds separately before making one connected, smooth skin.
for ob in skin_parts:
    copy=ob.copy(); copy.data=ob.data.copy()
    SOURCE.objects.link(copy)
    copy.name="EDIT_"+ob.name
# Rebuild the skin as a smoothly blended signed-distance surface.
# Native seeds stay editable in SOURCE; polynomial smooth unions round branch junctions.
import numpy as np
for ob in skin_parts:
    bpy.data.objects.remove(ob,do_unlink=True)
lo=np.array([-2.18,-1.24,-.04],dtype=np.float32)
hi=np.array([2.99,.94,4.06],dtype=np.float32)
voxel=.042
dims=np.ceil((hi-lo)/voxel).astype(int)+1
axes=[lo[k]+np.arange(dims[k],dtype=np.float32)*voxel for k in range(3)]
grid=np.stack(np.meshgrid(*axes,indexing="ij"),axis=-1).reshape(-1,3)

def field_path(centers,radii,depth=1.0):
    result=np.full(len(grid),100.0,dtype=np.float32)
    for c,r in zip(centers,radii):
        delta=grid-np.array(c,dtype=np.float32)
        delta[:,1]/=depth
        distance=np.sqrt(np.sum(delta*delta,axis=1))-float(r)
        result=np.minimum(result,distance*min(1.0,depth))
    return result

def field_ellipsoid(center,radii):
    delta=grid-np.array(center,dtype=np.float32)
    radius=np.array(radii,dtype=np.float32)
    k0=np.sqrt(np.sum((delta/radius)**2,axis=1))
    k1=np.sqrt(np.sum((delta/(radius*radius))**2,axis=1))
    return k0*(k0-1)/np.maximum(k1,1e-8)

def union_smooth(a,b,k):
    h=np.clip(.5+.5*(b-a)/k,0,1)
    return b*(1-h)+a*h-k*h*(1-h)

field=field_path(BC,BR,.90)
for center,radii,blend in [
 ((-1.06,-.015,3.25),(.79,.60,.62),.20),
 ((-1.06,-.65,3.04),(.65,.40,.31),.19),
 ((-1.62,-.39,3.015),(.345,.335,.32),.17),
 ((-.50,-.39,3.015),(.345,.335,.32),.17)]:
    field=union_smooth(field,field_ellipsoid(center,radii),blend)
for name,pts in LIMBS.items():
    cc,rr=limb_samples[name]
    limb=union_smooth(field_path(cc,rr),field_ellipsoid(pts[-1],(.285,.315,.235)),.11)
    field=union_smooth(field,limb,.23)
for sign in (-1,1):
    base=Vector((-1.06+sign*.57,.025,3.43));tip=base+Vector((sign*.43,0,.26))
    cc,rr=sample_path([base,base.lerp(tip,.50),base.lerp(tip,.87),tip],[.085,.19,.12,.045],35)
    field=union_smooth(field,field_path(cc,rr,.58),.12)

# Marching tetrahedra with shared lattice-edge vertices: closed surface, no seams.
nx,ny,nz=map(int,dims)
cells=np.stack(np.meshgrid(np.arange(nx-1),np.arange(ny-1),np.arange(nz-1),indexing="ij"),axis=-1).reshape(-1,3)
base=(cells[:,0]*ny+cells[:,1])*nz+cells[:,2]
offset=np.array([0,ny*nz,ny*nz+nz,nz,1,ny*nz+1,ny*nz+nz+1,nz+1])
corners=base[:,None]+offset[None,:]
mixed=(field[corners].min(axis=1)<0)&(field[corners].max(axis=1)>0)
corners=corners[mixed]
tetra=np.array([[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]])
tets=corners[:,tetra].reshape(-1,4)
cases=((field[tets]<0)*np.array([1,2,4,8])).sum(axis=1)
edge_triangles=[]
for case in range(1,15):
    selected=tets[cases==case]
    if not len(selected):continue
    ins=[j for j in range(4) if case&(1<<j)];outs=[j for j in range(4) if not case&(1<<j)]
    if len(ins)==1:patterns=[[(ins[0],j) for j in outs]]
    elif len(ins)==3:patterns=[[(outs[0],j) for j in ins]]
    else:
        x,y=ins;c,d=outs
        patterns=[[(x,c),(x,d),(y,c)],[(y,c),(x,d),(y,d)]]
    for pattern in patterns:
        edge_triangles.append(np.stack([np.sort(selected[:,[x,y]],axis=1) for x,y in pattern],axis=1))
edge_triangles=np.concatenate(edge_triangles,axis=0)
edges,indices=np.unique(edge_triangles.reshape(-1,2),axis=0,return_inverse=True)
f0=field[edges[:,0]];f1=field[edges[:,1]]
t=(f0/(f0-f1))[:,None]
verts=grid[edges[:,0]]+(grid[edges[:,1]]-grid[edges[:,0]])*t
faces=indices.reshape(-1,3)
skin=mesh("Dragon_Continuous_Skin",verts.tolist(),faces.tolist(),TEAL)
bm=bmesh.new();bm.from_mesh(skin.data)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(skin.data);bm.free()
bpy.context.view_layer.objects.active=skin;skin.select_set(True)
mod=skin.modifiers.new("Relax_Implicit_Surface","SMOOTH");mod.factor=.45;mod.iterations=3
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new("Smooth_Implicit_Surface","SUBSURF");mod.levels=1;mod.render_levels=1
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new("Runtime_Surface_Density","DECIMATE");mod.ratio=.10
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in skin.data.polygons:p.use_smooth=True
model_objects=list(CHAR.objects)
print("SKIN_READY_SMOOTH_UNION",len(skin.data.vertices),len(skin.data.polygons),flush=True)
del grid,cells,corners,tets,cases,edges,verts,faces,field,edge_triangles

# Armature with smooth skin weighting, separate natural motions for head and tail.
rig_data=bpy.data.armatures.new("Dragon_Idle_Armature")
rig=bpy.data.objects.new("Dragon_Rig",rig_data)
CHAR.objects.link(rig)
model_objects.append(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
BONE_SPECS=[
 ("Float_Root",(0,0,.12),(0,0,.72),None),
 ("Body_Core",(-.70,.06,2.35),(.30,.11,2.39),"Float_Root"),
 ("Neck",(-.92,.02,2.42),(-1.05,.03,3.06),"Body_Core"),
 ("Head",(-1.05,.03,3.06),(-1.05,.03,3.80),"Neck"),
 ("Spine_Bend",(.30,.11,2.39),(.94,.12,1.62),"Body_Core"),
 ("Spine_Lower",(.94,.12,1.62),(.40,.03,.91),"Spine_Bend"),
 ("Tail_Base",(.40,.03,.91),(1.14,.02,.54),"Spine_Lower"),
 ("Tail_Mid",(1.14,.02,.54),(2.00,.16,1.08),"Tail_Base"),
 ("Tail_Tip",(2.00,.16,1.08),(2.07,.27,1.74),"Tail_Mid")]
for name,pts in LIMBS.items():
    parent="Neck" if name.startswith("Front") else "Spine_Lower"
    BONE_SPECS.append((name,pts[0],pts[-1],parent))
for name,a,b,parent in BONE_SPECS:
    bo=rig_data.edit_bones.new(name); bo.head=a; bo.tail=b
    if parent: bo.parent=rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
rig.show_in_front=True
BODY_GROUPS=["Neck","Neck","Neck","Body_Core","Body_Core","Spine_Bend","Spine_Bend",
             "Spine_Lower","Spine_Lower","Tail_Base","Tail_Base","Tail_Mid","Tail_Mid","Tail_Tip","Tail_Tip"]
kd=KDTree(len(BC))
for i,c in enumerate(BC): kd.insert(c,i)
kd.balance()

def base_weights(p):
    nearest=kd.find(p)
    x=nearest[1]/(len(BC)-1)*(len(BODY_GROUPS)-1)
    i=min(len(BODY_GROUPS)-2,int(x)); f=x-i
    weights=defaultdict(float)
    # Soft interpolation between adjacent control regions prevents a hard hinge.
    f=f*f*(3-2*f)
    weights[BODY_GROUPS[i]]+=1-f
    weights[BODY_GROUPS[i+1]]+=f
    head_strength=max(0,min(1,(p.z-2.82)/.24)) if p.x<-.24 else 0
    if head_strength>0:
        weights={k:v*(1-head_strength) for k,v in weights.items()}
        weights["Head"]=weights.get("Head",0)+head_strength
    return weights

def skin_weights(p, include_limbs=True):
    w=base_weights(p)
    if include_limbs:
        best=None
        bdist=kd.find(p)[2]
        for name,(cc,rr) in limb_samples.items():
            ds=[(p-c).length for c in cc]
            j=min(range(len(cc)),key=lambda k:ds[k])
            # Weight away from the merged shoulder; no discontinuous part parenting.
            t=j/(len(cc)-1)
            if t>.12 and ds[j] < rr[j]+.20:
                strength=max(0,min(1,(t-.12)/.46))
                # Taper influence through the outer shoulder instead of abruptly cutting it off.
                q=max(0,min(1,(ds[j]-(rr[j]+.015))/.155))
                strength*=1-q*q*(3-2*q)
                q=max(0,min(1,(bdist-ds[j]+.04)/.20))
                strength*=q*q*(3-2*q)
                if best is None or strength>best[1]: best=(name,strength)
        if best and best[1]>.001:
            name,s=best
            w={k:v*(1-s) for k,v in w.items()}
            w[name]=w.get(name,0)+s
    total=sum(w.values())
    return {k:v/total for k,v in w.items() if v>.0001}

def bind(ob, bone=None, include_limbs=False):
    ob.parent=rig
    mod=ob.modifiers.new("Idle_Skin_Deform","ARMATURE")
    mod.object=rig
    groups={}
    if bone:
        g=ob.vertex_groups.new(name=bone)
        g.add(list(range(len(ob.data.vertices))),1,"REPLACE")
    else:
        rows=[skin_weights(ob.matrix_world@v.co,include_limbs) for v in ob.data.vertices]
        if ob is skin:
            adjacency=[set() for v in ob.data.vertices]
            for edge in ob.data.edges:
                x,y=edge.vertices;adjacency[x].add(y);adjacency[y].add(x)
            # A standard surface relaxation keeps neighboring vertices deforming together.
            for step in range(12):
                next_rows=[]
                for i,neighbors in enumerate(adjacency):
                    mixed=defaultdict(float)
                    for k,val in rows[i].items():mixed[k]+=.48*val
                    if neighbors:
                        scale=.52/len(neighbors)
                        for j in neighbors:
                            for k,val in rows[j].items():mixed[k]+=scale*val
                    else:
                        for k,val in rows[i].items():mixed[k]+=.52*val
                    next_rows.append(dict(mixed))
                rows=next_rows
        elif ob.name.startswith(("Belly_Fold","Surface_")):
            # Folds use the exact relaxed surface weights, so they cannot slide off the skin.
            rows=[]
            for v in ob.data.vertices:
                p=ob.matrix_world@v.co
                ok,cp,no,face=skin.closest_point_on_mesh(p)
                mixed=defaultdict(float)
                if ok:
                    for index in skin.data.polygons[face].vertices:
                        vert=skin.data.vertices[index]
                        influence=1/max((vert.co-cp).length**2,.000001)
                        for item in vert.groups:
                            mixed[skin.vertex_groups[item.group].name]+=item.weight*influence
                rows.append(dict(mixed) if mixed else skin_weights(p,True))
        for v,row in zip(ob.data.vertices,rows):
            limited=sorted(row.items(),key=lambda kv:kv[1],reverse=True)[:4]
            total=sum(val for k,val in limited)
            for name,weight in limited:
                if weight/total<.00001:continue
                if name not in groups:groups[name]=ob.vertex_groups.new(name=name)
                groups[name].add([v.index],weight/total,"REPLACE")
    return ob
bind(skin,include_limbs=True)

# Belly color lives on the same continuous skin as the body and limbs.
# This removes overlapping shells and keeps every color boundary attached to the rig.
def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

def belly_mask(p):
    # The lower muzzle color is on the continuous head skin; no floating lip shell.
    chin=0.0
    if p.x<-.24 and 2.54<p.z<3.02:
        x=abs((p.x+1.06)/.67)
        top=2.927+.064*min(1,x)**2
        chin=(1-smoothstep(top-.008,top+.008,p.z))*(1-smoothstep(.86,1.02,x))
        chin*=1-smoothstep(-.24,-.10,p.y)
    _,i,_=kd.find(p)
    nearest=None
    for j in range(max(0,i-1),min(len(BC)-1,i+1)):
        segment=BC[j+1]-BC[j]
        t=max(0,min(1,(p-BC[j]).dot(segment)/segment.length_squared))
        center=BC[j]+segment*t;dist=(p-center).length
        if nearest is None or dist<nearest[0]:nearest=(dist,j,t,center)
    _,j,t,center=nearest
    u=(j+t)/(len(BC)-1)
    if u<8/(len(BC)-1) or u>(len(BC)-4)/(len(BC)-1) or (p.z>2.90 and p.x<-.24):return chin
    normal=BN[j].lerp(BN[j+1],t).normalized()
    depth=BB[j].lerp(BB[j+1],t).normalized()
    radius=BR[j]+t*(BR[j+1]-BR[j])
    offset=p-center;x=offset.dot(normal);y=offset.dot(depth)/.90
    angle=math.atan2(y,x);central=-math.pi/2-.32*min(1,max(0,(u-.12)*4))
    delta=(angle-central+math.pi)%(2*math.pi)-math.pi
    half=.82 if u<.86 else .66
    mask=1-smoothstep(half-.024,half+.024,abs(delta))
    radial=math.sqrt(x*x+y*y)/radius
    mask*=1-smoothstep(1.02,1.28,radial)
    # Continuous segment distance avoids sampled bone-weight steps in the paint edge.
    limb=0.0
    for pts in LIMBS.values():
        points=[Vector(q) for q in pts];best=None
        for j in range(len(points)-1):
            delta=points[j+1]-points[j]
            t=max(0,min(1,(p-points[j]).dot(delta)/delta.length_squared))
            dist=(p-(points[j]+delta*t)).length
            progress=(j+t)/(len(points)-1)
            if best is None or dist<best[0]:best=(dist,progress)
        dist,progress=best
        strength=smoothstep(.035,.32,progress)*(1-smoothstep(.245,.37,dist))
        limb=max(limb,strength)
    mask*=1-smoothstep(.035,.14,limb)
    return max(mask,chin)

skin_mat=TEAL.copy(); skin_mat.name="Continuous_Teal_Ivory_Vertex_PBR"
bs=skin_mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value=(1,1,1,1)
colnode=skin_mat.node_tree.nodes.new("ShaderNodeVertexColor")
colnode.layer_name="BodyTint"
skin_mat.node_tree.links.new(colnode.outputs["Color"],bs.inputs["Base Color"])
skin_mat.diffuse_color=(1,1,1,1)
skin.data.materials.clear(); skin.data.materials.append(skin_mat)
ca=skin.data.color_attributes.new(name="BodyTint",type="FLOAT_COLOR",domain="POINT")
skin.data.color_attributes.active_color_index=0
skin.data.color_attributes.render_color_index=0
teal_rgb=TEAL.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value[:3]
ivory_rgb=CREAM.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value[:3]
masks=[belly_mask(skin.matrix_world@v.co) for v in skin.data.vertices]
neighbors=[set() for v in skin.data.vertices]
for edge in skin.data.edges:
    a,b=edge.vertices; neighbors[a].add(b); neighbors[b].add(a)
for _ in range(2):
    masks=[.48*masks[i]+.52*sum(masks[j] for j in ns)/len(ns) if ns else masks[i]
           for i,ns in enumerate(neighbors)]
for v in skin.data.vertices:
    mix=masks[v.index]
    rgb=[teal_rgb[k]*(1-mix)+ivory_rgb[k]*mix for k in range(3)]
    ca.data[v.index].color=(*rgb,1)

def tube_detail(name, points, radii, material, bone=None, rings=44, sides=12, include_limbs=False):
    ob,cc,rr=sweep(name,points,radii,material,rings,sides)
    bind(ob,bone,include_limbs)
    return ob

# Shallow painted folds follow the skin itself and share its exact weighting.
last=len(BC)-3
fold_count=0
for i in range(20,last-6,11):
    u=i/(len(BC)-1)
    central=-math.pi/2-.32*min(1,max(0,(u-.12)*4))
    pts=[]
    valid=True
    for j in range(13):
        a=central-.68+1.36*j/12
        seed=BC[i]+BN[i]*(math.cos(a)*(BR[i]+.04))+BB[i]*(math.sin(a)*(BR[i]*.90+.04))
        ok,cp,no,idx=skin.closest_point_on_mesh(skin.matrix_world.inverted()@seed)
        p=skin.matrix_world@cp if ok else seed
        if belly_mask(p)<.75: valid=False
        if ok: p+=(skin.matrix_world.to_3x3()@no).normalized()*.004
        pts.append(p)
    if valid:
        tube_detail("Belly_Fold_%02d"%fold_count,pts,[.0037]*len(pts),GROOVE,rings=34,sides=8,include_limbs=True)
        fold_count+=1

def face_patch(name, x,z,w,h,material,offset,bone="Head",rotation=0,dome=.002):
    # Oval caps fit the actual smooth head surface, instead of protruding eyeballs.
    rr=14; sides=44
    def surface(dx,dz,r):
        dx,dz=dx*math.cos(rotation)-dz*math.sin(rotation),dx*math.sin(rotation)+dz*math.cos(rotation)
        point=Vector((x+dx,-3,z+dz))
        ok,loc,no,idx=skin.ray_cast(point,Vector((0,1,0)))
        if not ok: raise RuntimeError("Face patch ray did not reach the head")
        return tuple(loc+Vector((0,-offset-dome*(1-r*r),0)))
    vv=[surface(0,0,0)]
    ff=[]
    for i in range(1,rr+1):
        r=i/rr
        for j in range(sides):
            angle=2*math.pi*j/sides
            vv.append(surface(w*r*math.cos(angle),h*r*math.sin(angle),r))
    for j in range(sides): ff.append((0,1+j,1+(j+1)%sides))
    for i in range(rr-1):
        for j in range(sides):
            a=1+i*sides+j; b=1+i*sides+(j+1)%sides
            ff.append((a,a+sides,b+sides,b))
    ob=mesh("Surface_"+name,vv,ff,material)
    return bind(ob,include_limbs=True)

# Mouth is closed, friendly, with no fangs or teeth.
# Ivory lower muzzle is painted directly on the same smooth skin.
smile_pts=[]
for j in range(17):
    x=-.58+1.16*j/16
    z=2.922+.067*(abs(x)/.58)**2
    ok,loc,no,_=skin.ray_cast(Vector((-1.06+x,-3,z)),Vector((0,1,0)))
    assert ok
    smile_pts.append((-1.06+x,loc.y-.008,z))
tube_detail("Surface_Gentle_Closed_Smile",smile_pts,[.009]*17,MOUTH,rings=55,sides=10,include_limbs=True)

for sign in (-1,1):
    x=-1.06+sign*.32
    face_patch("Eye_Soft_Lid_"+str(sign),x,3.465,.161,.174,TEAL,.002)
    face_patch("Eye_White_"+str(sign),x,3.465,.142,.158,WHITE,.004)
    face_patch("Eye_Brown_"+str(sign),x-.006,3.459,.129,.146,BROWN,.007)
    face_patch("Eye_Highlight_"+str(sign),x-.032,3.512,.023,.027,WHITE,.010)
    face_patch("Eye_Secondary_Highlight_"+str(sign),x+.029,3.425,.009,.010,WHITE,.010)
    face_patch("Nostril_"+str(sign),-1.06+sign*.205,3.111,.040,.024,DARK,.006)
    face_patch("Ear_Ivory_Inset_"+str(sign),-1.06+sign*.76,3.552,.130,.076,INNER,.004,rotation=sign*.48)
    horn_base=Vector((-1.06+sign*.40,.025,3.735))
    horn_pts=[horn_base,horn_base+Vector((sign*.055,.02,.24)),
              horn_base+Vector((sign*.10,.05,.51)),horn_base+Vector((sign*.14,.045,.73))]
    main,_,_=sweep("Horn_Main_"+str(sign),horn_pts,[.145,.120,.100,.067],CREAM,rings=44,sides=24)
    branch,_,_=sweep("Horn_Fork_"+str(sign),[horn_base+Vector((sign*.065,.02,.27)),
        horn_base+Vector((sign*.23,.025,.40)),horn_base+Vector((sign*.35,.03,.53))],
        [.095,.080,.052],CREAM,rings=28,sides=20)
    end=ellipsoid("Horn_Round_Tip_"+str(sign),horn_pts[-1],(.070,.071,.086),CREAM,segments=20,rings=12)
    branch_tip=ellipsoid("Horn_Fork_Round_Tip_"+str(sign),horn_base+Vector((sign*.35,.03,.53)),(.054,.056,.063),CREAM,segments=20,rings=12)
    lower,_,_=sweep("Horn_Lower_Branch_"+str(sign),
        [horn_base+Vector((sign*.035,.015,.18)),horn_base+Vector((sign*.25,.020,.24)),horn_base+Vector((sign*.49,.025,.32))],
        [.092,.070,.039],CREAM,rings=30,sides=20)
    lower_tip=ellipsoid("Horn_Lower_Round_Tip_"+str(sign),horn_base+Vector((sign*.49,.025,.32)),(.043,.045,.053),CREAM,segments=20,rings=12)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (main,branch,end,branch_tip,lower,lower_tip): o.select_set(True)
    bpy.context.view_layer.objects.active=main
    bpy.ops.object.join()
    model_objects=list(CHAR.objects)
    mod=main.modifiers.new("Fuse_Rounded_Antler","REMESH"); mod.mode="VOXEL"; mod.voxel_size=.016; mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=main.modifiers.new("Soften_Antler","SMOOTH"); mod.factor=.85; mod.iterations=6
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=main.modifiers.new("Round_Antler_Surface","SUBSURF"); mod.levels=1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=main.modifiers.new("Antler_Runtime_Density","DECIMATE");mod.ratio=.50
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in main.data.polygons:p.use_smooth=True
    bind(main,"Head")

tube_detail("Whisker_Left",[(-1.60,-.61,2.96),(-1.91,-.74,2.89),(-2.08,-.82,2.47),
    (-2.32,-.87,2.29),(-2.48,-.84,2.36),(-2.46,-.83,2.55)],
    [.059,.050,.043,.032,.022,.008],CREAM,"Head",rings=80,sides=14)
tube_detail("Whisker_Right",[(-.52,-.61,2.96),(-.27,-.74,2.83),(-.10,-.84,2.55),
    (.16,-.88,2.44),(.49,-.88,2.49),(.57,-.85,2.64)],
    [.059,.050,.043,.032,.022,.008],CREAM,"Head",rings=80,sides=14)

# Short rounded volumetric claws grow from the surface of the four fused paws.
for name,pts in LIMBS.items():
    paw=Vector(pts[-1])
    for j in range(3):
        x=paw.x+(j-1)*.140;z=paw.z-.045
        ok,loc,no,_=skin.ray_cast(Vector((x,-3,z)),Vector((0,1,0)));assert ok
        base=Vector((x,loc.y+.024,z))
        curve=[base,base+Vector((0,-.045,-.012)),base+Vector((0,-.116,-.055)),base+Vector((0,-.174,-.095))]
        claw,_,_=sweep("Surface_"+name+"_Ivory_Claw_"+str(j),curve,[.065,.063,.046,.014],CREAM,rings=32,sides=20)
        mod=claw.modifiers.new("Gentle_Claw_Tip","SUBSURF");mod.levels=1;bpy.context.view_layer.objects.active=claw
        bpy.ops.object.modifier_apply(modifier=mod.name);bind(claw,name)

def petal(name, base, tip, width, bone=None, bend=.09):
    a=Vector(base);end=Vector(tip);direction=(end-a).normalized()
    side=Vector((-direction.z,0,direction.x)).normalized()
    depth=direction.cross(side).normalized()
    if depth.y<0:depth=-depth
    rings=30;sides=24;vv=[tuple(a)];ff=[]
    for i in range(rings):
        t=(i+1)/(rings+1)
        center=a.lerp(end,t)+side*(bend*math.sin(math.pi*t))
        profile=math.sin(math.pi*t)**.85
        w=width*profile;thickness=width*.23*profile
        for j in range(sides):
            angle=2*math.pi*j/sides
            vv.append(tuple(center+side*(w*math.cos(angle))+depth*(thickness*math.sin(angle))))
    for j in range(sides):ff.append((0,1+(j+1)%sides,1+j))
    for i in range(rings-1):
        for j in range(sides):
            p=1+i*sides+j;q=1+i*sides+(j+1)%sides
            ff.append((p,q,q+sides,p+sides))
    vv.append(tuple(end));tip_index=len(vv)-1
    for j in range(sides):
        p=1+(rings-1)*sides+j;q=1+(rings-1)*sides+(j+1)%sides
        ff.append((tip_index,p,q))
    return mesh(name,vv,ff,ORANGE)

# Layered mane grows from a continuous orange base; rounded closed tuft ends.
mane_parts=[
 ellipsoid("Mane_Head_Flow_Base",(-1.06,.41,3.27),(.66,.125,.67),ORANGE),
 ellipsoid("Mane_Neck_Flow_Base",(-1.02,.25,2.63),(.41,.145,.435),ORANGE)]
mane_specs=[
 ((-1.17,.31,3.68),(-1.01,.32,4.08),.21),
 ((-.85,.28,3.67),(-.44,.29,4.04),.24),
 ((-.66,.26,3.51),(-.10,.29,3.82),.24),
 ((-.59,.24,3.29),(.03,.27,3.53),.245),
 ((-.64,.24,3.08),(-.04,.28,3.28),.245),
 ((-.69,.22,2.89),(-.11,.25,3.05),.225),
 ((-.73,.21,2.71),(-.23,.24,2.80),.205),
 ((-.75,.19,2.56),(-.32,.24,2.59),.185),
 ((-1.60,.24,3.58),(-1.92,.25,3.79),.175),
 ((-1.65,.23,3.36),(-2.04,.24,3.46),.195),
 ((-1.66,.23,3.14),(-2.01,.24,3.16),.19),
 ((-1.54,.23,2.97),(-1.89,.25,2.89),.17)]
for i,(a,b,w) in enumerate(mane_specs):
    mane_parts.append(petal("Head_Mane_%02d"%i,a,b,w*1.17,bend=.09))
arc=[0.0]
for i in range(18,170):arc.append(arc[-1]+(BC[i]-BC[i-1]).length)
indices=sorted(set(17+min(range(len(arc)),key=lambda j:abs(arc[j]-d)) for d in np.arange(0,arc[-1]+.001,.40)))
ribbon_points=[BC[i]+BN[i]*(BR[i]*.92)+Vector((0,.09,0)) for i in indices]
ribbon_radii=[.068 if i<117 else .054 for i in indices]
ribbon,_,_=sweep("Mane_Dorsal_Flow_Base",ribbon_points,ribbon_radii,ORANGE,rings=180,sides=18,depth_scale=.72)
mane_parts.append(ribbon)
for k,i in enumerate(indices):
    normal=BN[i];a=BC[i]+normal*(BR[i]*.86)+Vector((0,.10,0))
    tangent=(BC[min(i+6,len(BC)-1)]-BC[max(0,i-6)]).normalized()
    direction=(normal+tangent*.78).normalized()
    length=.69 if i<110 else .45
    if i>150:length=.33
    width=.28 if i<112 else .18
    mane_parts.append(petal("Dorsal_Mane_%02d"%k,a,a+direction*length,width,bend=.075))
tailbase=Vector((2.045,.25,1.50))
for i,(a,b,w) in enumerate([
 (tailbase+Vector((-.025,0,.05)),(1.66,.26,2.13),.235),
 (tailbase+Vector((.020,.01,.13)),(2.06,.27,2.35),.24),
 (tailbase+Vector((.035,0,.04)),(2.40,.25,2.14),.21),
 (tailbase+Vector((-.01,-.01,-.13)),(1.70,.24,1.84),.17)]):
    bind(petal("Tail_Fan_%02d"%i,a,b,w,bend=.025),"Tail_Tip")
# Fuse only the connected hair construction; preserve editable source components.
for ob in mane_parts:
    cp=ob.copy();cp.data=ob.data.copy();SOURCE.objects.link(cp);cp.name="EDIT_"+ob.name
bpy.ops.object.select_all(action="DESELECT")
for ob in mane_parts:ob.select_set(True)
mane=mane_parts[0];bpy.context.view_layer.objects.active=mane
bpy.ops.object.join();mane.name="Mane_Continuous_Layered"
# Keep closed overlapping leaves and a continuous flow base. Voxel union formed six unintended handles; do not destroy the source leaf surfaces.
mod=mane.modifiers.new("Round_Mane_Joins","SMOOTH");mod.factor=.28;mod.iterations=2
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=mane.modifiers.new("Mane_Smooth_Surface","SUBSURF");mod.levels=1
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=mane.modifiers.new("Mane_Runtime_Density","DECIMATE");mod.ratio=.50
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in mane.data.polygons:p.use_smooth=True
bind(mane)
model_objects=list(CHAR.objects)


# Analytically periodic 6 s idle. Same end pose and matching boundary velocity.
for frame in range(0,145):
    phase=2*math.pi*frame/144
    for pb in rig.pose.bones:
        pb.rotation_mode="XYZ"
        pb.rotation_euler=(0,0,0)
        pb.location=(0,0,0)
    root=rig.pose.bones["Float_Root"]
    root.location=(0,.065*math.sin(phase),0) # Root local Y is global Z.
    root.rotation_euler=(.010*math.cos(phase),.014*math.sin(phase),.009*math.sin(phase))
    rig.pose.bones["Neck"].rotation_euler=(.015*math.sin(phase+.4),.008*math.sin(phase),0)
    rig.pose.bones["Head"].rotation_euler=(.036*math.sin(phase-.35),.014*math.sin(phase+.7),0)
    rig.pose.bones["Body_Core"].rotation_euler=(.005*math.sin(phase),.005*math.sin(phase+.5),0)
    rig.pose.bones["Spine_Bend"].rotation_euler=(.009*math.sin(phase+.5),.010*math.sin(phase+.7),0)
    rig.pose.bones["Spine_Lower"].rotation_euler=(.010*math.sin(phase+1),.013*math.sin(phase+1),0)
    rig.pose.bones["Tail_Base"].rotation_euler=(.017*math.sin(phase+.7),.015*math.sin(phase+1.1),.008*math.sin(phase))
    rig.pose.bones["Tail_Mid"].rotation_euler=(.025*math.sin(phase+1.2),.024*math.sin(phase+1.5),.009*math.sin(phase))
    rig.pose.bones["Tail_Tip"].rotation_euler=(.039*math.sin(phase+1.8),.031*math.sin(phase+2.0),.010*math.sin(phase))
    for j,name in enumerate(LIMBS):
        rig.pose.bones[name].rotation_euler=(.024*math.sin(phase+j*.45),0,.011*math.sin(phase+j*.4))
    for pb in rig.pose.bones:
        if pb.name!="Float_Root":
            pb.rotation_euler=tuple(x*.65 for x in pb.rotation_euler)
        pb.keyframe_insert(data_path="rotation_euler",frame=frame,group=pb.name)
        if pb.name=="Float_Root": pb.keyframe_insert(data_path="location",frame=frame,group=pb.name)
action=rig.animation_data.action
action.name="Idle_Loop"
# Blender 5 layered actions: keyframes are already sampled at every export frame.
rig["candidate_status"]="NEW_CANDIDATE_NOT_PRODUCT_DEFAULT"
rig["reference_sha256"]=REF_SHA
rig["loop_seconds"]=6.0
rig["body_centerline_json"]=json.dumps(BODY_P)
rig["body_radii_json"]=json.dumps(BODY_R)
rig["shape_revision"]=7
rig["shape_iteration"]=2
rig["limb_paths_json"]=json.dumps(LIMBS)
rig["mane_closed_leaf_layers"]=True
rig["model_origin"]="New authored mesh from user-approved 2D concept; no old dragon imported"
rig["anatomy"]="Wingless Eastern mini dragon, four short paws, closed toothless smile"
SCENE.frame_set(0)
bpy.context.view_layer.update()

# Preserve the approved pixels packed in the editable source.
reference=bpy.data.images.load(str(REF),check_existing=True)
reference.name="Approved_2D_Concept_SHA256_"+REF_SHA[:12]
reference.pack()
reference.use_fake_user=True  # Retain the packed approved pixels after saving/reopening.
text=bpy.data.texts.new("REGENERATE_build_dragon.py")
text.write(Path(__file__).read_text(encoding="utf8"))
readme=bpy.data.texts.new("ART_SOURCE_README")
readme.write("User-approved image is packed in this file. Enable Editable_Construction_Source to inspect seeds.\n"
    "The teal skin is a connected remeshed surface with smooth armature weighting. Materials are editable PBR.\n"
    "24 fps; frames 0 and 144 have identical pose. Play frames 0-143 repeatedly for a 6 second loop.\n"
    "This is a new candidate only. No old dragon, product default or other zodiac animal has been changed.\n")

# Studio belongs only to native Blender previews, never the GLB character export.
world=bpy.data.worlds.new("Studio_World")
world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.76,.72,.66,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.45
SCENE.world=world
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.12))
floor=bpy.context.object; floor.name="Preview_Floor"; in_collection(floor,STUDIO)
floor.data.materials.append(FLOOR)

def point_camera(camera, point):
    camera.rotation_euler=(Vector(point)-camera.location).to_track_quat("-Z","Y").to_euler()

def area(name, loc, energy, size):
    dat=bpy.data.lights.new(name,"AREA")
    ob=bpy.data.objects.new(name,dat); STUDIO.objects.link(ob)
    ob.location=loc; dat.energy=energy; dat.shape="DISK"; dat.size=size
    point_camera(ob,(.0,0,2.0))
area("Studio_Key",(-3,-5,7),350,5)
area("Studio_Fill",(4,-2,4.6),150,5)
area("Studio_Rim",(1.7,3.2,5.3),330,4)
cameras={}
for name,loc in [
 ("Front",(0,-11,2.18)),
 ("ThreeQuarter",(6,-10,5.6)),
 ("Side",(10,-.05,2.3))]:
    dat=bpy.data.cameras.new("Camera_"+name)
    ob=bpy.data.objects.new("Camera_"+name,dat); STUDIO.objects.link(ob)
    ob.location=loc; point_camera(ob,(.15,0,2.17))
    dat.type="ORTHO"; dat.ortho_scale=5.85 if name!="Side" else 5.30
    dat.lens=50
    cameras[name]=ob
SCENE.camera=cameras["ThreeQuarter"]

# Consolidate only runtime copies by material; original authoring parts stay editable.
RUNTIME=bpy.data.collections.new("Runtime_GLTF_Meshes")
SCENE.collection.children.link(RUNTIME)
by_material=defaultdict(list)
native_mesh_count=0
for ob in list(CHAR.objects):
    if ob.type!="MESH": continue
    native_mesh_count+=1
    copy=ob.copy(); copy.data=ob.data.copy(); RUNTIME.objects.link(copy)
    copy.name="Runtime_"+ob.data.materials[0].name
    by_material[ob.data.materials[0].name].append(copy)
for name,parts in by_material.items():
    bpy.ops.object.select_all(action="DESELECT")
    for ob in parts: ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    parts[0].name="Dragon_"+name
model_objects=list(RUNTIME.objects)+[rig]
bpy.ops.object.select_all(action="DESELECT")
for ob in model_objects: ob.select_set(True)
bpy.context.view_layer.objects.active=rig
export_opts=dict(filepath=str(OUT/"SaJu_Dragon_Approved_Shape_v7.glb"),export_format="GLB",
 use_selection=True,export_animations=True,export_skins=True,export_materials="EXPORT",
 export_frame_range=True,export_force_sampling=True,export_anim_single_armature=True,
 export_extras=True,export_yup=True,export_apply=False,export_cameras=False,export_lights=False)
# Use only options supported by the installed official exporter.
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
export_opts={k:v for k,v in export_opts.items() if k in props}
bpy.ops.export_scene.gltf(**export_opts)
RUNTIME.hide_render=True
RUNTIME.hide_viewport=True
SCENE.camera=cameras["ThreeQuarter"]
SCENE.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"SaJu_Dragon_Approved_Shape_v7.blend"),compress=True)
tri=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in model_objects if ob.type=="MESH")
report={"status":"FIRST_MODEL_GENERATED_REVIEW_PENDING","blender_version":bpy.app.version_string,
 "reference_sha256":REF_SHA,"reference_bytes":REF.stat().st_size,
 "mesh_objects":len([o for o in model_objects if o.type=="MESH"]),"native_editable_mesh_objects":native_mesh_count,"triangles_native":tri,"belly_is_single_skin_vertex_color":True,"fitted_eye_caps":True,
 "connected_skin_vertices":len(skin.data.vertices),"connected_skin_polygons":len(skin.data.polygons),
 "bones":len(rig.pose.bones),"frame_start":0,"frame_end":144,"fps":24,"loop_seconds":6,
 "candidate_only":True,"old_dragon_imported":False,"candidate_version":7,"smooth_signed_distance_union":True,"surface_claw_inlays":False,"volumetric_short_claws":True,"continuous_layered_mane":True,"muzzle_cream_on_continuous_skin":True,"wings":0,"paws":4,"fangs":0}
(OUT/"generation-report.json").write_text(json.dumps(report,indent=2),encoding="utf8")
if args.stills:
    for name,cam in cameras.items():
        SCENE.camera=cam
        floor.hide_render=name!="ThreeQuarter"
        SCENE.render.filepath=str(OUT/"previews"/(name.lower()+".png"))
        bpy.ops.render.render(write_still=True)
        print("PREVIEW_READY",name,flush=True)
print("MODEL_DELIVERABLES_READY",str(OUT),flush=True)

