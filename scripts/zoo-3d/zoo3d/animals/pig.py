# capybara から作成した pig の土台を、ブタの個別仕様に書き換えたもの。
"""ブタ: ピンクのまるいたる形の体、前へつき出た平たい円ばんの鼻（鼻の穴2つ）、前へたれた三角の耳、
くるんと巻いた小さなしっぽ、短い脚と小さなひづめ。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'pig'
SKIN = '#F4B6B8'
PALETTE = {'body': SKIN, 'belly': '#F8C9C8', 'leg': '#EFAAAD', 'head': '#F6BDBE', 'snout': '#EE9EA6', 'ear': '#EFA6AB',
           'hoof': '#8C6460', 'tail': SKIN}
BLUSH = '#F28C9C'

LEG_X = 0.16
FRONT_Y = -0.26
HIND_Y = 0.28
JOINTS = {
    'front': {'top': (FRONT_Y, 0.38), 'mid': (FRONT_Y + 0.06, 0.22), 'low': (FRONT_Y, 0.07), 'toe': (FRONT_Y - 0.09, 0.02)},
    'hind': {'top': (HIND_Y, 0.38), 'mid': (HIND_Y - 0.07, 0.22), 'low': (HIND_Y + 0.02, 0.07), 'toe': (HIND_Y - 0.09, 0.02)},
}
HEAD_CENTER = (0, -0.54, 0.6)
SNOUT_TIP = (0, -0.82, 0.55)


def body() -> Body:
    b = Body(floor=0.0)
    # まるまるとした たる形の胴
    b.ellipsoid('torso', 'body', (0, 0.0, 0.45), (0.29, 0.44, 0.29))
    b.ellipsoid('rump', 'body', (0, 0.25, 0.46), (0.28, 0.24, 0.28), blend=0.12)
    b.ellipsoid('belly', 'belly', (0, -0.02, 0.29), (0.21, 0.32, 0.13), blend=0.1)
    b.ellipsoid('neck', 'body', (0, -0.34, 0.52), (0.23, 0.18, 0.22), blend=0.12)
    # 大きなまるい頭と、前へつき出た平たい円ばんの鼻
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.2, 0.2, 0.19), blend=0.1)
    b.ellipsoid('cheek', 'head', (0, -0.62, 0.53), (0.17, 0.13, 0.12), blend=0.08)
    b.cone('snout', 'snout', (0, -0.68, 0.555), (0, -0.8, 0.55), 0.085, 0.095, blend=0.05)
    b.ellipsoid('disc', 'snout', (0, -0.8, 0.55), (0.1, 0.03, 0.085), blend=0.03)
    for s in (1, -1):
        # 三角の耳を前へたらす
        b.ellipsoid(f'ear{s}', 'ear', (0.13 * s, -0.56, 0.78), (0.085, 0.03, 0.075), rot_deg=(-50, 0, -18 * s),
                    blend=0.03)
        x = LEG_X * s
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            b.cone(f'{key}leg{s}', 'leg', (x, y, 0.36), (x, y, 0.06), 0.08, 0.06, blend=0.08)
            b.ellipsoid(f'{key}foot{s}', 'hoof', (x, y - 0.03, 0.035), (0.06, 0.075, 0.035), blend=0.025)
    # くるんと巻いたしっぽ（小さな輪を3つ重ねる）
    b.chain('tail', 'tail', [(0, 0.5, 0.56), (0.03, 0.55, 0.6), (0.0, 0.57, 0.66), (-0.035, 0.54, 0.63)],
            [0.022, 0.02, 0.018, 0.016], blend=0.02)
    return b


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('pig_body', b, (-0.42, -0.95, 0.0), (0.42, 0.66, 0.92), 0.012, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, (0, -0.6, 0.67), lambda s: (0.55 * s, -0.6, 0.45), (0.03, 0.028, 0.015))
    EYES.update(eyes)
    for s in (1, -1):
        nostril = M.decal(f'nostril{s}', b, (0.038 * s, -0.86, 0.555), (0, -1, 0), (0.017, 0.026, 0.01),
                          '#9C5A62', sink=0.3, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
        blush = M.decal(f'blush{s}', b, (0, -0.62, 0.55), (0.85 * s, -0.45, -0.1), (0.045, 0.034, 0.012), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.13 * s, -0.6, 0.76), (0.2 * s, -0.7, -0.6), (0.05, 0.04, 0.01),
                        '#E68E98', sink=0.4, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.28, 0.45), (0, 0.03, 0.46), 'root'),
        BoneSpec('spine_1', (0, 0.03, 0.46), (0, -0.16, 0.48), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.16, 0.48), (0, -0.33, 0.52), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.33, 0.52), (0, -0.45, 0.58), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.45, 0.58), (0, -0.86, 0.56), 'neck', connect=True),
        BoneSpec('ear_l', (0.11, -0.52, 0.8), (0.15, -0.62, 0.74), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.48, 0.55), (0, 0.57, 0.64), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
