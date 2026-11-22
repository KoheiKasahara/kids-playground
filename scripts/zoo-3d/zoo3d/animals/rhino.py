# hippo から作成した rhino の土台を、サイの個別仕様に書き換えたもの。
"""サイ: 灰色の大きな体と肩の盛り上がり、低く長い頭、鼻の上の大小2本のつの、筒のような耳、柱のような太い脚、
首と肩の皮のしわ、先に房のある細い尾。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'rhino'
GREY = '#A3A09D'
PALETTE = {'body': GREY, 'head': '#A8A5A2', 'muzzle': '#B0ADA9', 'leg': '#9A9794', 'ear': GREY, 'fold': GREY,
           'horn': '#D8CFC0', 'tail': GREY, 'tuft': '#55514E'}
BLUSH = '#EFA5B3'

LEG_X = 0.28
FRONT_Y = -0.46
HIND_Y = 0.5
JOINTS = {
    'front': {'top': (FRONT_Y, 0.75), 'mid': (FRONT_Y + 0.09, 0.42), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.14, 0.03)},
    'hind': {'top': (HIND_Y, 0.75), 'mid': (HIND_Y - 0.09, 0.42), 'low': (HIND_Y, 0.1), 'toe': (HIND_Y - 0.14, 0.03)},
}
HEAD_CENTER = (0, -0.86, 0.72)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.06, 0.78), (0.42, 0.74, 0.42))
    b.ellipsoid('hump', 'body', (0, -0.34, 0.98), (0.34, 0.3, 0.28), blend=0.15)
    b.ellipsoid('neck', 'body', (0, -0.62, 0.8), (0.3, 0.24, 0.3), blend=0.14)
    # 首と肩の皮のしわ（少し濃い色の細い帯）
    for i, y in enumerate((-0.52, -0.66)):
        b.ellipsoid(f'fold{i}', 'fold', (0, y, 0.82), (0.33 - 0.03 * i, 0.04, 0.33 - 0.03 * i), blend=0.05)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.2, 0.3, 0.2), blend=0.1)
    b.ellipsoid('snout', 'muzzle', (0, -1.12, 0.62), (0.17, 0.16, 0.15), blend=0.08)
    b.cone('horn', 'horn', (0, -1.15, 0.72), (0, -1.26, 1.02), 0.085, 0.014, blend=0.04)
    b.cone('horn2', 'horn', (0, -0.98, 0.84), (0, -1.0, 0.96), 0.06, 0.012, blend=0.03)
    for s in (1, -1):
        b.cone(f'ear{s}', 'ear', (0.13 * s, -0.68, 0.9), (0.18 * s, -0.64, 1.06), 0.05, 0.04, blend=0.03)
        x = LEG_X * s
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            b.cone(f'{key}leg{s}', 'leg', (x, y, 0.7), (x, y, 0.08), 0.15, 0.13, blend=0.1)
            b.ellipsoid(f'{key}foot{s}', 'leg', (x, y - 0.02, 0.07), (0.14, 0.15, 0.07), blend=0.04)
    b.chain('tail', 'tail', [(0, 0.8, 0.9), (0, 0.86, 0.66)], [0.03, 0.022], blend=0.04)
    b.ellipsoid('tuft', 'tuft', (0, 0.87, 0.6), (0.035, 0.035, 0.06), blend=0.02)
    return b


EYES: dict = {}


def build(target_tris: int = 4200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('rhino_body', b, (-0.65, -1.45, 0.0), (0.65, 1.0, 1.35), 0.016, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.8 * s, -0.45, 0.3), (0.033, 0.04, 0.018))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -1.0, 0.64), (0.85 * s, -0.35, -0.2), (0.05, 0.035, 0.012), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        nostril = M.decal(f'nostril{s}', b, (0.07 * s, -1.2, 0.64), (0.3 * s, -1, 0.1), (0.025, 0.016, 0.01),
                          '#5D5955', sink=0.4, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.17 * s, -0.65, 1.04), (0.2 * s, -1, 0.3), (0.025, 0.035, 0.01),
                        '#E9B6BE', sink=0.3, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            for dx in (-0.07, 0.0, 0.07):
                nail = M.decal(f'nail{key}{s}{dx}', b, (LEG_X * s + dx, y, 0.06), (0, -1, -0.2), (0.035, 0.03, 0.015),
                               '#D6CEC2', sink=0.4, segments=8, rings=4)
                roles['decal'].append(nail)
    mouth = M.decal('mouth', b, (0, -1.18, 0.55), (0, -1, -0.4), (0.06, 0.012, 0.01), '#6F6A66', sink=0.4,
                    segments=8, rings=4)
    roles['rigid'].append((mouth, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.5, 0.78), (0, 0.08, 0.82), 'root'),
        BoneSpec('spine_1', (0, 0.08, 0.82), (0, -0.25, 0.88), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.25, 0.88), (0, -0.55, 0.84), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.55, 0.84), (0, -0.68, 0.78), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.68, 0.78), (0, -1.25, 0.6), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.9, 0.6), (0, -1.18, 0.52), 'head'),
        BoneSpec('ear_l', (0.13, -0.68, 0.9), (0.18, -0.64, 1.06), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.8, 0.9), (0, 0.86, 0.6), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'jaw', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
