# zebra から作成した camel の土台を、ラクダの個別仕様に書き換えたもの。
"""ラクダ（フタコブラクダ）: 砂色の体に2つのこぶ、前へ下がってから上がる U 字の首、長い顔とたれた唇、長い脚、
ひざのこぶ、平たく広い足、ふさふさの頭の毛。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'camel'
SAND = '#D9AE72'
PALETTE = {'body': SAND, 'hump': '#D6AA6E', 'leg': '#DDB57E', 'neck': SAND, 'head': '#E0B97F', 'muzzle': '#EBCB98',
           'ear': SAND, 'tail': SAND, 'tuft': '#9C6B3C', 'foot': '#B98D5A', 'knee': '#D9B079', 'mane': '#C99A60'}
BLUSH = '#F2A7B4'

LEG_X = 0.18
FRONT_Y = -0.38
HIND_Y = 0.42
JOINTS = {
    'front': {'top': (FRONT_Y, 1.08), 'mid': (FRONT_Y - 0.07, 0.56), 'low': (FRONT_Y, 0.13), 'toe': (FRONT_Y - 0.12, 0.03)},
    'hind': {'top': (HIND_Y, 1.08), 'mid': (HIND_Y + 0.08, 0.54), 'low': (HIND_Y, 0.13), 'toe': (HIND_Y - 0.12, 0.03)},
}
NECK = [(0, -0.5, 1.2), (0, -0.95, 1.12), (0, -1.06, 1.56)]
HEAD_CENTER = (0, -1.16, 1.64)
TAIL = [(0, 0.66, 1.22), (0, 0.72, 0.98), (0, 0.73, 0.8)]


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.0, 1.12), (0.3, 0.6, 0.3))
    b.ellipsoid('chest', 'body', (0, -0.34, 1.12), (0.27, 0.28, 0.3), blend=0.14)
    b.ellipsoid('rump', 'body', (0, 0.38, 1.12), (0.27, 0.28, 0.29), blend=0.14)
    # 2つのこぶ（毛の色を少し濃くする）
    b.ellipsoid('hump_front', 'hump', (0, -0.2, 1.46), (0.18, 0.2, 0.2), blend=0.12)
    b.ellipsoid('hump_back', 'hump', (0, 0.25, 1.44), (0.17, 0.19, 0.19), blend=0.12)
    b.chain('neck', 'neck', NECK, [0.16, 0.13, 0.12], blend=0.13)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.14, 0.17, 0.15), blend=0.08)
    b.ellipsoid('topknot', 'mane', (0, -1.11, 1.79), (0.1, 0.09, 0.06), blend=0.05)
    b.ellipsoid('snout', 'head', (0, -1.36, 1.6), (0.11, 0.16, 0.11), blend=0.08)
    b.ellipsoid('lip', 'muzzle', (0, -1.48, 1.53), (0.1, 0.07, 0.07), blend=0.04)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.12 * s, -1.09, 1.76), (0.035, 0.03, 0.06), rot_deg=(0, 30 * s, 0), blend=0.03)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.ellipsoid(f'arm{s}', 'leg', (x, FRONT_Y + 0.02, 0.96), (0.11, 0.15, 0.2), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 1.06), (x, FRONT_Y - 0.03, 0.56), 0.1, 0.07, blend=0.08)
        b.ellipsoid(f'fknee{s}', 'knee', (x, FRONT_Y - 0.04, 0.56), (0.075, 0.08, 0.08), blend=0.04)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y - 0.03, 0.56), (x, *f['low']), 0.06, 0.055, blend=0.04)
        b.ellipsoid(f'ffoot{s}', 'foot', (x, FRONT_Y - 0.04, 0.05), (0.09, 0.12, 0.05), blend=0.03)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.96), (0.12, 0.19, 0.22), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 1.06), (x, HIND_Y + 0.05, 0.54), 0.1, 0.07, blend=0.08)
        b.ellipsoid(f'hock{s}', 'knee', (x, HIND_Y + 0.05, 0.54), (0.065, 0.075, 0.075), blend=0.04)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y + 0.05, 0.54), (x, *h['low']), 0.058, 0.055, blend=0.04)
        b.ellipsoid(f'hfoot{s}', 'foot', (x, HIND_Y - 0.04, 0.05), (0.09, 0.12, 0.05), blend=0.03)
    b.chain('tail', 'tail', TAIL, [0.035, 0.026, 0.02], blend=0.05)
    b.ellipsoid('tuft', 'tuft', (0, 0.73, 0.73), (0.045, 0.045, 0.09), blend=0.02)
    return b


EYES: dict = {}


def build(target_tris: int = 4200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('camel_body', b, (-0.5, -1.65, 0.0), (0.5, 0.95, 1.95), 0.015, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.6 * s, -0.7, 0.35), (0.04, 0.05, 0.02))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -1.34, 1.6), (0.85 * s, -0.35, -0.15), (0.04, 0.03, 0.012), BLUSH,
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
        nostril = M.decal(f'nostril{s}', b, (0, -1.44, 1.62), (0.4 * s, -1, 0.3), (0.02, 0.01, 0.008), '#6E4E33',
                          sink=0.5, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.35, 0)),
        BoneSpec('hips', (0, 0.42, 1.12), (0, 0.05, 1.14), 'root'),
        BoneSpec('spine_1', (0, 0.05, 1.14), (0, -0.22, 1.16), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.22, 1.16), (0, -0.5, 1.2), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('head', NECK[-1], (0, -1.5, 1.56), 'neck_2', connect=True),
        BoneSpec('jaw', (0, -1.34, 1.54), (0, -1.52, 1.5), 'head'),
        BoneSpec('ear_l', (0.1, -1.09, 1.74), (0.17, -1.09, 1.8), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], (0, 0.73, 0.62), 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'head', 'jaw', 'ear_l', 'ear_r', 'tail_1', 'tail_2',
              'tail_3'] + [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot')
                           for s in ('l', 'r')]
