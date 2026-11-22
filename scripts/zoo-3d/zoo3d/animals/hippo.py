"""カバ: たる形の大きな体と短い柱のような脚、横に広い大きな口、頭の上の小さな目・耳・鼻の穴。

下あごは別の部品にして jaw の骨へ固定し、あくびで大きく開くと口の中（ピンク）ときばが見える。
口先に、水しぶきの出どころにする骨 mouth_tip（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'hippo'
SKIN = '#A898BF'
PINK = '#E8B4C6'
PALETTE = {'body': SKIN, 'belly': '#B4A5C9', 'leg': SKIN, 'head': SKIN, 'muzzle': '#B9A8CC', 'ear': SKIN,
           'tail': SKIN, 'nail': '#EFE6EF'}
BLUSH = '#F3A2BA'

LEG_X = 0.25
FRONT_Y = -0.36
HIND_Y = 0.42
JOINTS = {
    'front': {'top': (FRONT_Y, 0.5), 'mid': (FRONT_Y + 0.09, 0.29), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.13, 0.03)},
    'hind': {'top': (HIND_Y, 0.5), 'mid': (HIND_Y - 0.09, 0.29), 'low': (HIND_Y, 0.1), 'toe': (HIND_Y - 0.13, 0.03)},
}
HEAD_CENTER = (0, -0.72, 0.9)
MUZZLE = ((0, -1.0, 0.8), (0.33, 0.25, 0.2))


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.04, 0.64), (0.44, 0.64, 0.42))
    b.ellipsoid('belly', 'belly', (0, 0.0, 0.42), (0.36, 0.5, 0.2), blend=0.15)
    b.ellipsoid('neck', 'body', (0, -0.48, 0.78), (0.36, 0.26, 0.32), blend=0.15)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.3, 0.3, 0.26), blend=0.12)
    b.ellipsoid('muzzle', 'muzzle', *MUZZLE, blend=0.1)
    for s in (1, -1):
        b.ellipsoid(f'brow{s}', 'head', (0.15 * s, -0.78, 1.08), (0.1, 0.1, 0.08), blend=0.06)
        b.ellipsoid(f'nose{s}', 'muzzle', (0.11 * s, -1.08, 0.95), (0.08, 0.07, 0.06), blend=0.05)
        b.ellipsoid(f'ear{s}', 'ear', (0.2 * s, -0.62, 1.14), (0.05, 0.035, 0.06), rot_deg=(0, 0, 20 * s), blend=0.03)
    for s in (1, -1):
        x = LEG_X * s
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            b.cone(f'{key}leg{s}', 'leg', (x, y, 0.5), (x, y, 0.08), 0.15, 0.13, blend=0.1)
            b.ellipsoid(f'{key}foot{s}', 'leg', (x, y - 0.02, 0.07), (0.14, 0.15, 0.07), blend=0.04)
    b.cone('tail', 'tail', (0, 0.64, 0.68), (0, 0.76, 0.52), 0.05, 0.025, blend=0.05)
    return b


EYES: dict = {}


def build(target_tris: int = 3800, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('hippo_body', b, (-0.6, -1.35, 0.0), (0.6, 0.85, 1.3), 0.015, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, (0, -0.76, 1.0), lambda s: (0.42 * s, -0.55, 0.7), (0.045, 0.055, 0.024))
    EYES.update(eyes)
    for s in (1, -1):
        nostril = M.decal(f'nostril{s}', b, (0.11 * s, -1.08, 0.95), (0.15 * s, -0.3, 1), (0.03, 0.02, 0.012),
                          '#5D4E6E', sink=0.4, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
        blush = M.decal(f'blush{s}', b, MUZZLE[0], (0.85 * s, -0.4, 0.1), (0.07, 0.05, 0.015), BLUSH, sink=0.5,
                        segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.2 * s, -0.62, 1.14), (0.1 * s, -1, 0.1), (0.03, 0.04, 0.012),
                        PINK, sink=0.4, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        for key, y in (('f', FRONT_Y), ('h', HIND_Y)):
            for dx in (-0.06, 0.06):
                nail = M.decal(f'nail{key}{s}{dx}', b, (LEG_X * s + dx, y, 0.06), (0, -1, -0.2), (0.035, 0.03, 0.015),
                               PALETTE['nail'], sink=0.4, segments=8, rings=4)
                roles['decal'].append(nail)
    # 口の中（ピンク）と上の歯、jaw の骨で開く下あご（下のきばつき）
    mouth = M.primitive('sphere', 'mouth', M.look_matrix((0, -0.98, 0.67), (0, -1, 0), scale=(0.27, 0.09, 0.2)),
                        segments=14, rings=8)
    M.solid(mouth, '#D9708C')
    roles['rigid'].append((mouth, 'head'))
    jaw = M.primitive('sphere', 'jaw_mesh', M.look_matrix((0, -0.97, 0.62), (0, -1, 0), scale=(0.3, 0.1, 0.24)),
                      segments=16, rings=9)
    M.solid(jaw, '#B3A2C7')
    roles['rigid'].append((jaw, 'jaw'))
    tongue = M.primitive('sphere', 'tongue', M.look_matrix((0, -0.95, 0.68), (0, -1, 0), scale=(0.17, 0.04, 0.15)),
                         segments=10, rings=6)
    M.solid(tongue, '#F09AB0')
    roles['rigid'].append((tongue, 'jaw'))
    for s in (1, -1):
        tusk = M.primitive('cone', f'tusk{s}', M.look_matrix((0.19 * s, -1.08, 0.71), (0, -0.2, 1),
                           scale=(0.035, 0.035, 0.09)), segments=8)
        M.solid(tusk, '#FFFDF5')
        roles['rigid'].append((tusk, 'jaw'))
        tooth = M.primitive('cone', f'tooth{s}', M.look_matrix((0.12 * s, -1.12, 0.635), (0, -0.1, -1),
                            scale=(0.025, 0.025, 0.05)), segments=6)
        M.solid(tooth, '#FFFDF5')
        roles['rigid'].append((tooth, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.42, 0.64), (0, 0.05, 0.66), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.66), (0, -0.22, 0.68), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.22, 0.68), (0, -0.46, 0.76), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.46, 0.76), (0, -0.62, 0.86), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.62, 0.86), (0, -1.15, 0.84), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.74, 0.7), (0, -1.1, 0.62), 'head'),
        BoneSpec('mouth_tip', (0, -1.2, 0.8), (0, -1.28, 0.9), 'head', deform=False),
        BoneSpec('ear_l', (0.18, -0.62, 1.1), (0.22, -0.62, 1.2), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.62, 0.7), (0, 0.78, 0.5), 'hips'),
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
