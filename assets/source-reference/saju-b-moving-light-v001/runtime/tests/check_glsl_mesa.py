#!/usr/bin/env python3
"""Compile and numerically exercise both shader dialects in local Mesa EGL.
Requires Python 3, numpy, libEGL and libGL. No browser/engine integration is tested.
All OpenGL sampling is NEAREST in an R32F atlas; interpolation lives in the module.
"""
import os
os.environ.setdefault("MESA_SHADER_CACHE_DISABLE", "true")
import ctypes as C
import ctypes.util
import json
import math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
E = C.CDLL(ctypes.util.find_library('EGL'))
G = C.CDLL(ctypes.util.find_library('GL'))
U, I, F, P = C.c_uint, C.c_int, C.c_float, C.c_void_p

def function(lib, name, result, *args):
    fn = getattr(lib, name)
    fn.restype, fn.argtypes = result, args
    return fn

def ints(*values):
    return (I * len(values))(*values)

get_display = function(E, 'eglGetPlatformDisplay', P, U, P, C.POINTER(I))
display = get_display(0x31DD, None, None)  # EGL_PLATFORM_SURFACELESS_MESA
major, minor = I(), I()
assert function(E, 'eglInitialize', U, P, C.POINTER(I), C.POINTER(I))(display, C.byref(major), C.byref(minor))
assert function(E, 'eglBindAPI', U, U)(0x30A0)  # EGL_OPENGL_ES_API
config, count = P(), I()
assert function(E, 'eglChooseConfig', U, P, C.POINTER(I), C.POINTER(P), I, C.POINTER(I))(
    display, ints(0x3033, 1, 0x3040, 0x40, 0x3038), C.byref(config), 1, C.byref(count)) and count.value
surface = function(E, 'eglCreatePbufferSurface', P, P, P, C.POINTER(I))(display, config, ints(0x3057, 1, 0x3056, 1, 0x3038))
context = function(E, 'eglCreateContext', P, P, P, P, C.POINTER(I))(display, config, None, ints(0x3098, 3, 0x3038))
assert surface and context
assert function(E, 'eglMakeCurrent', U, P, P, P, P)(display, surface, surface, context)
get_string = function(G, 'glGetString', C.c_char_p, U)
report = {'renderer': get_string(0x1F01).decode(), 'version': get_string(0x1F02).decode(), 'results': []}

create_shader = function(G, 'glCreateShader', U, U)
source_shader = function(G, 'glShaderSource', None, U, I, C.POINTER(C.c_char_p), C.POINTER(I))
compile_shader = function(G, 'glCompileShader', None, U)
get_shader = function(G, 'glGetShaderiv', None, U, U, C.POINTER(I))
shader_log = function(G, 'glGetShaderInfoLog', None, U, I, C.POINTER(I), P)

def shader(kind, text):
    shader_id = create_shader(kind)
    encoded = C.c_char_p(text.encode())
    source_shader(shader_id, 1, C.byref(encoded), None)
    compile_shader(shader_id)
    status = I()
    get_shader(shader_id, 0x8B81, C.byref(status))
    if not status.value:
        buf = C.create_string_buffer(8192)
        shader_log(shader_id, len(buf), None, buf)
        raise AssertionError(buf.value.decode())
    return shader_id

create_program = function(G, 'glCreateProgram', U)
attach_shader = function(G, 'glAttachShader', None, U, U)
link_program = function(G, 'glLinkProgram', None, U)
get_program = function(G, 'glGetProgramiv', None, U, U, C.POINTER(I))
program_log = function(G, 'glGetProgramInfoLog', None, U, I, C.POINTER(I), P)
use_program = function(G, 'glUseProgram', None, U)
get_uniform = function(G, 'glGetUniformLocation', I, U, C.c_char_p)
u1i = function(G, 'glUniform1i', None, I, I)
u1f = function(G, 'glUniform1f', None, I, F)
u3f = function(G, 'glUniform3f', None, I, F, F, F)
gen_textures = function(G, 'glGenTextures', None, I, C.POINTER(U))
bind_texture = function(G, 'glBindTexture', None, U, U)
tex_parameter = function(G, 'glTexParameteri', None, U, U, I)
tex_image = function(G, 'glTexImage2D', None, U, I, I, I, I, I, U, U, P)
active_texture = function(G, 'glActiveTexture', None, U)

atlas = np.empty((1024, 2048), dtype=np.float32)
x = np.arange(128, dtype=np.float32)[None, :] / 127
Y = np.arange(128, dtype=np.float32)[:, None] / 127
for z in range(128):
    atlas[(z // 16) * 128:(z // 16 + 1) * 128, (z % 16) * 128:(z % 16 + 1) * 128] = .1 + .2 * x + .25 * Y + .4 * z / 127

def texture(array, width, height, internal, fmt):
    tex = U()
    gen_textures(1, C.byref(tex))
    bind_texture(0x0DE1, tex.value)
    for parameter, value in [(0x2801, 0x2600), (0x2800, 0x2600), (0x2802, 0x812F), (0x2803, 0x812F)]:
        tex_parameter(0x0DE1, parameter, value)
    tex_image(0x0DE1, 0, internal, width, height, 0, fmt, 0x1406, None if array is None else array.ctypes.data)
    return tex.value

atlas_tex = texture(atlas, 2048, 1024, 0x822E, 0x1903)
flipped_atlas_tex = texture(np.ascontiguousarray(atlas[::-1]), 2048, 1024, 0x822E, 0x1903)
output_tex = texture(None, 1, 1, 0x8814, 0x1908)
fbo = U()
function(G, 'glGenFramebuffers', None, I, C.POINTER(U))(1, C.byref(fbo))
function(G, 'glBindFramebuffer', None, U, U)(0x8D40, fbo.value)
function(G, 'glFramebufferTexture2D', None, U, U, U, U, I)(0x8D40, 0x8CE0, 0x0DE1, output_tex, 0)
assert function(G, 'glCheckFramebufferStatus', U, U)(0x8D40) == 0x8CD5
function(G, 'glViewport', None, I, I, I, I)(0, 0, 1, 1)
vertices = np.array([-1, -1, 3, -1, -1, 3], dtype=np.float32)
vbo = U()
function(G, 'glGenBuffers', None, I, C.POINTER(U))(1, C.byref(vbo))
function(G, 'glBindBuffer', None, U, U)(0x8892, vbo.value)
function(G, 'glBufferData', None, U, C.c_ssize_t, P, U)(0x8892, vertices.nbytes, vertices.ctypes.data, 0x88E4)
vertex_pointer = function(G, 'glVertexAttribPointer', None, U, I, U, U, I, P)
enable_attr = function(G, 'glEnableVertexAttribArray', None, U)
get_attr = function(G, 'glGetAttribLocation', I, U, C.c_char_p)
draw = function(G, 'glDrawArrays', None, U, I, I)
read = function(G, 'glReadPixels', None, I, I, I, I, U, U, P)
module = (ROOT / 'saju-jade-flow.glsl').read_text()

for dialect in ['100', '300 es']:
    modern = dialect != '100'
    head = f'#version {dialect}\nprecision highp float;\n'
    vertex = shader(0x8B31, head + ('in' if modern else 'attribute') + ' vec2 position; void main(){gl_Position=vec4(position,0.,1.);}')
    fragment = shader(0x8B30, head + ('#define SAJU_TEXTURE texture\nout vec4 result;\n' if modern else '') + module + '''
    uniform sampler2D fieldAtlas;
    uniform vec3 sourcePosition;
    uniform float timeSeconds;
    uniform bool flipV;
    uniform int mode;
    void main(){
        SajuJadeFlow flow = sajuEvaluateJadeFlow(fieldAtlas, sourcePosition, timeSeconds, flipV);
        vec4 color = vec4(flow.field, flow.emissionMask, flow.isolationMask, flow.reflectiveFraction);
        if (mode == 1) color = vec4(flow.emissionRadiance, 1.);
        if (mode == 2) color = vec4(sajuV001BodyGLTFLocalToGenerated(sourcePosition), 1.);
        if (mode == 3) color = vec4(sajuLoopOffset(timeSeconds), 1.);
        if (mode == 4) color = vec4(sajuComposeLinear(vec3(.2,.4,.6), flow), 1.);
    ''' + ('result' if modern else 'gl_FragColor') + '= color; }')
    program = create_program()
    attach_shader(program, vertex)
    attach_shader(program, fragment)
    link_program(program)
    status = I()
    get_program(program, 0x8B82, C.byref(status))
    if not status.value:
        buf = C.create_string_buffer(8192)
        program_log(program, len(buf), None, buf)
        raise AssertionError(buf.value.decode())
    use_program(program)
    loc = {name: get_uniform(program, name.encode()) for name in ['fieldAtlas', 'sourcePosition', 'timeSeconds', 'flipV', 'mode']}
    attrib = get_attr(program, b'position')
    enable_attr(attrib)
    vertex_pointer(attrib, 2, 0x1406, 0, 0, None)
    active_texture(0x84C0)
    u1i(loc['fieldAtlas'], 0)
    worst_error = 0
    checks = 0

    def render(p, seconds=0, mode=0, flipped=False):
        bind_texture(0x0DE1, flipped_atlas_tex if flipped else atlas_tex)
        u3f(loc['sourcePosition'], *p)
        u1f(loc['timeSeconds'], seconds)
        u1i(loc['flipV'], int(flipped))
        u1i(loc['mode'], mode)
        draw(4, 0, 3)
        pixel = np.zeros(4, dtype=np.float32)
        read(0, 0, 1, 1, 0x1908, 0x1406, pixel.ctypes.data)
        return pixel

    def check(actual, expected):
        global worst_error, checks
        error = float(np.max(np.abs(np.asarray(actual) - np.asarray(expected))))
        worst_error = max(worst_error, error)
        checks += 1
        assert error < 2e-5, (dialect, actual.tolist(), expected, error)

    for flipped in [False, True]:
        for u in [[0,0,0], [1,1,1], [.38,.21,.67], [.95,.05,15.5/127], [.09,.92,111.5/127], [-1,.5,2]]:
            p = np.array([-.2,-.05,-.3]) + np.array([1.4,1.25,1.4]) * u
            for t in [0, .125, 1.5, 3, 5.99999, 6]:
                tau = 2 * math.pi * (t % 6) / 6
                offset = np.array([.14 * math.sin(tau), .055 * (1-math.cos(tau)), .14*(math.sin(tau+math.pi/3)-math.sin(math.pi/3))])
                coords = np.clip((p + offset - np.array([-.2,-.05,-.3])) / np.array([1.4,1.25,1.4]), 0, 1)
                field = .1 + np.dot(coords, [.2,.25,.4])
                emission = np.clip((field-.5)/.22, 0, 1)
                s = np.clip((field-.38)/.28, 0, 1)
                isolation = s*s*(3-2*s)
                check(render(p,t,flipped=flipped), [field,emission,isolation,1-isolation])
                radiance = np.array([.001,.65,.08])*2*emission
                check(render(p,t,1,flipped), [*radiance,1])
                check(render(p,t,3,flipped), [*offset,1])
                check(render(p,t,4,flipped), [*(np.array([.2,.4,.6])*(1-isolation)+radiance),1])
    check(render([0.000006973743438720703,1.1804927587509155,0.000013902783393859863], mode=2), [.5,.5,.5,1])
    report['results'].append({'dialect': dialect, 'compiled_and_linked': True, 'numerical_checks': checks, 'max_abs_error': worst_error})

get_error = function(G, 'glGetError', U)
assert get_error() == 0
print(json.dumps(report, indent=2))
function(E, 'eglMakeCurrent', U, P, P, P, P)(display, None, None, None)
function(E, 'eglDestroyContext', U, P, P)(display, context)
function(E, 'eglDestroySurface', U, P, P)(display, surface)
function(E, 'eglTerminate', U, P)(display)
