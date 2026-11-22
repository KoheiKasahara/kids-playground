"""カンガルー: 前へ傾いた体、大きな後ろ足と長い足先、太く長い尾、小さな前足、立った大きな耳、おなかの袋。

二足の体型（`bodyplan.Config(plan='biped')`）で、両足をそろえて跳ねる（`biped_hop`）。
前足は歩容に含めない別の骨の並び（arm_l → arm_2_l）。尾は3本の骨で、跳ねるたびに上下へ振る。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'kangaroo'
FUR = '#C98C5A'
CREAM = '#F3DFC3'
PALETTE = {'body': FUR, 'head': FUR, 'ear': FUR, 'leg': FUR, 'arm': FUR, 'tail': FUR, 'belly': CREAM,
           'muzzle': CREAM, 'foot': '#B67A4C', 'paw': '#8E5E3C'}
BLUSH = '#F2A2B0'

LEG_X = 0.1
HEAD_CENTER = (0, -0.11, 0.95)
TAIL = [(0, 0.18, 0.36), (0, 0.38, 0.2), (0, 0.56, 0.09), (0, 0.72, 0.05)]


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('hips', 'body', (0, 0.06, 0.42), (0.17, 0.19, 0.2))
    b.ellipsoid('belly', 'belly', (0, -0.08, 0.5), (0.12, 0.1, 0.17), blend=0.08)
    b.ellipsoid('chest', 'body', (0, -0.04, 0.66), (0.12, 0.12, 0.16), rot_deg=(-15, 0, 0), blend=0.1)
    b.ellipsoid('neck', 'body', (0, -0.07, 0.8), (0.08, 0.08, 0.09), blend=0.08)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.135, 0.135, 0.125), blend=0.06)
    b.ellipsoid('snout', 'muzzle', (0, -0.23, 0.9), (0.075, 0.1, 0.07), blend=0.05)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'ear{s}', 'ear', (0.075 * s, -0.07, 1.13), (0.052, 0.024, 0.11), rot_deg=(5, -14 * s, 0),
                    blend=0.03)
        b.ellipsoid(f'thigh{s}', 'leg', (x, 0.04, 0.32), (0.085, 0.15, 0.13), rot_deg=(25, 0, 0), blend=0.07)
        b.cone(f'shin{s}', 'leg', (x, -0.05, 0.22), (x, 0.12, 0.05), 0.05, 0.035, blend=0.04)
        b.ellipsoid(f'foot{s}', 'foot', (x, 0.0, 0.025), (0.04, 0.14, 0.028), blend=0.03)
        b.cone(f'arm{s}', 'arm', (0.08 * s, -0.09, 0.68), (0.1 * s, -0.15, 0.56), 0.035, 0.028, blend=0.04)
        b.cone(f'farm{s}', 'arm', (0.1 * s, -0.15, 0.56), (0.08 * s, -0.2, 0.5), 0.028, 0.024, blend=0.02)
        b.ellipsoid(f'paw{s}', 'paw', (0.08 * s, -0.21, 0.49), (0.026, 0.024, 0.024), blend=0.02)
    b.chain('tail', 'tail', TAIL, [0.075, 0.06, 0.045, 0.032], blend=0.07)
    return b


EYES: dict = {}


def build(target_tris: int = 3800, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('kangaroo_body', b, (-0.3, -0.4, 0.0), (0.3, 0.85, 1.25), 0.01, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.55 * s, -0.75, 0.3), (0.033, 0.042, 0.017))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.29, 0.92), (0, -1, 0.3), (0.025, 0.018, 0.012), '#4A3328', sink=0.4)
    roles['rigid'].append((nose, 'head'))
    pouch = M.decal('pouch', b, (0, -0.06, 0.45), (0, -1, -0.15), (0.075, 0.022, 0.012), '#D9B48C', sink=0.4,
                    segments=12, rings=5)
    roles['decal'].append(pouch)
    for s in (1, -1):
        inner = M.decal(f'ear_inner{s}', b, (0.075 * s, -0.07, 1.13), (0.25 * s, -1, 0.0), (0.03, 0.085, 0.01),
                        '#EDB1B9', sink=0.3, segments=10, rings=5)
        roles['decal'].append(inner)
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.7 * s, -0.6, -0.3), (0.026, 0.02, 0.01), BLUSH, sink=0.5,
                        segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.2, 0)),
        BoneSpec('hips', (0, 0.12, 0.36), (0, 0.02, 0.52), 'root'),
        BoneSpec('spine_1', (0, 0.02, 0.52), (0, -0.03, 0.64), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.03, 0.64), (0, -0.06, 0.76), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.06, 0.76), (0, -0.09, 0.88), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.09, 0.88), (0, -0.32, 0.9), 'neck', connect=True),
        BoneSpec('ear_l', (0.065, -0.07, 1.02), (0.08, -0.07, 1.23), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('arm_l', (0.08, -0.09, 0.68), (0.1, -0.15, 0.56), 'spine_2'),
        BoneSpec('arm_2_l', (0.1, -0.15, 0.56), (0.08, -0.21, 0.49), 'arm_l', connect=True),
        BoneSpec('leg_upper_l', (x, 0.1, 0.38), (x, -0.05, 0.22), 'hips'),
        BoneSpec('leg_lower_l', (x, -0.05, 0.22), (x, 0.12, 0.05), 'leg_upper_l', connect=True),
        BoneSpec('leg_foot_l', (x, 0.12, 0.05), (x, -0.13, 0.015), 'leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2', 'tail_3', 'arm_l',
              'arm_r', 'arm_2_l', 'arm_2_r'] + [f'leg_{q}_{s}' for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
