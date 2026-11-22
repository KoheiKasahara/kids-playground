# monkey から作成した gorilla の土台を、ゴリラの個別仕様に書き換えたもの。
"""ゴリラ: 黒っぽい大きな体、広い肩と胸、太く長い腕（こぶしをついて歩く）、短い脚、
頭のてっぺんの盛り上がり、灰色の顔と出っぱった眉、銀色の背中（シルバーバック）。

銀色の背中と顔は、体を少しふくらませた殻を楕円で切り出した別の形にする。
右手の掌に、食べ物を持つ骨 hold_r（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'gorilla'
FUR = '#45414B'
PALETTE = {'body': FUR, 'head': FUR, 'arm': FUR, 'leg': FUR, 'hand': '#2F2C33', 'chest': '#57525C',
           'silver': '#A6A4AD', 'face': '#6B6472', 'ear': '#5F5866'}
BLUSH = '#E58A98'

LEG_X = 0.27
FRONT_Y = -0.24
HIND_Y = 0.22
JOINTS = {
    'front': {'top': (FRONT_Y, 0.86), 'mid': (FRONT_Y + 0.08, 0.48), 'low': (FRONT_Y, 0.1),
              'toe': (FRONT_Y - 0.07, 0.03)},
    'hind': {'top': (HIND_Y, 0.6), 'mid': (HIND_Y - 0.12, 0.35), 'low': (HIND_Y + 0.02, 0.08),
             'toe': (HIND_Y - 0.12, 0.025)},
}
HEAD = ((0, -0.44, 1.04), (0.18, 0.17, 0.18))
TORSO = [((0, 0.04, 0.72), (0.3, 0.32, 0.29)), ((0, -0.2, 0.84), (0.34, 0.24, 0.3))]


def body() -> Body:
    b = Body(floor=0.0)
    (c0, r0), (c1, r1) = TORSO
    b.ellipsoid('torso', 'body', c0, r0)
    b.ellipsoid('shoulders', 'body', c1, r1, blend=0.12)
    b.ellipsoid('chest', 'chest', (0, -0.38, 0.76), (0.22, 0.1, 0.18), blend=0.08)
    b.ellipsoid('cranium', 'head', *HEAD, blend=0.08)
    b.ellipsoid('crest', 'head', (0, -0.4, 1.18), (0.1, 0.13, 0.09), blend=0.06)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.18 * s, -0.43, 1.06), (0.03, 0.035, 0.04), blend=0.02)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.cone(f'arm_u{s}', 'arm', (x, f['top'][0] + 0.02, 0.86), (x + 0.02 * s, *f['mid']), 0.12, 0.1, blend=0.08)
        b.cone(f'arm_l{s}', 'arm', (x + 0.02 * s, *f['mid']), (x, *f['low']), 0.1, 0.085, blend=0.05)
        b.ellipsoid(f'fist{s}', 'hand', (x, f['low'][0] - 0.03, 0.06), (0.085, 0.08, 0.065), blend=0.04)
        b.ellipsoid(f'thigh{s}', 'leg', (0.2 * s, HIND_Y, 0.55), (0.13, 0.15, 0.15), blend=0.08)
        b.cone(f'shin{s}', 'leg', (x, h['mid'][0], 0.35), (x, h['low'][0], 0.08), 0.09, 0.075, blend=0.04)
        b.ellipsoid(f'foot{s}', 'hand', (x, h['low'][0] - 0.07, 0.035), (0.07, 0.12, 0.04), blend=0.03)
    return b


def face() -> Body:
    """灰色の顔（出っぱった眉と鼻先）を、頭の前側に重ねる。"""
    f = Body()
    c, r = HEAD
    f.ellipsoid('face_shell', 'face', c, tuple(v + 0.01 for v in r))
    f.ellipsoid('brow', 'face', (0, -0.58, 1.1), (0.14, 0.05, 0.04), blend=0.03)
    f.ellipsoid('muzzle', 'face', (0, -0.58, 0.97), (0.11, 0.07, 0.08), blend=0.04)
    f.ellipsoid('cut', 'face', (0, -0.6, 1.02), (0.15, 0.17, 0.14), intersect=True, blend=0.02)
    return f


def silver() -> Body:
    """銀色の背中: 胴を 1.2cm ふくらませた殻の、背中側だけを切り出す。"""
    k = Body()
    for i, (c, r) in enumerate(TORSO):
        k.ellipsoid(f'shell{i}', 'silver', c, tuple(v + 0.012 for v in r), blend=0.12)
    k.ellipsoid('cut', 'silver', (0, 0.14, 0.98), (0.4, 0.26, 0.26), intersect=True, blend=0.04)
    return k


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('gorilla_body', b, (-0.55, -0.75, 0.0), (0.55, 0.55, 1.35), 0.014, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    fb = face()
    face_obj = M.body_object('gorilla_face', fb, (-0.25, -0.8, 0.8), (0.25, -0.35, 1.25), 0.01, target_tris=900)
    M.paint(face_obj, fb, PALETTE)
    sb = silver()
    silver_obj = M.body_object('gorilla_silver', sb, (-0.5, -0.4, 0.6), (0.5, 0.5, 1.2), 0.014, target_tris=900)
    M.paint(silver_obj, sb, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    roles['decal'].append(silver_obj)
    roles['rigid'].append((face_obj, 'head'))
    eyes = C.add_eyes(roles, fb, (0, -0.5, 1.04), lambda s: (0.4 * s, -0.9, 0.1), (0.032, 0.036, 0.016))
    EYES.update(eyes)
    for s in (1, -1):
        nostril = M.decal(f'nostril{s}', fb, (0, -0.56, 0.98), (0.25 * s, -1, 0.1), (0.022, 0.016, 0.01),
                          '#2B2830', sink=0.4, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
        blush = M.decal(f'blush{s}', fb, (0, -0.52, 1.0), (0.75 * s, -0.6, -0.2), (0.03, 0.022, 0.01), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.22, 0.64), (0, 0.02, 0.74), 'root'),
        BoneSpec('spine_1', (0, 0.02, 0.74), (0, -0.14, 0.82), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.14, 0.82), (0, -0.3, 0.9), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.3, 0.9), (0, -0.38, 0.98), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.38, 0.98), (0, -0.66, 1.0), 'neck', connect=True),
        BoneSpec('ear_l', (0.16, -0.43, 1.02), (0.2, -0.43, 1.1), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.3, 0.66), (0, 0.36, 0.62), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x + 0.02, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x + 0.02, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, f['low'][0] - 0.08, 0.06), (x, f['low'][0] - 0.14, 0.06), 'front_leg_foot_l',
                 deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
