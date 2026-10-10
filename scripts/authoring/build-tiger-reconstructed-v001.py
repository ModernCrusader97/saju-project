"""Author the new tiger candidate from original procedural shapes, with no inputs.

Run at repository root:
  blender --background --factory-startup --threads 1 --python scripts/authoring/build-tiger-reconstructed-v001.py

Blender 4.3.2 is the recorded authoring version. This is a new reconstruction,
not a recovered/approved historical zodiac model. No external assets are used.
"""
from pathlib import Path
import hashlib
import json
import math

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/source-reference/tiger-reconstructed-v001"
RUNTIME = ROOT / "public/models/zodiac-pets/tiger-reconstructed-v001.glb"
SOURCE.mkdir(parents=True, exist_ok=True)
RUNTIME.parent.mkdir(parents=True, exist_ok=True)

VERSION = "tiger-reconstructed-v001"
COAT = "DCA257"
CREAM = "EEE1C8"
STRIPE = "3D3831"
TAIL_POINTS = [
    (0, .34, .59), (0, .55, .57), (.16, .79, .64),
    (.39, .86, .84), (.59, .70, 1.01), (.60, .49, 1.00),
]
SEEDS = [
    ("torso", (0, .10, .70), (.45, .40, .51)),
    ("neck", (0, -.025, 1.03), (.36, .32, .33)),
    ("head", (0, -.055, 1.42), (.59, .43, .54)),
    ("chin", (0, -.26, 1.16), (.39, .28, .20)),
]
for s in [-1, 1]:
    SEEDS.extend([
        (f"foreleg-{s}", (s * .255, -.225, .40), (.16, .19, .32)),
        (f"front-paw-{s}", (s * .255, -.36, .145), (.19, .245, .145)),
        (f"hip-{s}", (s * .34, .24, .40), (.215, .275, .27)),
        (f"rear-paw-{s}", (s * .36, .17, .14), (.205, .26, .14)),
        (f"ear-{s}", (s * .455, -.015, 1.80), (.16, .105, .175)),
        (f"muzzle-{s}", (s * .105, -.43, 1.18), (.17, .11, .115)),
    ])


def linear_channel(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def color(code):
    return tuple(linear_channel(int(code[i:i + 2], 16) / 255) for i in [0, 2, 4])


def smooth(a, b, x):
    t = max(0., min(1., (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def nearest_path(point, points):
    distance, position, total, accum = 100., 0., 0., 0.
    lengths = [(Vector(b) - Vector(a)).length for a, b in zip(points, points[1:])]
    total = sum(lengths)
    for (a, b), length in zip(zip(points, points[1:]), lengths):
        start, delta = Vector(a), Vector(b) - Vector(a)
        t = max(0., min(1., (point - start).dot(delta) / delta.length_squared))
        d = (point - start - delta * t).length
        if d < distance:
            distance, position = d, (accum + length * t) / total
        accum += length
    return distance, position


def material(name, code, roughness=.75):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color(code), 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0
    return mat


def oval(name, center, radii, mat=None, collection=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24 if mat else 32, ring_count=16 if mat else 20, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if collection:
        for current in list(obj.users_collection):
            current.objects.unlink(obj)
        collection.objects.link(obj)
    return obj


def tube(name, points, radius, mat=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for b, point in zip(spline.bezier_points, points):
        b.co = point
        b.handle_left_type = "AUTO"
        b.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if mat:
        curve.materials.append(mat)
    return obj


def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
for old in list(bpy.data.collections):
    if old.name != "Collection" and old.users == 0:
        bpy.data.collections.remove(old)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 0
scene.frame_end = 150

source_shapes = bpy.data.collections.new("Editable_original_sculpt_seeds_DO_NOT_EXPORT")
scene.collection.children.link(source_shapes)
seeds = [oval(name, center, radii) for name, center, radii in SEEDS]
tail_seed = tube("tail-sculpt-seed", TAIL_POINTS, .073)
select_only([tail_seed])
bpy.ops.object.convert(target="MESH")
seeds.append(bpy.context.object)
seeds.append(oval("rounded-tail-tip", TAIL_POINTS[-1], (.074, .074, .074)))

for seed in seeds:
    copy = seed.copy()
    copy.data = seed.data.copy()
    source_shapes.objects.link(copy)
    copy.hide_render = True
    copy.hide_set(True)
source_shapes.hide_render = True
source_shapes.hide_viewport = True

select_only(seeds)
bpy.ops.object.join()
body = bpy.context.object
body.name = "Tiger_FusedBody"
body.data.name = "Tiger_FusedBodyMesh"
# Joining alone is not the authored body. Voxel union removes all intersecting
# seed surfaces, then applied smooth/subdivision produces continuous joints.
remesh = body.modifiers.new("Applied_closed_voxel_union", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = .025
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)
soft = body.modifiers.new("Applied_joint_sculpt_smoothing", "SMOOTH")
soft.factor = .65
soft.iterations = 5
bpy.ops.object.modifier_apply(modifier=soft.name)
subdiv = body.modifiers.new("Applied_smooth_surface", "SUBSURF")
subdiv.levels = 1
subdiv.render_levels = 1
bpy.ops.object.modifier_apply(modifier=subdiv.name)
reduce = body.modifiers.new("Applied_runtime_triangle_budget", "DECIMATE")
reduce.ratio = .20
bpy.ops.object.modifier_apply(modifier=reduce.name)
# Canonical vertex/triangle order makes UV island packing independent of the
# internal order emitted by parallel voxel union. Rounding is far below a
# displayed pixel (.000001 source units), and is checked for closed topology.
old_mesh = body.data
old_mesh.calc_loop_triangles()
coords = [tuple(round(component, 6) for component in vert.co) for vert in old_mesh.vertices]
order = sorted(range(len(coords)), key=lambda index: coords[index])
remap = {old: new for new, old in enumerate(order)}
faces = []
for triangle in old_mesh.loop_triangles:
    ids = [remap[index] for index in triangle.vertices]
    pivot = ids.index(min(ids))
    faces.append(tuple(ids[pivot:] + ids[:pivot]))
canonical = bpy.data.meshes.new("Tiger_FusedBodyMesh_canonical")
canonical.from_pydata([coords[index] for index in order], [], sorted(faces))
canonical.update()
body.data = canonical
bpy.data.meshes.remove(old_mesh)
canonical.name = "Tiger_FusedBodyMesh"
for polygon in body.data.polygons:
    polygon.use_smooth = True

coat_mat = material("Tiger_original_UV_coat", "FFFFFF", .79)
vertex = coat_mat.node_tree.nodes.new("ShaderNodeVertexColor")
vertex.layer_name = "TigerCoat"
coat_mat.node_tree.links.new(vertex.outputs["Color"], coat_mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
body.data.materials.clear()
body.data.materials.append(coat_mat)
attribute = body.data.color_attributes.new(name="TigerCoat", type="FLOAT_COLOR", domain="POINT")
body.data.color_attributes.active_color = attribute
orange, cream, stripe = color(COAT), color(CREAM), color(STRIPE)

def vector_paint(points):
    """Evaluate our original coat directly at UV texel positions in the sculpt.

    The native color attribute remains an editable study. Runtime color uses
    this exact 3D paint field sampled densely, avoiding coarse triangle edges.
    """
    x, y, z = points.T

    def s(a, b, value):
        t = np.clip((value - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    belly = (1 - s(.24, .33, np.abs(x))) * (1 - s(-.23, -.14, y)) * (1 - s(.97, 1.08, z))
    muzzle = (1 - s(.30, .39, np.abs(x))) * (1 - s(-.37, -.29, y)) * (1 - s(1.27, 1.36, z)) * s(.99, 1.09, z)
    cream_weight = np.maximum(belly, muzzle)[:, None]
    c = np.asarray(orange) * (1 - cream_weight) + np.asarray(cream) * cream_weight
    marks = np.zeros(len(points), dtype=np.float32)
    forehead = (z > 1.30) & (y < -.16)
    width = .016 + .027 * s(1.53, 1.87, z)
    marks = np.maximum(marks, (1 - s(width, width + .013, np.abs(x))) * forehead * (z > 1.53))
    for height, limit in [(1.68, .34), (1.79, .29), (1.89, .19)]:
        target = height + .13 * np.abs(x) - .09 * x * x
        marks = np.maximum(marks, (1 - s(.017, .030, np.abs(z - target))) * (1 - s(limit - .06, limit + .02, np.abs(x))) * forehead)
    cheeks = (z > 1.15) & (z < 1.62) & (np.abs(x) > .34)
    for height in [1.27, 1.39, 1.51]:
        target = height + .31 * (np.abs(x) - .37) + .14 * y
        marks = np.maximum(marks, (1 - s(.016, .034, np.abs(z - target))) * s(.33, .40, np.abs(x)) * cheeks)
    flank = (.30 < z) & (z < 1.19) & (y > -.17)
    phase = y * 15.8 + np.abs(x) * 2.4 + z * 1.8
    width = .16 + .14 * s(.2, .45, np.abs(x))
    marks = np.maximum(marks, (1 - s(width, width + .14, np.abs(np.sin(phase)))) * flank)
    legs = (z < .57) & (y < -.17)
    for height in [.25, .41, .55]:
        marks = np.maximum(marks, (1 - s(.017, .031, np.abs(z - height - .025 * np.cos(x * 15)))) * s(.13, .18, np.abs(x)) * legs)
    marks = np.maximum(marks, s(1.84, 1.94, z) * (z > 1.81) * (np.abs(x) > .36))
    lengths = [np.linalg.norm(np.asarray(b) - np.asarray(a)) for a, b in zip(TAIL_POINTS, TAIL_POINTS[1:])]
    closest = np.full(len(points), np.inf)
    tail_u = np.zeros(len(points))
    accum = 0.
    for (a, b), length in zip(zip(TAIL_POINTS, TAIL_POINTS[1:]), lengths):
        start, delta = np.asarray(a), np.asarray(b) - np.asarray(a)
        t = np.clip(((points - start) * delta).sum(axis=1) / (delta * delta).sum(), 0, 1)
        distance = np.linalg.norm(points - start - t[:, None] * delta, axis=1)
        closer = distance < closest
        tail_u[closer] = (accum + length * t[closer]) / sum(lengths)
        closest = np.minimum(closest, distance)
        accum += length
    tail = (closest < .10) & ((y > .49) | ((tail_u > .85) & (x > .45)))
    tail_mark = 1 - s(.25, .40, np.abs(np.sin(tail_u * math.pi * 7)))
    tail_mark[tail_u > .94] = 1.
    marks = np.maximum(marks, tail_mark * tail)
    return c * (1 - marks[:, None]) + np.asarray(stripe) * marks[:, None]


painted_vertices = vector_paint(np.asarray([body.matrix_world @ vert.co for vert in body.data.vertices]))
for vert, painted in zip(body.data.vertices, painted_vertices):
    attribute.data[vert.index].color = (*painted, 1)


def paint_uv_texture():
    select_only([body])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(72), island_margin=.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    body.data.calc_loop_triangles()
    uv_layer = body.data.uv_layers.active
    resolution = 2048
    surface = np.zeros((resolution, resolution, 3), dtype=np.float32)
    occupied = np.zeros((resolution, resolution), dtype=bool)
    # Rasterize the final low-poly UVs to sculpt positions, then evaluate the
    # original field per pixel. No rendered lighting is baked into the texture.
    for tri in body.data.loop_triangles:
        uv = np.asarray([uv_layer.data[index].uv[:] for index in tri.loops]) * resolution - .5
        lower = np.maximum(np.floor(uv.min(axis=0)).astype(int), 0)
        upper = np.minimum(np.ceil(uv.max(axis=0)).astype(int), resolution - 1)
        if np.any(lower > upper):
            continue
        px, py = np.meshgrid(np.arange(lower[0], upper[0] + 1), np.arange(lower[1], upper[1] + 1))
        delta0, delta1 = uv[1] - uv[0], uv[2] - uv[0]
        det = delta0[0] * delta1[1] - delta0[1] * delta1[0]
        if abs(det) < 1e-8:
            continue
        dx, dy = px - uv[0, 0], py - uv[0, 1]
        b = (dx * delta1[1] - dy * delta1[0]) / det
        c = (delta0[0] * dy - delta0[1] * dx) / det
        a = 1 - b - c
        valid = (a >= -.0001) & (b >= -.0001) & (c >= -.0001)
        if not valid.any():
            continue
        positions = np.asarray([body.matrix_world @ body.data.vertices[index].co for index in tri.vertices])
        value = a[..., None] * positions[0] + b[..., None] * positions[1] + c[..., None] * positions[2]
        surface[py[valid], px[valid]] = value[valid]
        occupied[py[valid], px[valid]] = True
    pixels = np.ones((resolution, resolution, 4), dtype=np.float32)
    pixels[..., :3] = orange
    pixels[occupied, :3] = vector_paint(surface[occupied])
    # Expand our own edge colors into UV gutters for bilinear filtering/mips.
    for _ in range(12):
        known = occupied.copy()
        total = np.zeros((resolution, resolution, 3), dtype=np.float32)
        count = np.zeros((resolution, resolution), dtype=np.float32)
        for dy, dx in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            neighbor = np.roll(known, (dy, dx), axis=(0, 1))
            total += np.roll(pixels[..., :3], (dy, dx), axis=(0, 1)) * neighbor[..., None]
            count += neighbor
        fill = (~known) & (count > 0)
        pixels[fill, :3] = total[fill] / count[fill, None]
        occupied |= fill
    image = bpy.data.images.new("Tiger_original_procedural_coat_2048", resolution, resolution, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(SOURCE / "Tiger_Coat_v001.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    image_node = coat_mat.node_tree.nodes.new("ShaderNodeTexImage")
    image_node.image = image
    coat_mat.node_tree.links.new(image_node.outputs["Color"], coat_mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    print("TIGER_ORIGINAL_COAT_UV_TEXTURE", resolution, "source pixels", int(occupied.sum()))


paint_uv_texture()

cream_mat = material("Tiger_cream_eye_and_ear", CREAM, .69)
dark_mat = material("Tiger_dark_round_pupils", "292F2B", .24)
iris_mat = material("Tiger_warm_amber_iris", "B97D35", .40)
glint_mat = material("Tiger_bright_eye_glints", "FFFFFF", .16)
nose_mat = material("Tiger_soft_rose_nose", "AB7366", .65)
features = []


def front_y(x, z):
    # Attach details to the remeshed surface, never a guessed sphere radius.
    inverse = body.matrix_world.inverted()
    origin = inverse @ Vector((x, -3, z))
    direction = inverse.to_3x3() @ Vector((0, 1, 0))
    hit, point, _, _ = body.ray_cast(origin, direction.normalized())
    if not hit:
        raise RuntimeError(f"Face attachment missed authored body at {(x, z)}")
    return (body.matrix_world @ point).y


for s in [-1, 1]:
    x, z = s * .245, 1.425
    y = front_y(x, z)
    features.append(oval(f"Eye_white_{s}", (x, y - .012, z), (.142, .050, .145), cream_mat))
    features.append(oval(f"Eye_amber_iris_{s}", (x - s * .012, y - .052, z - .001), (.106, .022, .111), iris_mat))
    features.append(oval(f"Eye_round_pupil_{s}", (x - s * .014, y - .070, z), (.081, .015, .090), dark_mat))
    features.append(oval(f"Eye_large_glint_{s}", (x - .027, y - .085, z + .040), (.029, .011, .031), glint_mat))
    features.append(oval(f"Eye_small_glint_{s}", (x + .029, y - .084, z - .028), (.011, .007, .012), glint_mat))
    ear_x, ear_z = s * .456, 1.820
    features.append(oval(f"Embedded_cream_ear_{s}", (ear_x, front_y(ear_x, ear_z) - .006, ear_z), (.098, .023, .109), cream_mat))
    for i in range(3):
        dot_x, dot_z = s * (.158 + i * .036), 1.176 + .018 * (i % 2)
        features.append(oval(f"Muzzle_whisker_dot_{s}_{i}", (dot_x, front_y(dot_x, dot_z) - .007, dot_z), (.009, .009, .008), dark_mat))

# Rounded triangular nose with a soft bevel, authored directly as a small mesh.
nose_y = front_y(0, 1.225) - .022
mesh = bpy.data.meshes.new("Rounded_triangular_tiger_nose_mesh")
verts = [(-.056, nose_y, 1.255), (.056, nose_y, 1.255), (0, nose_y - .021, 1.185),
         (-.050, nose_y + .035, 1.252), (.050, nose_y + .035, 1.252), (0, nose_y + .02, 1.192)]
mesh.from_pydata(verts, [], [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)])
obj = bpy.data.objects.new("Tiger_rounded_nose", mesh)
bpy.context.collection.objects.link(obj)
mesh.materials.append(nose_mat)
select_only([obj])
bevel = obj.modifiers.new("Soft_nose_edges", "BEVEL")
bevel.width = .013
bevel.segments = 3
bpy.ops.object.modifier_apply(modifier=bevel.name)
for polygon in mesh.polygons:
    polygon.use_smooth = True
features.append(obj)
mouth_y = front_y(0, 1.160) - .008
mouth = tube("Tiger_gentle_mouth", [(-.044, mouth_y, 1.152), (0, mouth_y - .01, 1.133), (.044, mouth_y, 1.152)], .006, dark_mat)
select_only([mouth])
bpy.ops.object.convert(target="MESH")
features.append(bpy.context.object)

select_only([body])
bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.object
rig.name = "Tiger_Idle_Rig"
rig.data.name = "Tiger_original_idle_skeleton"
rig.show_in_front = True
bpy.ops.object.mode_set(mode="EDIT")
rig.data.edit_bones.remove(rig.data.edit_bones[0])
root = rig.data.edit_bones.new("TigerRoot")
root.head, root.tail = (0, 0, .08), (0, 0, .50)
chest = rig.data.edit_bones.new("TigerChest")
chest.head, chest.tail, chest.parent = (0, 0, .53), (0, 0, 1.08), root
head = rig.data.edit_bones.new("TigerHead")
head.head, head.tail, head.parent = (0, -.04, 1.08), (0, -.04, 1.68), chest
tail0 = rig.data.edit_bones.new("TigerTailBase")
tail0.head, tail0.tail, tail0.parent = TAIL_POINTS[0], TAIL_POINTS[2], root
tail1 = rig.data.edit_bones.new("TigerTailTip")
tail1.head, tail1.tail, tail1.parent = TAIL_POINTS[2], TAIL_POINTS[4], tail0
bpy.ops.object.mode_set(mode="OBJECT")
groups = {name: body.vertex_groups.new(name=name) for name in ["TigerRoot", "TigerChest", "TigerHead", "TigerTailBase", "TigerTailTip"]}
for vert in body.data.vertices:
    p = body.matrix_world @ vert.co
    d, u = nearest_path(p, TAIL_POINTS)
    weights = {}
    if d < .12 and p.y > .44:
        tip = smooth(.26, .68, u)
        weights = {"TigerTailBase": 1 - tip, "TigerTailTip": tip}
    else:
        head_weight = smooth(1.01, 1.30, p.z)
        chest_weight = smooth(.40, .70, p.z) * (1 - head_weight)
        weights = {"TigerHead": head_weight, "TigerChest": chest_weight, "TigerRoot": 1 - head_weight - chest_weight}
    for name, weight in weights.items():
        if weight > .00001:
            groups[name].add([vert.index], weight, "REPLACE")
body.parent = rig
modifier = body.modifiers.new("Tiger_skin_for_subtle_idle", "ARMATURE")
modifier.object = rig
for feature in features:
    world = feature.matrix_world.copy()
    feature.parent = rig
    feature.parent_type = "BONE"
    feature.parent_bone = "TigerHead"
    feature.matrix_world = world

rig.animation_data_create()
action = bpy.data.actions.new("TigerIdle")
rig.animation_data.action = action
for bone in rig.pose.bones:
    bone.rotation_mode = "XYZ"
for frame in range(0, 151, 5):
    phase = 2 * math.pi * frame / 150
    # Endpoints exactly match; no gait or root translation. Feet remain planted.
    breathing = 1 + .009 * (1 - math.cos(phase))
    rig.pose.bones["TigerChest"].scale = (breathing, 1 + .004 * (1 - math.cos(phase)), 1)
    rig.pose.bones["TigerHead"].rotation_euler = (.012 * math.sin(phase), .009 * math.sin(phase), .018 * math.sin(phase))
    rig.pose.bones["TigerTailBase"].rotation_euler = (0, .035 * math.sin(phase), .045 * math.sin(phase))
    rig.pose.bones["TigerTailTip"].rotation_euler = (.035 * math.sin(phase), 0, .055 * math.sin(phase))
    for name, path in [("TigerChest", "scale"), ("TigerHead", "rotation_euler"), ("TigerTailBase", "rotation_euler"), ("TigerTailTip", "rotation_euler")]:
        rig.pose.bones[name].keyframe_insert(data_path=path, frame=frame, group=name)
for fcurve in action.fcurves:
    for point in fcurve.keyframe_points:
        point.interpolation = "LINEAR"
scene.frame_set(0)

rig["authorship"] = "new-reconstruction"
rig["originalSourceStatus"] = "missing-source"
rig["candidateStatus"] = "unapproved"
rig["assetVersion"] = VERSION
body["continuousBody"] = "applied voxel union of original sculpt seeds"
body["coat"] = "original 3D paint field baked at authored UVs; no external assets"

# Native file preserves hidden editable seeds, skin weights and the complete
# action. Only the final authored animal and its rig are selected for glTF.
select_only([rig, body, *features])
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "Tiger_Reconstructed_v001.blend"), check_existing=False)
bpy.ops.export_scene.gltf(
    filepath=str(RUNTIME), export_format="GLB", use_selection=True,
    export_yup=True, export_texcoords=True, export_normals=True,
    export_materials="EXPORT", export_vertex_color="MATERIAL",
    export_all_vertex_colors=False, export_extras=True,
    export_animations=True, export_animation_mode="ACTIONS",
    export_frame_range=True, export_frame_step=1, export_force_sampling=True,
    export_optimize_animation_size=True, export_skins=True,
)

vertices = len(body.data.vertices)
body.data.calc_loop_triangles()
recipe = {
    "schemaVersion": 1, "version": VERSION,
    "authorship": "new-reconstruction", "latestApprovedStatus": "new-candidate-unapproved",
    "recoveredOriginal": False, "originalSourceStatus": "missing-source",
    "evidence": [
        "lib/planet/spirit-zodiac-pet.ts at ee6e9740054394b0bee30563f35e957b49adf4bb: colors and temporary tiger study",
        "docs/SPIRIT_DEPTH_AND_PETS.md: temporary animal silhouettes, not original authored animal assets",
        "docs/qa/zodiac-pet-assets/source-inventory.json: audited legal archive contains no authored zodiac models",
    ],
    "externalAssets": [], "textures": "original 3D coat field baked to a packed 2048x2048 UV image; no external dependencies",
    "blenderVersion": bpy.app.version_string,
    "command": "blender --background --factory-startup --threads 1 --python scripts/authoring/build-tiger-reconstructed-v001.py",
    "sourceCoordinates": "Z-up; facing -Y; glTF export Y-up facing +Z",
    "sculpt": {"seeds": [{"name": n, "center": c, "radii": r} for n, c, r in SEEDS], "tailPoints": TAIL_POINTS, "voxelSize": .025, "smoothIterations": 5, "subdivisionLevels": 1, "decimateRatio": .20, "coordinateRounding": .000001, "ordering": "lexicographic vertices and canonical oriented triangles"},
    "coatSRGB": {"orange": COAT, "cream": CREAM, "stripes": STRIPE},
    "animation": {"clip": "TigerIdle", "durationSeconds": 5, "fps": 30, "feet": "root bone; no translation or gait"},
    "geometry": {"bodyVertices": vertices, "bodyTriangles": len(body.data.loop_triangles), "faceMeshes": len(features)},
    "runtime": {"file": str(RUNTIME.relative_to(ROOT)), "bytes": RUNTIME.stat().st_size, "sha256": hashlib.sha256(RUNTIME.read_bytes()).hexdigest()},
    "source": {"file": str((SOURCE / "Tiger_Reconstructed_v001.blend").relative_to(ROOT)), "sha256": hashlib.sha256((SOURCE / "Tiger_Reconstructed_v001.blend").read_bytes()).hexdigest()},
    "coatTexture": {"file": str((SOURCE / "Tiger_Coat_v001.png").relative_to(ROOT)), "sha256": hashlib.sha256((SOURCE / "Tiger_Coat_v001.png").read_bytes()).hexdigest(), "resolution": [2048, 2048], "authorship": "original procedural 3D field evaluated at final mesh UV texels"},
    "generator": {"file": str(Path(__file__).relative_to(ROOT)), "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
    "regeneration": {"byteExact": False, "variance": "Blender UV island packing can vary across fresh runs, changing the encoded coat and whole GLB bytes", "contract": "verify geometry, skin, materials, idle and coat field; record each exported runtime checksum"},
}
(SOURCE / "recipe.json").write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
# Refresh only this explicitly selected candidate's checksum. Never alter the
# other animals, a different version, or a historical original's provenance.
manifest_path = RUNTIME.parent / "manifest.json"
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = manifest.get("pets", {}).get("인", {})
    if entry.get("version") == VERSION and entry.get("authorship") == "new-reconstruction" and entry.get("file") == RUNTIME.name:
        entry["sha256"] = recipe["runtime"]["sha256"]
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("TIGER_RECONSTRUCTION", json.dumps({"version": VERSION, "vertices": vertices, "triangles": recipe["geometry"]["bodyTriangles"], "runtimeBytes": RUNTIME.stat().st_size, "runtimeSHA256": recipe["runtime"]["sha256"]}))
