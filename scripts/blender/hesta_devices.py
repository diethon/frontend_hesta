"""HESTA device models built in Blender (Python, no .blend needed).

  blender -b -P scripts/blender/hesta_devices.py -- models    -> public/twin-models/*.glb  (contract: docs/TWIN_MODELS.md)
  blender -b -P scripts/blender/hesta_devices.py -- sprites   -> public/device-sprites/*.webp (off -> on frames for device cards)

Blender is Z-up with the front facing -Y; the glTF exporter turns that into Y-up with the front on +Z.
Node and material names below are the twin contract: the app finds `blades`, `flap`, `shutter`, `slat-*`
and recolours `body`, `blade`, `metal`, `dark` from the HESTA palette.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FRAMES = 24
SPRITE_PX = 192


# ---------- scene + materials ----------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def lin(hex_color):
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


MATS = {}
MAT_SPECS = {
    # contract materials (recoloured by the app)
    'body': dict(color='#f2efe8', rough=.32, coat=.35),
    'blade': dict(color='#a8703f', rough=.5),
    'metal': dict(color='#c3cad0', rough=.24, metal=1.),
    'dark': dict(color='#24282d', rough=.36),
    'slat': dict(color='#d5dbe0', rough=.34, metal=.65),
    # extra materials (kept as authored)
    'panel': dict(color='#07090b', rough=.08),
    'glass': dict(color='#ffffff', rough=.03, transmission=1.),
    'brass': dict(color='#c9a66b', rough=.3, metal=1.),
    'filament': dict(color='#f5c46a', rough=.5),
    'led': dict(color='#1b2a30', rough=.25),
    'screen': dict(color='#000000', rough=.12),
}


def mat(name):
    if name in MATS:
        return MATS[name]
    spec = MAT_SPECS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True  # always on in Blender 5, needed before
    except (AttributeError, TypeError):
        pass
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*lin(spec['color']), 1)
    p.inputs['Roughness'].default_value = spec.get('rough', .4)
    p.inputs['Metallic'].default_value = spec.get('metal', 0.)
    if 'coat' in spec:
        p.inputs['Coat Weight'].default_value = spec['coat']
    if 'transmission' in spec:
        p.inputs['Transmission Weight'].default_value = spec['transmission']
        p.inputs['IOR'].default_value = 1.45
    m.diffuse_color = (*lin(spec['color']), 1)
    MATS[name] = m
    return m


def emit(name, color, strength):
    p = next(n for n in mat(name).node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = strength


# ---------- geometry helpers ----------

def link(ob, parent, loc):
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    return ob


def empty(name, parent=None, loc=(0, 0, 0)):
    return link(bpy.data.objects.new(name, None), parent, loc)


def mesh_obj(name, bm, material, parent, loc, M=None, bevel=0., seg=3, smooth=True):
    if M is not None:
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(38))
    me.materials.append(mat(material))
    ob = link(bpy.data.objects.new(name, me), parent, loc)
    if bevel:
        b = ob.modifiers.new('bevel', 'BEVEL')
        b.width, b.segments, b.limit_method, b.angle_limit = bevel, seg, 'ANGLE', math.radians(38)
    return ob


def box(name, size, material, parent=None, loc=(0, 0, 0), r=0., seg=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    return mesh_obj(name, bm, material, parent, loc, bevel=r, seg=seg, smooth=r > 0)


def axis_matrix(axis):
    if axis == 'Y':  # local +Z becomes -Y (front)
        return Matrix.Rotation(math.pi / 2, 4, 'X')
    if axis == 'X':
        return Matrix.Rotation(math.pi / 2, 4, 'Y')
    return Matrix.Identity(4)


def cyl(name, r1, r2, depth, material, parent=None, loc=(0, 0, 0), axis='Z', seg=40, bevel=.0015):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    return mesh_obj(name, bm, material, parent, loc, M=axis_matrix(axis), bevel=bevel, seg=2)


def lathe(name, profile, material, parent=None, loc=(0, 0, 0), axis='Z', seg=56, smooth_all=False):
    """profile: (radius, height) points; radius 0 closes the pole."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-7:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z))
                          for a in (i * 2 * math.pi / seg for i in range(seg))])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1 and len(b) > 1:
                bm.faces.new((a[0], b[i], b[j]))
            elif len(b) == 1 and len(a) > 1:
                bm.faces.new((a[i], b[0], a[j]))
            elif len(a) > 1:
                bm.faces.new((a[i], b[i], b[j], a[j]))
    ob = mesh_obj(name, bm, material, parent, loc, M=axis_matrix(axis))
    if smooth_all:
        ob.data.shade_smooth()
    return ob


def slab(name, outline, thickness, material, parent=None, loc=(0, 0, 0), M=None, bevel=0., seg=3):
    """Extrudes a 2D outline (u, v) by `thickness` along local Z, then applies M."""
    bm = bmesh.new()
    top = [bm.verts.new((u, v, thickness / 2)) for u, v in outline]
    bot = [bm.verts.new((u, v, -thickness / 2)) for u, v in outline]
    bm.faces.new(top)
    bm.faces.new(bot[::-1])
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((top[i], bot[i], bot[j], top[j]))
    return mesh_obj(name, bm, material, parent, loc, M=M, bevel=bevel, seg=seg)


def torus(name, R, r, material, parent=None, loc=(0, 0, 0), axis='Z', seg=72, rseg=10):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = i * 2 * math.pi / seg
        rings.append([bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
                      for b in (k * 2 * math.pi / rseg for k in range(rseg))])
    for i in range(seg):
        for k in range(rseg):
            a, b = rings[i], rings[(i + 1) % seg]
            bm.faces.new((a[k], b[k], b[(k + 1) % rseg], a[(k + 1) % rseg]))
    return mesh_obj(name, bm, material, parent, loc, M=axis_matrix(axis), smooth=True)


def tube(name, points, radius, material, parent=None, loc=(0, 0, 0), rseg=8):
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
        n = t.cross(ref).normalized()
        b = t.cross(n)
        rings.append([bm.verts.new(p + radius * (math.cos(a) * n + math.sin(a) * b))
                      for a in (k * 2 * math.pi / rseg for k in range(rseg))])
    for a, b in zip(rings, rings[1:]):
        for k in range(rseg):
            bm.faces.new((a[k], b[k], b[(k + 1) % rseg], a[(k + 1) % rseg]))
    return mesh_obj(name, bm, material, parent, loc)


def bezier(p0, p1, p2, p3=None, n=10):
    out = []
    for i in range(1, n + 1):
        t = i / n
        if p3 is None:
            out.append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2)))
        else:
            out.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d
                             for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


# (u, v, w) -> (x=w, y=u, z=v): side profiles drawn in the Y/Z plane, extruded along X.
SIDE = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


# ---------- twin models ----------

def ceiling_fan():
    root = empty('ceiling-fan')  # origin = ceiling mount, hangs along -Z
    lathe('canopy', [(0, 0), (.09, 0), (.09, -.008), (.083, -.03), (.062, -.058), (.032, -.074), (0, -.078)], 'body', root)
    cyl('downrod', .013, .013, .19, 'metal', root, (0, 0, -.165))
    cyl('coupler', .024, .024, .03, 'metal', root, (0, 0, -.245))
    blades = empty('blades', root, (0, 0, -.3))  # rotated around Z (glTF Y) by the app
    lathe('motor', [(0, .062), (.04, .062), (.062, .056), (.1, .045), (.128, .026), (.138, .008), (.138, -.008),
                    (.128, -.026), (.1, -.045), (.062, -.058), (0, -.062)], 'body', blades)
    torus('trim', .139, .0055, 'metal', blades)
    lathe('switch-cup', [(0, -.055), (.052, -.055), (.048, -.08), (.03, -.098), (0, -.102)], 'metal', blades)
    paddle = [(0, -.03), (.42, -.074)] + bezier((.42, -.074), (.56, -.07), (.56, 0)) + bezier((.56, 0), (.56, .07), (.42, .074)) + [(0, .03)]
    bracket = [(0, -.016), (.06, -.022), (.13, -.03), (.13, .03), (.06, .022), (0, .016)]
    for i in range(5):
        a = i * 2 * math.pi / 5
        slab(f'blade-{i}', paddle, .008, 'blade', blades, M=Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((.2, 0, -.02)) @ Matrix.Rotation(.12, 4, 'X'), bevel=.0028)
        slab(f'bracket-{i}', bracket, .009, 'metal', blades, M=Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((.1, 0, -.012)), bevel=.003)


def fan_head(parent):
    head = empty('head', parent, (0, 0, 1.25))
    lathe('motor', [(0, -.17), (.04, -.168), (.068, -.156), (.087, -.122), (.092, -.07), (.088, -.024), (.072, .006), (.042, .022), (0, .026)], 'body', head, axis='Y')
    for k, y in enumerate((.1, .12, .14)):
        torus(f'vent-{k}', .085 - (y - .1) * .5, .0035, 'dark', head, (0, y, 0), axis='Y', seg=48, rseg=6)
    cyl('tilt-joint', .03, .03, .075, 'body', head, (0, .07, -.085), axis='X')
    blades = empty('blades', head, (0, -.075, 0))  # rotated around -Y (glTF Z) by the app
    lathe('hub', [(0, -.03), (.052, -.03), (.054, -.005), (.042, .022), (0, .034)], 'body', blades, axis='Y')
    blade = [(.04, -.03)] + bezier((.04, -.03), (.14, -.11), (.3, -.1), (.3, 0), 12) + bezier((.3, 0), (.3, .085), (.14, .1), (.04, .03), 12)
    for i in range(3):
        slab(f'blade-{i}', blade, .005, 'blade', blades, M=Matrix.Rotation(i * 2 * math.pi / 3, 4, 'Y') @ Matrix.Rotation(math.pi / 2 + .32, 4, 'X'), bevel=.002, seg=2)
    guard = empty('guard', head, (0, -.075, 0))
    torus('rim', .345, .008, 'body', guard, axis='Y')
    for side, depth in ((-1, .095), (1, .085)):  # front cage bulges forward, back cage back
        y = lambda r: side * depth * (1 - (r / .345) ** 2)  # noqa: E731
        for i in range(28):
            a = i * 2 * math.pi / 28
            pts = [(math.cos(a) * r, y(r), math.sin(a) * r) for r in np.linspace(.075, .345, 12)]
            tube(f'spoke-{side}-{i}', pts, .0021, 'metal', guard, rseg=6)
        for r in ((.075, .17, .26) if side < 0 else (.13, .25)):
            torus(f'ring-{side}-{r}', r, .0022, 'metal', guard, (0, y(r), 0), axis='Y', seg=64, rseg=6)
    cyl('badge', .072, .072, .012, 'body', guard, (0, -.097, 0), axis='Y', seg=48)
    torus('badge-trim', .072, .003, 'metal', guard, (0, -.103, 0), axis='Y', seg=48, rseg=6)
    return head


def standing_fan(head_only=False):
    root = empty('standing-fan')  # origin = floor centre, front -Y
    if not head_only:
        lathe('base', [(0, 0), (.25, 0), (.262, .006), (.264, .017), (.254, .03), (.22, .046), (.12, .062), (.06, .07), (.05, .075), (0, .075)], 'body', root)
        for i in range(3):
            cyl(f'button-{i}', .013, .011, .014, 'dark', root, (-.045 + i * .045, -.165, .056), seg=24)
        cyl('pole-lower', .03, .026, .63, 'body', root, (0, 0, .39))
        cyl('collar', .034, .034, .03, 'metal', root, (0, 0, .71))
        cyl('pole', .018, .018, .47, 'metal', root, (0, 0, .945))
    return fan_head(root)


AC_PROFILE = ([(.14, .2), (-.07, .2)] + bezier((-.07, .2), (-.17, .18), (-.17, .06)) + [(-.17, -.08)]
              + bezier((-.17, -.08), (-.16, -.16), (-.11, -.18)) + [(.14, -.2)])


def air_conditioner():
    root = empty('ac')  # origin = unit centre, back on the wall (+Y)
    slab('casing', AC_PROFILE, 1.12, 'body', root, M=SIDE, bevel=.018, seg=4)
    for i in range(44):
        box(f'intake-{i}', (.012, .1, .006), 'dark', root, (-.516 + i * .024, .04, .2), r=.002, seg=1)
    box('seam', (1.1, .004, .003), 'dark', root, (0, -.163, .1))
    box('display', (.11, .004, .028), 'dark', root, (.36, -.171, -.01), r=.0015, seg=2)
    box('outlet', (1.04, .11, .03), 'dark', root, (0, -.06, -.188))
    for i in range(14):
        box(f'vane-{i}', (.004, .09, .028), 'dark', root, (-.48 + i * .074, -.06, -.19))
    flap = empty('flap', root, (0, -.125, -.182))  # hinge at the front edge, rotated around X by the app
    louvre = [(0, -.006)] + bezier((0, -.006), (.06, -.014), (.115, -.004)) + bezier((.115, .006), (.06, -.002), (0, .006))
    slab('louvre', louvre, 1.06, 'body', flap, M=SIDE, bevel=.003, seg=2)
    return root


def tv():
    root = empty('tv')  # origin = screen centre, wall on +Y; the app draws the lit screen at glTF z = .022
    box('frame', (1.25, .04, .74), 'dark', root, (0, 0, 0), r=.007, seg=3)
    box('panel', (1.214, .002, .704), 'panel', root, (0, -.0202, .002))
    box('back', (.9, .04, .5), 'dark', root, (0, .04, -.03), r=.014, seg=4)
    box('mount', (.32, .02, .22), 'metal', root, (0, .068, -.02), r=.004, seg=2)
    box('logo', (.05, .003, .007), 'metal', root, (0, -.0205, -.357), r=.001, seg=1)
    return root


def roller_door():
    root = empty('roller-door')  # 1 x 1 m unit (x -.5..5, z 0..1), front -Y; the app scales it to the opening
    shutter = empty('shutter', root)
    profile = ([(.008, 0), (-.008, 0), (-.008, .012)] + bezier((-.008, .012), (-.016, .025), (-.008, .038))
               + [(-.008, .05), (.008, .05), (.008, .038)] + bezier((.008, .038), (0, .025), (.008, .012)))
    for i in range(20):
        slab(f'slat-{i}', profile, .98, 'slat', shutter, (0, 0, i * .05), M=SIDE)
    box('bottom-bar', (.98, .03, .02), 'metal', shutter, (0, 0, .01), r=.003, seg=2)
    box('housing', (1.04, .2, .12), 'body', root, (0, .03, 1.06), r=.012, seg=3)
    for k, x in enumerate((-.5, .5)):
        box(f'rail-{k}', (.03, .05, 1), 'metal', root, (x, 0, .5), r=.003, seg=2)
    return root


def export(name):
    path = os.path.join(ROOT, 'public', 'twin-models', f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_cameras=False, export_lights=False)
    print(f'wrote {path} ({os.path.getsize(path)} bytes)')


def build_models():
    for name, build in (('ceiling-fan', ceiling_fan), ('standing-fan', standing_fan), ('ac', air_conditioner),
                        ('tv', tv), ('roller-door', roller_door)):
        reset()
        build()
        export(name)


# ---------- card sprites (off -> on) ----------

def smooth(t):
    t = max(0., min(1., t))
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def light_bulb():
    root = empty('bulb')
    thread = [(0, -.006), (.006, -.006), (.008, -.002), (.0105, 0)]
    for k in range(9):
        thread += [(.0122, .002 + k * .003), (.0134, .0035 + k * .003)]
    thread += [(.013, .03), (0, .03)]
    lathe('base', thread, 'brass', root)
    lathe('insulator', [(0, -.009), (.0045, -.009), (.0065, -.005), (0, -.005)], 'dark', root)
    lathe('neck', [(0, .03), (.0135, .03), (.0145, .036), (.012, .04), (0, .04)], 'body', root)
    outline = [(.0128, .037)] + bezier((.0128, .037), (.018, .05), (.032, .068), (.032, .09), 10) + bezier((.032, .09), (.032, .112), (.018, .125), (0, .125), 10)
    glass = lathe('glass', outline, 'glass', root, seg=64, smooth_all=True)
    s = glass.modifiers.new('shell', 'SOLIDIFY')
    s.thickness = .0007
    tube('stem', [(0, 0, .036), (0, 0, .05), (0, 0, .062)], .0022, 'glass', root)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        pts = [(math.cos(a) * r, math.sin(a) * r, z) for r, z in ((.002, .062), (.006, .074), (.0105, .088), (.0125, .1))]
        tube(f'filament-{i}', pts, .0009, 'filament', root, rseg=6)
    lamp = bpy.data.lights.new('glow', 'POINT')
    lamp.shadow_soft_size = .006
    glow = link(bpy.data.objects.new('glow', lamp), root, (0, 0, .085))

    def update(k):
        p = smooth(k / (FRAMES - 1)) ** 1.4
        color = mix((1, .32, .06), (1, .74, .44), smooth(k / (FRAMES - 1)))
        emit('filament', color, 90 * p)
        emit('glass', color, .35 * p)
        lamp.energy, lamp.color = 2.5 * p, color
    return [root], update, None


def fan_sprite():
    head = standing_fan(head_only=True)
    blades = head.children[next(i for i, c in enumerate(head.children) if c.name == 'blades')]
    omega, angle, transition = math.radians(15), 0., 16
    for k in range(FRAMES):  # spin up over 16 frames, then 8 seamless frames = 120 deg (3-blade symmetry)
        blades.rotation_euler.y = angle
        blades.keyframe_insert('rotation_euler', index=1, frame=k + 1)
        angle += omega * min(1., (k + 1) / transition) ** 2
    for fc in iter_fcurves(blades):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    bpy.context.scene.render.use_motion_blur = True
    bpy.context.scene.render.motion_blur_shutter = .6
    return [head], (lambda k: None), None


def iter_fcurves(ob):
    action = ob.animation_data.action
    if hasattr(action, 'fcurves'):
        return list(action.fcurves)
    # Blender 5 layered actions
    return [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]


def ac_sprite():
    root = air_conditioner()
    flap = next(c for c in root.children if c.name == 'flap')
    disp = next(c for c in root.children if c.name == 'display')
    disp.data.materials[0] = mat('led')
    dot = cyl('led-dot', .003, .003, .003, 'led', root, (.43, -.172, -.01), axis='Y', seg=16, bevel=0)
    dot.data.materials[0] = mat('led')

    def update(k):
        p = smooth(k / (FRAMES - 1))
        flap.rotation_euler.x = -.55 * smooth(k / (FRAMES - 1) * 1.15)
        emit('led', (.25, .85, 1.), 9 * smooth(k / 6))
    return [root], update, 'wall'


def tv_sprite():
    root = tv()
    screen_mat = mat('screen')
    nodes, links = screen_mat.node_tree.nodes, screen_mat.node_tree.links
    p = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    coord, grad, noise, ramp, mixer = (nodes.new(t) for t in ('ShaderNodeTexCoord', 'ShaderNodeTexGradient', 'ShaderNodeTexNoise', 'ShaderNodeValToRGB', 'ShaderNodeMix'))
    grad.gradient_type = 'DIAGONAL'
    noise.inputs['Scale'].default_value = 3.
    links.new(coord.outputs['Generated'], grad.inputs['Vector'])
    links.new(coord.outputs['Generated'], noise.inputs['Vector'])
    mixer.data_type, mixer.inputs['Factor'].default_value = 'FLOAT', .25
    links.new(grad.outputs['Fac'], mixer.inputs['A'])
    links.new(noise.outputs['Fac'], mixer.inputs['B'])
    links.new(mixer.outputs['Result'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].color = (*lin('#0e3b5c'), 1)
    ramp.color_ramp.elements[1].color = (*lin('#ffb86b'), 1)
    mid = ramp.color_ramp.elements.new(.55)
    mid.color = (*lin('#2fb5a3'), 1)
    links.new(ramp.outputs['Color'], p.inputs['Emission Color'])
    screen = box('screen', (1.2, .001, .69), 'screen', root, (0, -.0215, 0))
    led = cyl('standby', .004, .004, .003, 'led', root, (.5, -.021, -.358), axis='Y', seg=16, bevel=0)
    led.data.materials[0] = mat('led')

    def update(k):
        t = k / (FRAMES - 1)
        screen.scale.z = max(.004, smooth(t / .35))
        p.inputs['Emission Strength'].default_value = 1.4 * smooth((t - .05) / .8)
        emit('led', mix((1, .08, .05), (.9, .95, 1), smooth(t * 3)), 6 * (1 - .6 * smooth(t * 3)))
    return [root], update, 'wall'


def plug_sprite():
    root = empty('plug')
    box('body', (.062, .036, .086), 'body', root, (0, 0, 0), r=.014, seg=5)
    cyl('socket', .021, .0205, .004, 'body', root, (0, -.0188, .012), axis='Y', seg=64, bevel=.0012)
    for x in (-.0095, .0095):
        cyl(f'hole-{x}', .0042, .0042, .002, 'dark', root, (x, -.0206, .012), axis='Y', seg=24, bevel=0)
    cyl('button', .0075, .0075, .004, 'body', root, (0, -.0185, -.027), axis='Y', seg=32)
    ring = torus('led-ring', .0085, .0012, 'led', root, (0, -.0185, -.027), axis='Y', seg=48, rseg=6)
    ring.data.materials[0] = mat('led')
    lamp = bpy.data.lights.new('ring-glow', 'POINT')
    lamp.shadow_soft_size, lamp.color = .004, (.3, .9, .75)
    link(bpy.data.objects.new('ring-glow', lamp), root, (0, -.024, -.027))

    def update(k):
        p = smooth(k / (FRAMES - 1) * 1.3)
        emit('led', (.25, .95, .75), 14 * p)
        lamp.energy = .05 * p
    return [root], update, 'wall'


VIEWS = {'ac': (.5, -1, -.08)}  # look up at the AC so the louvre shows
SPRITES = {'light': light_bulb, 'fan': fan_sprite, 'ac': ac_sprite, 'tv': tv_sprite, 'plug': plug_sprite}


def world_bounds(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for root in objects:
        for ob in [root, *root.children_recursive]:
            if ob.type == 'MESH':
                ev = ob.evaluated_get(deps)
                pts += [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def stage(objects, catcher, view=(.62, -1, .42)):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples, scene.cycles.use_denoising = 64, True
    scene.render.resolution_x = scene.render.resolution_y = SPRITE_PX
    scene.render.film_transparent = True
    scene.render.image_settings.file_format, scene.render.image_settings.color_mode = 'PNG', 'RGBA'
    world = bpy.data.worlds.new('studio')
    scene.world = world
    try:
        world.use_nodes = True
    except (AttributeError, TypeError):
        pass
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value, bg.inputs['Strength'].default_value = (.85, .9, .95, 1), .55
    lo, hi = world_bounds(objects)
    center, radius = (lo + hi) / 2, (hi - lo).length / 2
    view = Vector(view).normalized()
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = link(bpy.data.objects.new('cam', cam_data), None, center + view * radius * .98 / math.sin(cam_data.angle / 2))
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    for name, offset, power in (('key', (-1.2, -1.6, 2.2), 26), ('fill', (2., -1.2, .6), 9), ('rim', (.8, 2.2, 1.6), 18)):
        data = bpy.data.lights.new(name, 'AREA')
        data.size = radius * 2.2
        ob = link(bpy.data.objects.new(name, data), None, center + Vector(offset) * radius * 2.4)
        ob.rotation_euler = (center - ob.location).to_track_quat('-Z', 'Y').to_euler()
        data.energy = power * (radius * 2.4 * Vector(offset).length) ** 2
    if catcher == 'wall':
        plane = box('catcher', ((hi.x - lo.x) * 4, .001, (hi.z - lo.z) * 4), 'body', None, (center.x, hi.y + .0005, center.z))
        plane.is_shadow_catcher = True


def compose(kind, files):
    arrs = []
    for f in files:
        img = bpy.data.images.load(f)
        a = np.empty(len(img.pixels), dtype=np.float32)
        img.pixels.foreach_get(a)
        arrs.append(a.reshape(img.size[1], img.size[0], 4))
        bpy.data.images.remove(img)
    sheet = np.concatenate(arrs, axis=1)
    out = bpy.data.images.new(f'{kind}-sheet', sheet.shape[1], sheet.shape[0], alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    path = os.path.join(ROOT, 'public', 'device-sprites', f'{kind}.webp')
    out.filepath_raw, out.file_format = path, 'WEBP'
    out.save()
    print(f'wrote {path} ({os.path.getsize(path)} bytes)')


def build_sprites(only=None):
    tmp = os.path.join(ROOT, 'node_modules', '.cache', 'device-sprites')
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'public', 'device-sprites'), exist_ok=True)
    for kind, build in SPRITES.items():
        if only and kind not in only:
            continue
        reset()
        objects, update, catcher = build()
        stage(objects, catcher, VIEWS.get(kind, (.62, -1, .42)))
        files = []
        for k in range(FRAMES):
            bpy.context.scene.frame_set(k + 1)
            update(k)
            path = os.path.join(tmp, f'{kind}-{k:02d}.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            files.append(path)
        compose(kind, files)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['models']
    if args[0] == 'models':
        build_models()
    else:
        build_sprites(args[1:])
