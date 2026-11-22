# panda から作成した polar_bear の土台を、シロクマの個別仕様に書き換えたもの。
"""シロクマ（ホッキョクグマ）: クリーム色がかった白い大きな体、長めの首と鼻先、小さなまるい耳、黒い鼻、大きな足。

パンダより首と頭が前へ長く、肩が高い。前足の掌に、水をはね上げる効果の出どころにする骨 hold_r を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'polar_bear'
FUR = '#F4F0E2'
PALETTE = {'body': FUR, 'head': '#F7F4EA', 'muzzle': '#FBF9F2', 'leg': FUR, 'paw': '#EEE8D6', 'ear': FUR,
           'tail': FUR}
BLACK = '#26262E'
BLUSH = '#F6B3C2'

LEG_X = 0.22
FRONT_Y = -0.34
HIND_Y = 0.36
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 0.66), 'mid': (FRONT_Y + 0.1, 0.35), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.14, 0.03)},
    'hind': {'top': (HIND_Y, 0.62), 'mid': (HIND_Y - 0.1, 0.34), 'low': (HIND_Y + 0.03, 0.1), 'toe': (HIND_Y - 0.13, 0.03)},
}
HEAD_CENTER = (0, -0.78, 0.98)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.02, 0.66), (0.33, 0.55, 0.33))
    b.ellipsoid('shoulders', 'body', (0, -0.28, 0.74), (0.32, 0.3, 0.33), blend=0.15)
    b.ellipsoid('rump', 'body', (0, 0.32, 0.64), (0.31, 0.3, 0.32), blend=0.15)
    b.ellipsoid('neck', 'body', (0, -0.55, 0.86), (0.22, 0.24, 0.22), blend=0.15)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.24, 0.24, 0.22), blend=0.1)
    b.ellipsoid('muzzle', 'muzzle', (0, -1.0, 0.92), (0.12, 0.14, 0.1), blend=0.07)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.15 * s, -0.72, 1.16), (0.06, 0.04, 0.055), rot_deg=(0, 0, 15 * s), blend=0.03)
        x = LEG_X * s
        b.ellipsoid(f'shoulder{s}', 'leg', (x, FRONT_Y + 0.02, 0.56), (0.15, 0.18, 0.21), blend=0.08)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y + 0.02, 0.6), (x, FRONT_Y + 0.07, 0.32), 0.13, 0.115, blend=0.06)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y + 0.07, 0.32), (x, FRONT_Y, 0.1), 0.115, 0.11, blend=0.04)
        b.ellipsoid(f'fpaw{s}', 'paw', (x, FRONT_Y - 0.05, 0.07), (0.13, 0.16, 0.075), blend=0.04)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.52), (0.15, 0.21, 0.22), blend=0.08)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.5), (x, HIND_Y - 0.05, 0.28), 0.13, 0.115, blend=0.06)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y - 0.05, 0.28), (x, HIND_Y + 0.02, 0.1), 0.115, 0.11, blend=0.04)
        b.ellipsoid(f'hpaw{s}', 'paw', (x, HIND_Y - 0.05, 0.07), (0.12, 0.16, 0.075), blend=0.04)
    b.ellipsoid('tail', 'tail', (0, 0.6, 0.66), (0.06, 0.06, 0.06), blend=0.04)
    return b


EYES: dict = {}


def build(target_tris: int = 3800, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('polar_bear_body', b, (-0.55, -1.2, 0.0), (0.55, 0.8, 1.3), 0.014, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.45 * s, -0.8, 0.35), (0.036, 0.045, 0.02))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -1.06, 0.95), (0, -0.85, 0.55), (0.055, 0.04, 0.03), BLACK, sink=0.4,
                   up=(0, -0.5, 0.8))
    roles['rigid'].append((nose, 'head'))
    mouth = M.decal('mouth', b, (0, -1.04, 0.88), (0, -1, -0.25), (0.035, 0.008, 0.01), '#8B7F78', sink=0.4,
                    segments=8, rings=4)
    roles['rigid'].append((mouth, 'head'))
    for s in (1, -1):
        inner = M.decal(f'ear_inner{s}', b, (0.15 * s, -0.72, 1.16), (0.1 * s, -1, 0.1), (0.035, 0.035, 0.012),
                        '#D9CFC0', sink=0.35, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.62 * s, -0.7, -0.2), (0.05, 0.036, 0.014), BLUSH, sink=0.5,
                        segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
        for key, y in (('f', FRONT_Y - 0.05), ('h', HIND_Y - 0.05)):
            for dx in (-0.06, 0.0, 0.06):
                claw = M.decal(f'claw{key}{s}{dx}', b, (LEG_X * s + dx, y, 0.06), (0, -1, -0.1),
                               (0.022, 0.02, 0.012), '#5A5560', sink=0.4, segments=6, rings=3)
                roles['decal'].append(claw)
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.36, 0.64), (0, 0.05, 0.67), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.67), (0, -0.2, 0.72), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 0.72), (0, -0.45, 0.8), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.45, 0.8), (0, -0.66, 0.92), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.66, 0.92), (0, -1.08, 0.92), 'neck', connect=True),
        BoneSpec('ear_l', (0.13, -0.72, 1.1), (0.17, -0.72, 1.22), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.55, 0.66), (0, 0.66, 0.64), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, FRONT_Y - 0.08, 0.07), (x, FRONT_Y - 0.15, 0.07), 'front_leg_foot_l', deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
