"""New V8 static reconstruction from the actual user-approved 2D pixels.
No previous dragon mesh or rig is imported. New output directory required.
blender --background --factory-startup --python-exit-code 1 --threads 4
 --python build_dragon_v8_static.py -- --out D:/new-folder --reference D:/approved.png --stills
"""
import bpy,bmesh,math,json,sys,hashlib,argparse,numpy as np
from pathlib import Path
from mathutils import Vector
from collections import defaultdict
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--reference',required=True)
ap.add_argument('--stills',action='store_true');ap.add_argument('--resolution',type=int,default=720)
ap.add_argument('--samples',type=int,default=20);ap.add_argument('--voxel',type=float,default=.035)
args=ap.parse_args(argv);OUT=Path(args.out).resolve();REF=Path(args.reference).resolve()
REF_SHA='6184555091c80769d6553ae40641dbb44eb6dcc859dd0b8591b7887cc1502e58'
assert REF.stat().st_size==1651398 and hashlib.sha256(REF.read_bytes()).hexdigest()==REF_SHA
assert not OUT.exists(),'Preserve every earlier iteration; use a new output folder'
OUT.mkdir(parents=True);(OUT/'previews').mkdir();bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE=bpy.context.scene;SCENE.render.engine='CYCLES';SCENE.cycles.device='CPU'
SCENE.cycles.samples=args.samples;SCENE.cycles.use_denoising=True
SCENE.render.threads_mode='FIXED';SCENE.render.threads=4
SCENE.render.resolution_x=SCENE.render.resolution_y=args.resolution;SCENE.render.resolution_percentage=100
SCENE.render.image_settings.file_format='PNG';SCENE.render.fps=24
SCENE.view_settings.view_transform='AgX';SCENE.view_settings.look='AgX - Medium High Contrast'
CHAR=bpy.data.collections.new('Dragon_V8_New_Static_Construction');SOURCE=bpy.data.collections.new('Editable_Seeds_Not_Runtime');STUDIO=bpy.data.collections.new('Preview_Studio')
for c in (CHAR,SOURCE,STUDIO):SCENE.collection.children.link(c)
SOURCE.hide_render=True;SOURCE.hide_viewport=True;model_objects=[];skin_parts=[]

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
TEAL = mat("Body_Teal", "289D7C")
CREAM = mat("Belly_Horns_Whiskers_Ivory", "F0D49C")
ORANGE = mat("Mane_Warm_Orange", "E86D36", .64)
BROWN = mat("Eyes_Warm_Brown", "4A2C1D", .38)
WHITE = mat("Eyes_Soft_Ivory", "FFF7E5", .48)
DARK = mat("Nostrils_Deep_Teal", "0C4D3B", .55)
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


# Reconstructed proportions: taller cheek/forehead, protruding muzzle, upright neck,
# slimmer open S centreline and long returning tail. No V7 coordinates are retained.
H=-1.10
BODY_P=[(H,.08,3.12),(H,.08,2.70),(H+.10,.12,2.40),(H+.45,.14,2.20),
(H+1.18,.20,2.18),(H+1.84,.23,1.85),(H+2.05,.24,1.31),(H+1.78,.22,.96),
(H+1.30,.18,.65),(H+1.32,.13,.40),(H+1.90,.12,.18),(H+2.63,.14,.30),
(H+3.18,.17,.64),(H+3.57,.19,1.08),(H+3.70,.22,1.51),(H+3.61,.26,1.87)]
BODY_R=[.41,.49,.58,.64,.63,.59,.46,.40,.35,.31,.245,.215,.153,.105,.067,.010]
body,BC,BR=sweep('New_V8_S_Centerline_Seed',BODY_P,BODY_R,rings=180,sides=32,depth_scale=.90);skin_parts.append(body);BN,BB=frames(BC)
# Re-sculpt the photographed cheek, bridge and orbital volumes as one continuous skin.
HEAD_FIELDS=[((H,0,3.55),(.77,.77,.77),.16),
((H-.145,-.82,3.25),(.34,.43,.29),.13),((H+.145,-.82,3.25),(.34,.43,.29),.14),
((H-.57,-.36,3.19),(.34,.47,.35),.115),((H+.57,-.36,3.19),(.34,.47,.35),.115),
((H,-.50,2.98),(.54,.37,.17),.16),
((H+.015,-.01,2.52),(.44,.39,.44),.17)]
# A tapered superior arc is unioned into the same skin.
BASE_HEAD_FIELDS=list(HEAD_FIELDS)
def baseline_head_support_y(px,pz):
 def at(y):
  value=None
  for c,rr,k in BASE_HEAD_FIELDS:
   d=(px-c[0],y-c[1],pz-c[2]);k0=math.sqrt(sum((d[j]/rr[j])**2 for j in range(3)));k1=math.sqrt(sum((d[j]/(rr[j]*rr[j]))**2 for j in range(3)));q=k0*(k0-1)/max(k1,1e-8)
   if value is None:value=q
   else:
    h=max(0,min(1,.5+.5*(q-value)/k));value=q*(1-h)+value*h-k*h*(1-h)
  return value
 lo=-1.6;hi=0.;assert at(lo)>0 and at(hi)<0
 for _ in range(25):
  mid=(lo+hi)/2
  if at(mid)>0:lo=mid
  else:hi=mid
 return (lo+hi)/2
for sign in (-1,1):
 for j in range(11):
  angle=math.radians(12+156*j/10);px=H+sign*.47+.151*math.cos(angle);pz=3.61+.194*math.sin(angle)
  taper=.67+.33*math.sin(angle);py=baseline_head_support_y(px,pz)+.044
  HEAD_FIELDS.append(((px,py,pz),(.064*taper,.088*taper,.064*taper),.048))
for i,(p,r,k) in enumerate(HEAD_FIELDS):skin_parts.append(ellipsoid('Head_Sculpt_Seed_%02d'%i,p,r))
# Short bent shoulders/wrists lead into broad mitten palms and integrated green toe pads.
LIMBS={
'Front_Left':[(H-.20,.025,2.50),(H-.48,-.06,2.31),(H-.62,-.23,2.27),(H-.68,-.39,2.34)],
'Front_Right':[(H+.22,.015,2.41),(H+.60,-.22,2.25),(H+.65,-.40,2.15),(H+.68,-.57,2.20)],
'Hind_Far':[(.66,.28,1.13),(.27,.27,1.03),(.08,.03,.98),(-.02,-.16,1.03)],
'Hind_Near':[(.68,.015,.95),(.91,-.10,.77),(1.0,-.32,.73),(1.00,-.53,.83)]}
LIMB_RADII={n:([.235,.265,.190,.155] if n.startswith('Front') else [.18,.205,.170,.155]) for n in LIMBS}
PALM_RADII=(.29,.36,.240);PALM_BY_LIMB={n:((.350,.400,.315) if n=='Front_Right' else (.295,.350,.280) if n=='Front_Left' else (.305,.360,.270)) for n in LIMBS};PAW_GREEN_FIELDS=[];limb_samples={}
for name,pts in LIMBS.items():
 ob,cc,rr=sweep(name+'_Bent_Wrist_Seed',pts,LIMB_RADII[name],rings=42,sides=28);skin_parts.append(ob);limb_samples[name]=(cc,rr)
 PAW_GREEN_FIELDS.append((tuple(pts[-1]),PALM_BY_LIMB[name]));skin_parts.append(ellipsoid(name+'_Sculpted_Palm_Seed',pts[-1],PALM_BY_LIMB[name]))
 for j in (-1,1):
  center=tuple(Vector(pts[-1])+Vector((j*.115,-.225,-.028)));radii=(.128,.218,.158)
  PAW_GREEN_FIELDS.append((center,radii));skin_parts.append(ellipsoid(name+'_Integrated_Green_Toe_Seed_'+str(j),center,radii))
EAR_PATHS={}
for s in (-1,1):
 a=Vector((H+s*.64,.06,3.80));b=a+Vector((s*.51,.045,.22))
 cc,rr=sample_path([a,a.lerp(b,.48),a.lerp(b,.86),b],[.10,.22,.130,.028],32);EAR_PATHS[s]=(cc,rr)
 ob,_,_=sweep('Almond_Ear_Seed_'+str(s),[a,a.lerp(b,.48),a.lerp(b,.86),b],[.10,.22,.130,.028],rings=32,sides=24,depth_scale=.56);skin_parts.append(ob)
for o in skin_parts:
 cp=o.copy();cp.data=o.data.copy();SOURCE.objects.link(cp);cp.name='EDIT_'+o.name
for o in skin_parts:bpy.data.objects.remove(o,do_unlink=True)
lo=np.array([-2.43,-1.32,-.08],dtype=np.float32);hi=np.array([3.14,.96,4.47],dtype=np.float32);voxel=args.voxel
assert .035<=voxel<=.08
dims=np.ceil((hi-lo)/voxel).astype(int)+1;axes=[lo[k]+np.arange(dims[k],dtype=np.float32)*voxel for k in range(3)]
grid=np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1).reshape(-1,3)
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
    return np.where(k0<1e-6,-float(min(radii)),k0*(k0-1)/np.maximum(k1,1e-8))

def field_palm(center,radii):
    # Fuller upper knuckles and a gently flatter lower sole form a mitten rather than a ball.
    delta=grid-np.array(center,dtype=np.float32);delta[:,2]/=np.where(delta[:,2]<0,.82,1.03)
    radius=np.array(radii,dtype=np.float32);k0=np.linalg.norm(delta/radius,axis=1);k1=np.linalg.norm(delta/(radius*radius),axis=1)
    return k0*(k0-1)/np.maximum(k1,1e-8)

def union_smooth(a,b,k):
    h=np.clip(.5+.5*(b-a)/k,0,1)
    return b*(1-h)+a*h-k*h*(1-h)


def orbital_support_y(px,pz):
    # One complete nasal, cheek, jaw, brow and cranial union supplies the eye support.
    def ellipsoid_value(y,center,radius):
        d=(px-center[0],y-center[1],pz-center[2])
        k0=math.sqrt(sum((d[i]/radius[i])**2 for i in range(3)))
        k1=math.sqrt(sum((d[i]/(radius[i]*radius[i]))**2 for i in range(3)))
        return k0*(k0-1)/max(k1,1e-8)
    def field_at(y):
        value=ellipsoid_value(y,HEAD_FIELDS[0][0],HEAD_FIELDS[0][1])
        for i in range(1,len(HEAD_FIELDS)):
            c,rr,k=HEAD_FIELDS[i];q=ellipsoid_value(y,c,rr)
            h=max(0,min(1,.5+.5*(q-value)/k));value=q*(1-h)+value*h-k*h*(1-h)
        return value
    lo=-1.6;hi=0.;assert field_at(lo)>0 and field_at(hi)<0
    for _ in range(25):
        mid=(lo+hi)/2
        if field_at(mid)>0:lo=mid
        else:hi=mid
    return (lo+hi)/2

field=field_path(BC,BR,.90)
# A single smooth nasal/cheek/jaw union; no cylindrical eye-seat subtraction.
for index,(center,radii,k) in enumerate(HEAD_FIELDS):
 part=field_ellipsoid(center,radii)

 field=union_smooth(field,part,k)
for name,pts in LIMBS.items():
 cc,rr=limb_samples[name];limb=union_smooth(field_path(cc,rr),field_palm(pts[-1],PALM_BY_LIMB[name]),.10)
 for j in (-1,1):
  center=tuple(Vector(pts[-1])+Vector((j*.115,-.225,-.028)));limb=union_smooth(limb,field_ellipsoid(center,(.128,.218,.158)),.065)
 field=union_smooth(field,limb,.17)
for cc,rr in EAR_PATHS.values():field=union_smooth(field,field_path(cc,rr,.56),.09)
# No eye cavity: shared continuous orbital skin will support the eye rim.

f=field.reshape(tuple(dims));assert all(np.min(v)>voxel*.2 for v in (f[0],f[-1],f[:,0],f[:,-1],f[:,:,0],f[:,:,-1])),'Grid boundary would truncate the skin'
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
mod=skin.modifiers.new("Relax_Implicit_Surface","SMOOTH");mod.factor=.40;mod.iterations=2
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new("Smooth_Implicit_Surface","SUBSURF");mod.levels=1;mod.render_levels=1
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=skin.modifiers.new("Runtime_Surface_Density","DECIMATE");mod.ratio=.22
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in skin.data.polygons:p.use_smooth=True
# Continuous full facial field supplies the eye support without a local orbital depression.
orbital_vertices=0
skin['orbital_support_is_full_smooth_face']=True

# Refine only the lower sculpt before paint and plate carving so crease/paint edges stay smooth.
bm=bmesh.new();bm.from_mesh(skin.data)
lower_edges=[edge for edge in bm.edges if all(vertex.co.z<3.05 for vertex in edge.verts)]
body_density_edges=len(lower_edges)
bmesh.ops.subdivide_edges(bm,edges=lower_edges,cuts=1,use_grid_fill=True)
ngons=[face for face in bm.faces if len(face.verts)>3]
if ngons:bmesh.ops.triangulate(bm,faces=ngons,quad_method="BEAUTY",ngon_method="BEAUTY")
transition_edges=[edge for edge in bm.edges if all(vertex.co.z<3.25 for vertex in edge.verts)]
bmesh.ops.dissolve_degenerate(bm,dist=1e-7,edges=transition_edges)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(skin.data);bm.free()
skin.data.update();skin['belly_density_refined_edges']=body_density_edges
for polygon in skin.data.polygons:polygon.use_smooth=True
model_objects=list(CHAR.objects)
print("SKIN_READY_SMOOTH_UNION",len(skin.data.vertices),len(skin.data.polygons),flush=True)
del grid,cells,corners,tets,cases,edges,verts,faces,field,edge_triangles


skin['shape_revision']=8;skin['model_origin']='New V8 implicit sculpt from approved 2D pixels; no earlier dragon mesh imported'
skin['body_centerline_json']=json.dumps(BODY_P);skin['body_radii_json']=json.dumps(BODY_R);skin['limb_paths_json']=json.dumps(LIMBS);skin['limb_radii_json']=json.dumps(LIMB_RADII);skin['integrated_palm_toe_fields_json']=json.dumps(PAW_GREEN_FIELDS)
# Continuous ivory paint on the same smooth sculpted skin, with paw exclusion.
def smooth01(v):return np.clip(v,0,1)**2*(3-2*np.clip(v,0,1))
P=np.array([v.co[:] for v in skin.data.vertices],dtype=np.float32);C=np.array([c[:] for c in BC],dtype=np.float32);R=np.array(BR,dtype=np.float32)
D=P[:,None,:]-C[None,:,:];Q=D.copy();Q[:,:,1]/=.90
nearest=np.argmin(np.sqrt(np.sum(Q*Q,axis=2))-R[None,:],axis=1)
# Continuous closest segment positions and frames prevent sampled-centerline paint stair steps.
NB=np.array([v[:] for v in BN],dtype=np.float32);BBP=np.array([v[:] for v in BB],dtype=np.float32)
best=np.full(len(P),100.,dtype=np.float32);center=np.zeros_like(P);N=np.zeros_like(P);B=np.zeros_like(P);u=np.zeros(len(P),dtype=np.float32)
for segment in (np.clip(nearest-1,0,len(C)-2),np.clip(nearest,0,len(C)-2)):
 a=C[segment];d=C[segment+1]-a;qq=P-a;dq=d.copy();pq=qq.copy();dq[:,1]/=.90;pq[:,1]/=.90
 t=np.clip(np.sum(pq*dq,axis=1)/np.maximum(np.sum(dq*dq,axis=1),1e-8),0,1);c=a+d*t[:,None];radius=R[segment]*(1-t)+R[segment+1]*t
 distance=P-c;distance[:,1]/=.90;score=np.linalg.norm(distance,axis=1)-radius;use=score<best
 ni=NB[segment]*(1-t[:,None])+NB[segment+1]*t[:,None];bi=BBP[segment]*(1-t[:,None])+BBP[segment+1]*t[:,None]
 best[use]=score[use];center[use]=c[use];N[use]=ni[use];B[use]=bi[use];u[use]=(segment[use]+t[use])/(len(C)-1)
N/=np.maximum(np.linalg.norm(N,axis=1)[:,None],1e-8);B/=np.maximum(np.linalg.norm(B,axis=1)[:,None],1e-8);delta=P-center
tailmix=smooth01((u-.56)/.25);front=.86*(1-tailmix)+.20*tailmix;under=.51*(1-tailmix)+.98*tailmix
target=-B*front[:,None]-N*under[:,None];target/=np.maximum(np.linalg.norm(target,axis=1)[:,None],1e-8)
unit=delta/np.maximum(np.linalg.norm(delta,axis=1)[:,None],1e-8);mask=smooth01((np.sum(unit*target,axis=1)-.64)/.075)
limb_paint_protrusion=smooth01((best+.008)/.085)
for name,(cc,rr) in limb_samples.items():
 L=np.array([v[:] for v in cc],dtype=np.float32);dr=P[:,None,:]-L[None,:,:];dist=np.linalg.norm(dr,axis=2);j=dist.argmin(axis=1);d=dist[np.arange(len(P)),j]
 tip=smooth01((j/(len(L)-1)-.12)/.48);influence=1-smooth01((d-np.array(rr)[j]-.012)/.14);mask*=1-tip*influence*limb_paint_protrusion
# Keep the full palm and knuckle volumes green, with a clean shoulder/belly transition.
for center,radii in PAW_GREEN_FIELDS:
 d=P-np.asarray(center);r=np.asarray(radii);q0=np.linalg.norm(d/r,axis=1);q1=np.linalg.norm(d/(r*r),axis=1);dist=q0*(q0-1)/np.maximum(q1,1e-8)
 mask*=1-(1-smooth01((dist-.006)/.08))*limb_paint_protrusion
x=np.abs(P[:,0]-H);lip=2.985+.13*(np.clip(x/.60,0,1)**1.6)
jaw=(1-smooth01((P[:,2]-lip)/.026))*smooth01((-P[:,1]-.35)/.18)*(1-smooth01((x-.59)/.16))
head_zone=smooth01((P[:,2]-2.78)/.22)*(1-smooth01((x-1.01)/.16));mask=mask*(1-head_zone)+jaw*head_zone
skin_mat=bpy.data.materials.new('V8_Continuous_Teal_Ivory_Color');skin_mat.use_nodes=True
bs=skin_mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.67;bs.inputs['Specular IOR Level'].default_value=.25
node=skin_mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='BodyTint';skin_mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
skin.data.materials.clear();skin.data.materials.append(skin_mat)
ca=skin.data.color_attributes.new(name='BodyTint',type='FLOAT_COLOR',domain='POINT');skin.data.color_attributes.active_color_index=0;skin.data.color_attributes.render_color_index=0
teal=np.array(TEAL.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3]);ivory=np.array(CREAM.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3])
colors=teal[None,:]*(1-mask[:,None])+ivory[None,:]*mask[:,None];rgba=np.concatenate([colors,np.ones((len(P),1))],axis=1);ca.data.foreach_set('color',rgba.astype(np.float32).reshape(-1));skin['paint_method']='Continuous linear color attribute, no disconnected ivory shell'
def tube_detail(name,points,radii,material,region='Body',rings=48,sides=12):
 ob,_,_=sweep(name,points,radii,material,rings=rings,sides=sides);ob['deform_region']=region;return ob
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
    ob['deform_region']='Head'
    return ob

smile=[]
for j in range(23):
 dx=-.55+1.10*j/22;z=3.010+.115*(abs(dx)/.55)**1.7;ok,p,no,_=skin.ray_cast(Vector((H+dx,-3,z)),Vector((0,1,0)));assert ok
 smile.append((H+dx,p.y-.008,z))
tube_detail('Gentle_Closed_Toothless_Smile',smile,[.0075]*len(smile),MOUTH,'Head',rings=55,sides=10)
def oval_volume(name,center,normal,u,v,w,h,depth,material):
 rings=20;sides=64;vv=[tuple(center+normal*depth)];uv=[(0.,0.)];ff=[]
 for i in range(1,rings+1):
  r=i/rings
  for j in range(sides):
   a=2*math.pi*j/sides;dx=w*r*math.cos(a);dz=h*r*math.sin(a)
   vv.append(tuple(center+u*dx+v*dz+normal*(depth*math.sqrt(max(0,1-r*r)))));uv.append((dx,dz))
 for j in range(sides):ff.append((0,1+j,1+(j+1)%sides))
 for i in range(rings-1):
  for j in range(sides):
   a=1+i*sides+j;b=1+i*sides+(j+1)%sides;ff.append((a,a+sides,b+sides,b))
 vv.append(tuple(center-normal*.026));uv.append((0.,0.));back=len(vv)-1;rim=1+(rings-1)*sides
 for j in range(sides):ff.append((back,rim+(j+1)%sides,rim+j))
 ob=mesh(name,vv,ff,material);ob['deform_region']='Head';return ob,uv

def sculpted_eye(sign):
 x=H+sign*.47;z=3.61;w=.123;h=.169;rings=22;sides=64;verts=[];uv=[];faces=[]
 support_y=orbital_support_y
 def front(dx,dz,r):
  # Use the actual cranial/brow design surface, never drape the iris across the snout.
  return Vector((x+dx,support_y(x+dx,z+dz)-.001-.038*math.sqrt(max(0,1-r*r)),z+dz))
 verts.append(tuple(front(0,0,0)));uv.append((0.,0.,0.))
 for i in range(1,rings+1):
  r=i/rings
  for j in range(sides):
   a=2*math.pi*j/sides;dx=w*r*math.cos(a);dz=h*r*math.sin(a);verts.append(tuple(front(dx,dz,r)));uv.append((dx,dz,r))
 for j in range(sides):faces.append((0,1+j,1+(j+1)%sides))
 for i in range(rings-1):
  for j in range(sides):
   p=1+i*sides+j;q=1+i*sides+(j+1)%sides;faces.append((p,p+sides,q+sides,q))
 n_front=len(verts);front_faces=list(faces)
 # The matching back layer remains behind every front point, even on a curved snout.
 for vertex,(dx,dz,r) in zip(list(verts),list(uv)):
  base_y=vertex[1]+.001+.038*math.sqrt(max(0,1-r*r))
  verts.append((vertex[0],base_y+.045,vertex[2]));uv.append((dx,dz,r))
 for face in front_faces:faces.append(tuple(n_front+i for i in reversed(face)))
 rim=1+(rings-1)*sides
 for j in range(sides):
  a=rim+j;b=rim+(j+1)%sides;faces.append((a,b,n_front+b,n_front+a))

 material=bpy.data.materials.get('V8_Fitted_Convex_Eye_And_Upper_Lid_Color')
 if material is None:
  material=bpy.data.materials.new('V8_Fitted_Convex_Eye_And_Upper_Lid_Color');material.use_nodes=True;bs=material.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Roughness'].default_value=.38;bs.inputs['Specular IOR Level'].default_value=.25;material.diffuse_color=(1,1,1,1)
  node=material.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='EyeLensTint';material.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 ob=mesh('Eye_Closed_Fitted_Convex_Volume_'+str(sign),verts,faces,material);ob['deform_region']='Head'
 rim_vertices=set(range(rim,rim+sides)) | set(range(n_front+rim,n_front+rim+sides))
 for edge in ob.data.edges:
  if all(i in rim_vertices for i in edge.vertices):edge.use_edge_sharp=True
 for polygon in ob.data.polygons:
  if all(i>=n_front for i in polygon.vertices):polygon.use_smooth=False
 ob.data.update();ca=ob.data.color_attributes.new(name='EyeLensTint',type='FLOAT_COLOR',domain='POINT');ob.data.color_attributes.active_color_index=0;ob.data.color_attributes.render_color_index=0
 white=np.array(WHITE.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]);brown=np.array(BROWN.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]);teal=np.array(TEAL.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3])
 for i,(dx,dz,r) in enumerate(uv):
  pupil=math.sqrt(((dx+sign*.017)/.104)**2+(dz/.162)**2);mix=float(smooth01((1.01-pupil)/.055));color=white*(1-mix)+brown*mix
  ca.data[i].color=(*color,1)
 dx=-.031;dz=.049;r=math.sqrt((dx/w)**2+(dz/h)**2);p=front(dx,dz,r);p.y-=.001;normal=Vector((0,-1,0));u=Vector((1,0,0));v=Vector((0,0,1));oval_volume('Eye_Attached_Glint_'+str(sign),p,normal,u,v,.015,.021,.002,WHITE)
 ob['eye_construction']='Closed shallow convex lens fitted directly to continuous brow/head curvature, thin side-white and an integrated upper lid; no full circular raised socket rim'

def ivory_ear_leaf(s):
 a=Vector((H+s*.75,0,3.823));b=Vector((H+s*1.10,0,4.006));d=(b-a).normalized();side=Vector((-d.z,0,d.x));outline=[]
 for sign,order in [(1,range(25)),(-1,range(24,-1,-1))]:
  for j in order:
   t=j/24;p=a.lerp(b,t)+side*(sign*.098*(math.sin(math.pi*t)**.70));outline.append(p)
 outline=outline[:25]+outline[26:-1];center=a.lerp(b,.51);verts=[];faces=[]
 def project(p):
  ok,loc,no,_=skin.ray_cast(Vector((p.x,-3,p.z)),Vector((0,1,0)));assert ok;return tuple(loc+Vector((0,-.006,0)))
 verts.append(project(center));rings=10;n=len(outline)
 for i in range(1,rings+1):
  for p in outline:verts.append(project(center.lerp(p,i/rings)))
 for j in range(n):faces.append((0,1+j,1+(j+1)%n))
 for i in range(rings-1):
  for j in range(n):
   p=1+i*n+j;q=1+i*n+(j+1)%n;faces.append((p,p+n,q+n,q))
 o=mesh('Surface_V8_Almond_Ear_Ivory_'+str(s),verts,faces,INNER);o['deform_region']='Head'
for s in (-1,1):
 sculpted_eye(s)
 face_patch('V8_Nostril_'+str(s),H+s*.215,3.305,.045,.034,DARK,.007,rotation=s*.36,dome=0)
 ivory_ear_leaf(s)
 # Two thick antlers, one short rounded branch each, splayed like the reference.
 root=Vector((H+s*.44,.10,4.075));pts=[root,root+Vector((s*.10,.055,.30)),root+Vector((s*.27,.065,.62)),root+Vector((s*.36,.05,.85))]
 main,_,_=sweep('Ivory_Antler_'+str(s),pts,[.171,.150,.119,.091],CREAM,rings=38,sides=22)
 a=root+Vector((s*.14,.05,.40));b=root+Vector((s*.46,.08,.59));branch,_,_=sweep('Ivory_Antler_Branch_'+str(s),[a,a.lerp(b,.52),b],[.129,.110,.051],CREAM,rings=22,sides=20)
 c=root+Vector((s*.085,.115,.31));d=root+Vector((-s*.12,.16,.61))
 third,_,_=sweep('Ivory_Antler_Inner_Branch_'+str(s),[c,c.lerp(d,.52),d],[.120,.095,.053],CREAM,rings=24,sides=20)
 end3=ellipsoid('Ivory_Inner_Branch_Round_End_'+str(s),d,(.057,.061,.075),CREAM,segments=20,rings=12)
 end=ellipsoid('Ivory_Antler_Round_End_'+str(s),pts[-1],(.094,.096,.108),CREAM,segments=24,rings=14)
 end2=ellipsoid('Ivory_Branch_Round_End_'+str(s),b,(.055,.057,.069),CREAM,segments=20,rings=12)
 bpy.ops.object.select_all(action='DESELECT')
 for o in (main,branch,third,end,end2,end3):o.select_set(True)
 bpy.context.view_layer.objects.active=main;bpy.ops.object.join()
 mod=main.modifiers.new('Fuse_Round_Antler','REMESH');mod.mode='VOXEL';mod.voxel_size=.024;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=main.modifiers.new('Relax_Antler','SMOOTH');mod.factor=.65;mod.iterations=4;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=main.modifiers.new('Round_Antler','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=main.modifiers.new('Antler_Density','DECIMATE');mod.ratio=.34;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in main.data.polygons:p.use_smooth=True
 main['deform_region']='Head'
# Whisker roots are fitted inside the actual continuous cheek surface.
for sign,name,outer in [
 (-1,'Ivory_Whisker_Left',[(H-.97,-.85,2.98),(H-1.15,-.93,2.49),(H-1.45,-.94,2.33),(H-1.56,-.91,2.45),(H-1.53,-.91,2.60)]),
 (1,'Ivory_Whisker_Right',[(H+.87,-.88,2.96),(H+1.02,-.97,2.57),(H+1.37,-.98,2.42),(H+1.73,-.95,2.47),(H+1.83,-.91,2.63)])]:
 ok,point,normal,_=skin.ray_cast(Vector((H+sign*.56,-3,3.175)),Vector((0,1,0)));assert ok
 root=point+Vector((0,.055,0));join=point+Vector((sign*.145,-.018,-.025))
 tube_detail(name,[root,join]+outer,[.061,.061,.049,.043,.031,.021,.006],CREAM,'Head',rings=78,sides=16)

# Rounded teardrop claws follow a bent path; a hemispherical taper replaces cone tips.
for name,pts in LIMBS.items():
 for j in (-1,1):
  a=Vector(pts[-1])+Vector((j*.115,-.315,-.075));b=a+Vector((-.005,-.080,-.075));e=a+Vector((-.030,-.060,-.175));cc,_=sample_path([a,b,e],[1,1,1],42);nn,bb=frames(cc);vv=[tuple(cc[0])];ff=[];sides=24
  for i in range(1,len(cc)-1):
   t=i/(len(cc)-1);r=.110*math.sqrt(max(0,1-t*t))*(1-.14*t)
   for k in range(sides):
    angle=2*math.pi*k/sides;vv.append(tuple(cc[i]+nn[i]*(r*math.cos(angle))+bb[i]*(r*.96*math.sin(angle))))
  for k in range(sides):ff.append((0,1+(k+1)%sides,1+k))
  for i in range(len(cc)-3):
   for k in range(sides):
    p=1+i*sides+k;q=1+i*sides+(k+1)%sides;ff.append((p,q,q+sides,p+sides))
  vv.append(tuple(cc[-1]));tip=len(vv)-1
  for k in range(sides):ff.append((tip,1+(len(cc)-3)*sides+k,1+(len(cc)-3)*sides+(k+1)%sides))
  ob=mesh(name+'_Curved_Rounded_Teardrop_Claw_'+str(j),vv,ff,CREAM);ob['deform_region']=name;ob['claw_type']='Curved short ivory teardrop with a rounded cap profile, emerging from a sculpted green toe pad'
print('V8_FACE_AND_FOUR_TWO_TOED_PAWS_READY',flush=True)
def flame_leaf(name,points,width,region='Body'):
 cc,_=sample_path(points,[1]*len(points),40)
 for i,c in enumerate(cc):
  t=i/(len(cc)-1);c.y+=width*.18*math.sin(math.pi*t)+width*.78*t*t
 chord=(cc[-1]-cc[0]).normalized();side=Vector((-chord.z,0,chord.x)).normalized();nn=[side for _ in cc];bb=[Vector((0,1,0)) for _ in cc];vv=[tuple(cc[0])];ff=[];sides=20
 for i in range(1,len(cc)-1):
  t=i/(len(cc)-1);shape=(t**.52)*((1-t)**1.10)*2.65 if region=='Body' else (t**.45)*((1-t)**.85)*2.25
  for j in range(sides):
   a=2*math.pi*j/sides;vv.append(tuple(cc[i]+nn[i]*(width*shape*math.cos(a))+bb[i]*(width*(.48 if region=='Body' else .64)*shape*math.sin(a))))
 for j in range(sides):ff.append((0,1+(j+1)%sides,1+j))
 for i in range(len(cc)-3):
  for j in range(sides):
   a=1+i*sides+j;b=1+i*sides+(j+1)%sides;ff.append((a,b,b+sides,a+sides))
 vv.append(tuple(cc[-1]));tip=len(vv)-1
 for j in range(sides):
  a=1+(len(cc)-3)*sides+j;b=1+(len(cc)-3)*sides+(j+1)%sides;ff.append((tip,a,b))
 ob=mesh(name,vv,ff,ORANGE);ob['deform_region']=region;ob['mane_type']='Closed rounded flame lobe, broad shoulder and a soft trailing curved tip';return ob
halo=ellipsoid('Mane_Head_Continuous_Back_Base',(H,.70,3.49),(.92,.30,.77),ORANGE,segments=40,rings=28);halo['deform_region']='Head'
# Large overlapping flame forms around the crown and cheeks.
head_leaves=[
[(H-.47,.38,4.04),(H-.38,.41,4.29),(H-.20,.42,4.46)],
[(H-.12,.41,4.07),(H+.04,.42,4.38),(H+.20,.43,4.55)],
[(H+.22,.41,3.99),(H+.52,.44,4.28),(H+.72,.43,4.41)],
[(H+.53,.39,3.88),(H+.89,.44,3.82),(H+1.10,.65,3.90)],
[(H+.61,.36,3.64),(H+1.04,.44,3.54),(H+1.31,.72,3.67)],
[(H+.62,.33,3.40),(H+1.08,.43,3.34),(H+1.32,.68,3.49)],
[(H+.55,.31,3.17),(H+.96,.43,3.02),(H+1.16,.68,3.11)],
[(H+.43,.31,2.98),(H+.78,.45,2.74),(H+.90,.67,2.83)],
[(H+.35,.28,2.79),(H+.77,.30,2.52),(H+.88,.32,2.57)],
[(H+.30,.27,2.62),(H+.62,.28,2.40),(H+.75,.32,2.46)],
[(H-.61,.39,3.78),(H-.95,.40,3.84),(H-1.12,.41,3.97)],
[(H-.67,.38,3.55),(H-1.00,.39,3.47),(H-1.15,.40,3.55)],
[(H-.61,.34,3.30),(H-.94,.37,3.14),(H-1.06,.40,3.19)],
[(H-.49,.34,3.10),(H-.82,.36,2.91),(H-.93,.39,2.96)]]
for i,pts in enumerate(head_leaves):
 pts=[(p[0],p[1]+(.05 if i%3==0 else -.025 if i%3==1 else .015),p[2]) for p in pts]
 widths=[1.10,1.03,.98,.96,1.10,.91,.89,.77,.65,.57,1.01,.96,.88,.80]
 flame_leaf('Head_Flame_%02d'%i,pts,(.245 if i<8 else .19)*widths[i],'Head')
arc=[0.0]
for i in range(18,168):arc.append(arc[-1]+(BC[i]-BC[i-1]).length)
idx=sorted(set(17+min(range(len(arc)),key=lambda j:abs(arc[j]-d)) for d in np.arange(0,arc[-1]+.001,.26)))
ribbonpts=[BC[i]+BN[i]*(BR[i]*.90)+Vector((0,.245,0)) for i in idx]
tube_detail('Mane_Dorsal_Continuous_Base',ribbonpts,[.074 if i<117 else .05 for i in idx],ORANGE,'Body',rings=140,sides=14)
for k,i in enumerate(idx):
 n=BN[i];t=(BC[min(i+5,len(BC)-1)]-BC[max(0,i-5)]).normalized();a=BC[i]+n*(BR[i]*.88)+Vector((0,.245,0));length=(.63 if i<108 else .40)*(1+.075*math.sin(k*1.7))
 mid=a+n*(length*.44)+t*(length*.55);end=a+n*(length*.42)+t*(length*1.25)
 flame_leaf('Dorsal_Flame_%02d'%k,[a,mid,end],.220 if i<108 else .160,'Body')
for i,(p,end,w) in enumerate([
((2.42,.43,1.74),(2.26,.46,2.80),.30),((2.45,.43,1.74),(2.87,.45,2.70),.285),
((2.48,.42,1.73),(3.10,.44,2.33),.27),((2.40,.41,1.72),(1.93,.44,2.49),.245),
((2.39,.40,1.68),(1.92,.43,2.10),.225)]):
 a=Vector(p);e=Vector(end);mid=a.lerp(e,.52)+Vector((-.09,0,.07));flame_leaf('Tail_Flame_Fan_%02d'%i,[a,mid,e],w,'Tail')
# Visible soft belly plates remain part of the same closed skin.
base=np.array([v.co[:] for v in skin.data.vertices],dtype=np.float32);norm=np.array([v.normal[:] for v in skin.data.vertices],dtype=np.float32)
indent=np.zeros(len(base),dtype=np.float32);panel_shadow=np.zeros(len(base),dtype=np.float32)
for i in range(22,157,12):
 tangent=np.array((BC[min(i+1,len(BC)-1)]-BC[max(0,i-1)]).normalized());center=np.array(BC[i]);d=base-center;plane=np.abs(d@tangent);local=np.linalg.norm(d,axis=1)<BR[i]*1.65
 cream=smooth01((mask-.72)/.20)*local
 indent=np.maximum(indent,.0220*(1-smooth01(plane/.040))*cream)
 panel_shadow=np.maximum(panel_shadow,.19*(1-smooth01(plane/.013))*cream)
phase=np.mod((u*(len(BC)-1)-22)/12,1.0)
plate_arc=smooth01((u-.11)/.035)*(1-smooth01((u-.87)/.025))
bulge=.006*smooth01((mask-.72)/.20)*smooth01((2.98-base[:,2])/.10)
for v,p,no,cut,lift in zip(skin.data.vertices,base,norm,indent,bulge):v.co=Vector(p+no*(lift-cut))
plate_colors=colors*(1-panel_shadow[:,None]);rgba=np.concatenate([plate_colors,np.ones((len(base),1))],axis=1)
ca.data.foreach_set('color',rgba.astype(np.float32).reshape(-1))
skin.data.update();skin['belly_panels']='Soft raised plate centres, shallow sculpted creases and mild crease pigment in one continuous skin'

def head_affine(p):
 q=Vector((H+(p.x-H)*1.24,p.y*1.19,3.55+(p.z-3.55)*1.18));a=math.radians(-8);z=q.z-3.03
 return Vector((q.x,q.y*math.cos(a)-z*math.sin(a),3.03+q.y*math.sin(a)+z*math.cos(a)))
for o in list(CHAR.objects):
 if o.type!='MESH':continue
 inv=o.matrix_world.inverted()
 if o is skin:
  for v in o.data.vertices:
   p=o.matrix_world@v.co;t=max(0,min(1,(p.z-2.78)/.26));t=t*t*(3-2*t)
   side=max(0,min(1,(1.20-abs(p.x-H))/.24));side=side*side*(3-2*side)
   cap=max(0,min(1,(p.z-3.15)/.22));cap=cap*cap*(3-2*cap);t*=side+(1-side)*cap
   v.co=inv@(p.lerp(head_affine(p),t))
 elif o.get('deform_region')=='Head':
  for v in o.data.vertices:v.co=inv@head_affine(o.matrix_world@v.co)
 o.data.update()
skin['head_proportional_sculpt_json']=json.dumps({'center':(H,0,3.55),'x':1.24,'y':1.19,'z':1.18,'head_rest_up_degrees':8,'head_pivot_z':3.03,'continuous_neck_transition_z':[2.78,3.04],'full_head_and_ear_cap_z':[3.15,3.37]})
# First review is static: do not create an old rig or pretend an idle was applied.
for o in CHAR.objects:
 if o.type=='MESH':o['candidate_status']='V8_STATIC_REVIEW_ONLY_NOT_USER_APPROVED'
ref=bpy.data.images.load(str(REF),check_existing=True);ref.name='Approved_2D_Concept_SHA256_'+REF_SHA[:12];ref.pack();ref.use_fake_user=True
src=bpy.data.texts.new('REGENERATE_build_dragon_v8_static.py');src.write(Path(__file__).read_text(encoding='utf8'))
notes=bpy.data.texts.new('V8_ART_SOURCE_README');notes.write('New reconstructed geometry. Reference pixels are packed and exact. Static review precedes new rig and idle. Technical geometry checks are not photo similarity or user approval. Editable skin/curved flame leaves/hidden construction seeds remain available. No previous mesh or armature imported.\n')
world=bpy.data.worlds.new('Warm_Reference_Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.76,.72,.66,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;SCENE.world=world
SCENE.view_settings.exposure=-.10
floor_bs=FLOOR.node_tree.nodes.get('Principled BSDF');floor_bs.inputs['Emission Color'].default_value=FLOOR.diffuse_color;floor_bs.inputs['Emission Strength'].default_value=.75
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.32));floor=bpy.context.object;floor.name='Preview_Floor';in_collection(floor,STUDIO);floor.data.materials.append(FLOOR)
def point_camera(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,p,energy,size):
 data=bpy.data.lights.new(name,'AREA');ob=bpy.data.objects.new(name,data);STUDIO.objects.link(ob);ob.location=p;data.energy=energy;data.shape='DISK';data.size=size;point_camera(ob,(.1,0,2.4))
area('Key',(-3,-5,7),520,5);area('Fill',(4,-2,4.6),260,5);area('Rim',(1.7,3.2,5.3),480,4)
CAMERAS={}
for name,loc,target,scale in [
('ThreeQuarter',(6,-11,5.4),(.05,0,2.38),6.45),
('HeadThreeQuarter',(H+6,-11,6.25),(H,-.13,3.55),3.33),
('HeadFront',(H,-10.893,5.111),(H,0,3.58),3.30),
('Front',(.10,-11,2.39),(.10,0,2.39),5.63),
('Side',(11,0,2.38),(.05,0,2.38),5.63)]:
 data=bpy.data.cameras.new('Camera_'+name);ob=bpy.data.objects.new('Camera_'+name,data);STUDIO.objects.link(ob);ob.location=loc;point_camera(ob,target);data.type='ORTHO';data.ortho_scale=scale;CAMERAS[name]=ob
SCENE.camera=CAMERAS['ThreeQuarter'];SCENE.frame_start=SCENE.frame_end=0
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'SaJu_Dragon_V8_Volume_Refinement_v22.blend'),compress=True)
report={'status':'V8_NEW_STATIC_RECONSTRUCTION_REVIEW_PENDING','reference_sha256':REF_SHA,'reference_bytes':REF.stat().st_size,'candidate_only':True,'user_final_appearance_approved':False,'old_mesh_or_rig_imported':False,'bones':0,'animation':False,'body_centerline':BODY_P,'body_radii':BODY_R,'limb_paths':LIMBS,'head_fields':HEAD_FIELDS,'skin_vertices':len(skin.data.vertices),'skin_polygons':len(skin.data.polygons),'flame_leaves':len(head_leaves)+len(idx)+5,'paws':4,'blunt_toes':8,'wings':0,'fangs':0,'static_review_before_animation':True,'static_iteration':8,'volume_refinement_iteration':22,'arched_tapered_integrated_superior_lid':True,'taller_rounder_head':True,'narrower_more_convex_oval_eyes':True,'longer_flattened_overlapping_dorsal_flames':True,'parent_v20_photo_review_brow_head_palm_mane_flow':True,'actual_palm_radii_by_limb':PALM_BY_LIMB,'shared_eye_contact_method_and_back_shell_preserved':True,'subdivision_boundary_triangulated_and_degenerate_faces_dissolved':True,'cream_lift_without_nearest_parameter_ripples':True,'lower_body_density_refined_before_paint_and_plates':True,'body_density_refined_edges':body_density_edges,'rounder_chest_belly_and_upper_front_arm':True,'belly_plate_centres_and_creases_more_volumetric':True,'parent_photo_feedback_shorter_rounder_claws':True,'fuller_front_upper_arm_volume':True,'visible_continuous_belly_plates':True,'head_and_ear_surface_affine_consistent':True,'rounded_pointed_mane_between_cones_and_clouds':True,'fitted_buried_whisker_roots':True,'broader_ears_and_cream_inners':True,'fuller_mitten_palms':True,'body_cream_edge_uses_actual_limb_protrusion':True,'three_round_antler_tips_per_side':True,'source_side_white_eye_proportions':True,'soft_rounded_trailing_mane_lobes':True,'fewer_varied_dorsal_mane_lobes':True,'matched_curved_eye_back_shell_prevents_front_self_occlusion':True,'full_facial_support_without_eye_cavity_or_projected_ring':True,'shared_orbital_skin_and_eye_support':True,'orbital_support_vertices':orbital_vertices,'eye_front_back_rim_shading_separated':True,'thin_eyewhite_with_true_brow_sculpt':True,'ocular_clearance_inside_lens_edge_to_remove_dark_gap':False,'tight_eye_footprint_clearance':False,'eye_surface_contact_depth_corrected':True,'belly_panel_grooves_in_same_skin':True,'eye_support_follows_cranium_and_brow_without_snout_draping':True,'continuous_mane_back_volume':True,'thicker_shorter_neck_and_plumper_torso':True,'thin_side_white_fitted_eyes':True,'uneven_back_bending_head_mane_layers':True,'wrist_endpoint_no_longer_overrides_palm_sculpt':True,'continuous_centerline_paint_frames':True,'source_eye_pixel_diagnostic_applied':True,'eye_center_lowered_for_source_nose_eye_spacing':True,'asymmetric_palm_and_visible_curved_claw_tips':True,'continuous_upper_orbital_pad_without_raised_full_ring':True,'closed_convex_eye_lenses':True,'bent_wrist_mitten_palms_integrated_green_toes':True,'curved_blunt_claws':True,'body_composition_and_colors_preserved':True,'v01_source_preserved_sha256':'1918f25750ba8ccf21c8a324fbd00968a9b521c72cc771751c6716cf81f339d5','voxel':args.voxel,'camera_approximation':'Original 2D camera is unknown; front and 3/4 matched approximately, no exact-camera claim'}
(OUT/'generation-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
if args.stills:
 for name in ('ThreeQuarter','HeadThreeQuarter','HeadFront'):
  SCENE.camera=CAMERAS[name];floor.hide_render=name!='ThreeQuarter';SCENE.render.filepath=str(OUT/'previews'/(name.lower()+'.png'));bpy.ops.render.render(write_still=True);print('V8_STATIC_PREVIEW_READY',name,flush=True)
print('V8_STATIC_RECONSTRUCTION_READY',str(OUT),flush=True)
