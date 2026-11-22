# hippo から作成した capybara の土台を、カピバラの個別仕様に書き換えたもの。
"""カピバラ: 茶色のたる形の体、四角くて大きな頭と平たい鼻先、頭の上の小さな目と耳、短い脚、しっぽはない。

いつも落ち着いた顔（目は少し細め）。鼻先の大きな黒い鼻が目印。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'capybara'
FUR = '#B5814F'
PALETTE = {'body': FUR, 'belly': '#C49364', 'leg': '#A87445', 'head': '#BA8655', 'muzzle': '#A9774A', 'ear': '#9C6A3F',
           'tail': FUR}
BLUSH = '#EFA0A8'

LEG_X = 0.17
FRONT_Y = -0.28
HIND_Y = 0.3
JOINTS = {
    'front': {'top': (FRONT_Y, 0.4), 'mid': (FRONT_Y + 0.07, 0.23), 'low': (FRONT_Y, 0.07), 'toe': (FRONT_Y - 0.1, 0.02)},
    'hind': {'top': (HIND_Y, 0.4), 'mid': (HIND_Y - 0.08, 0.23), 'low': (HIND_Y + 0.02, 0.07), 'toe': (HIND_Y - 0.1, 0.02)},
}
HEAD_CENTER = (0, -0.55, 0.62)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.02, 0.46), (0.27, 0.45, 0.28))
    b.ellipsoid('rump', 'body', (0, 0.26, 0.47), (0.26, 0.24, 0.27), blend=0.12)
    b.ellipsoid('belly', 'belly', (0, -0.02, 0.3), (0.19, 0.32, 0.12), blend=0.1)
    b.ellipsoid('neck', 'body', (0, -0.36, 0.55), (0.2, 0.18, 0.2), blend=0.12)
    # 四角い頭: 横長の楕円を2つ重ね、鼻先を平たくする
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.17, 0.2, 0.16), blend=0.1)
    b.ellipsoid('snout', 'muzzle', (0, -0.74, 0.58), (0.15, 0.13, 0.13), blend=0.08)
    for s in (1, -1):
        b.ellipsoid(f'brow{s}', 'head', (0.1 * s, -0.6, 0.74), (0.06, 0.06, 0.04), blend=0.05)
        b.ellipsoid(f'ear{s}', 'ear', (0.13 * s, -0.46, 0.78), (0.04, 0.03, 0.04), blend=0.02)
        x = LEG_X * s
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            b.cone(f'{key}leg{s}', 'leg', (x, y, 0.38), (x, y, 0.06), 0.085, 0.07, blend=0.08)
            b.ellipsoid(f'{key}foot{s}', 'leg', (x, y - 0.04, 0.04), (0.07, 0.1, 0.04), blend=0.03)
    return b


EYES: dict = {}


def build(target_tris: int = 3400, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('capybara_body', b, (-0.4, -0.95, 0.0), (0.4, 0.6, 0.9), 0.012, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, (0, -0.58, 0.68), lambda s: (0.5 * s, -0.55, 0.6), (0.026, 0.024, 0.014))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.8, 0.62), (0, -1, 0.15), (0.075, 0.05, 0.02), '#4B3426', sink=0.4,
                   segments=12, rings=5)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.68, 0.58), (0.85 * s, -0.4, -0.2), (0.04, 0.03, 0.012), BLUSH, sink=0.5,
                        segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        nostril = M.decal(f'nostril{s}', b, (0.05 * s, -0.84, 0.63), (0.2 * s, -1, 0.1), (0.016, 0.012, 0.008),
                          '#2A1D15', sink=0.2, segments=6, rings=3)
        roles['rigid'].append((nostril, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.3, 0.46), (0, 0.04, 0.47), 'root'),
        BoneSpec('spine_1', (0, 0.04, 0.47), (0, -0.16, 0.49), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.16, 0.49), (0, -0.34, 0.54), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.34, 0.54), (0, -0.46, 0.6), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.46, 0.6), (0, -0.86, 0.6), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.6, 0.52), (0, -0.82, 0.5), 'head'),
        BoneSpec('ear_l', (0.12, -0.46, 0.75), (0.15, -0.46, 0.82), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.46, 0.5), (0, 0.52, 0.46), 'hips'),
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
