"""ライオン: 大きな頭とふさふさのたてがみ、太い前足、先に房のある長い尾。

あごは別の部品にして jaw の骨へ固定し、吠えるときに口の中（暗い色）が見えるようにする。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'lion'
PALETTE = {
    'body': '#F2B35C', 'leg': '#F2B35C', 'head': '#F4BA66', 'muzzle': '#FBE3B8', 'ear': '#E9A24F',
    'paw': '#F7CB86', 'tail': '#F2B35C', 'tuft': '#8A4A22', 'mane': '#C9692B', 'mane_light': '#D97E37',
}

LEG_X = 0.17
FRONT_Y = -0.32
HIND_Y = 0.36
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 0.62), 'mid': (FRONT_Y + 0.08, 0.3), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.13, 0.03)},
    'hind': {'top': (HIND_Y, 0.6), 'mid': (HIND_Y - 0.1, 0.38), 'low': (HIND_Y + 0.06, 0.18), 'toe': (HIND_Y - 0.1, 0.03)},
}
HEAD_CENTER = (0, -0.66, 0.98)
TAIL = [(0, 0.5, 0.72), (0, 0.76, 0.6), (0, 0.98, 0.5), (0, 1.12, 0.56)]


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.02, 0.66), (0.27, 0.5, 0.27))
    b.ellipsoid('chest', 'body', (0, -0.25, 0.7), (0.27, 0.3, 0.3), blend=0.12)
    b.ellipsoid('rump', 'body', (0, 0.32, 0.66), (0.24, 0.26, 0.26), blend=0.12)
    b.ellipsoid('neck', 'body', (0, -0.48, 0.86), (0.19, 0.2, 0.2), blend=0.12)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.27, 0.25, 0.26), blend=0.1)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.86, 0.91), (0.15, 0.12, 0.11), blend=0.06)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'muzzle', (0.085 * s, -0.88, 0.88), (0.085, 0.075, 0.075), blend=0.03)
        b.ellipsoid(f'ear{s}', 'ear', (0.19 * s, -0.6, 1.2), (0.085, 0.045, 0.085), rot_deg=(0, 0, 18 * s), blend=0.04)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'shoulder{s}', 'leg', (x, FRONT_Y + 0.03, 0.55), (0.12, 0.15, 0.17), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y + 0.02, 0.6), (x, FRONT_Y + 0.03, 0.3), 0.1, 0.088, blend=0.08)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y + 0.03, 0.3), (x, FRONT_Y, 0.1), 0.088, 0.08, blend=0.04)
        b.ellipsoid(f'fpaw{s}', 'paw', (x, FRONT_Y - 0.05, 0.065), (0.1, 0.12, 0.07), blend=0.04)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.52), (0.12, 0.17, 0.18), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y - 0.02, 0.5), (x, HIND_Y + 0.02, 0.3), 0.1, 0.075, blend=0.06)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y + 0.02, 0.3), (x, HIND_Y + 0.06, 0.16), 0.075, 0.065, blend=0.04)
        b.cone(f'hl_m{s}', 'leg', (x, HIND_Y + 0.06, 0.16), (x, HIND_Y - 0.03, 0.06), 0.065, 0.065, blend=0.04)
        b.ellipsoid(f'hpaw{s}', 'paw', (x, HIND_Y - 0.06, 0.055), (0.09, 0.11, 0.065), blend=0.04)
    b.chain('tail', 'tail', TAIL, [0.042, 0.032, 0.026, 0.022], blend=0.05)
    b.ellipsoid('tuft', 'tuft', (0, 1.17, 0.58), (0.06, 0.085, 0.065), blend=0.02)
    return b


def mane() -> Body:
    """顔のまわりを囲むたてがみ。輪状に並べた楕円の和で、ふさふさした外形にする。"""
    m = Body()
    m.ellipsoid('mane_back', 'mane', (0, -0.48, 0.96), (0.27, 0.2, 0.3))
    for i in range(12):
        a = i / 12 * np.pi * 2
        r = 0.27 + 0.02 * (i % 2)
        p = (r * np.cos(a), -0.56 + 0.04 * (i % 2), 0.97 + r * np.sin(a) * 1.02)
        m.ellipsoid(f'tuft{i}', 'mane' if i % 2 else 'mane_light', p, (0.12, 0.1, 0.12), blend=0.05)
    m.ellipsoid('mane_chest', 'mane', (0, -0.5, 0.72), (0.2, 0.16, 0.17), blend=0.08)
    return m


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('lion_body', b, (-0.5, -1.05, 0.0), (0.5, 1.3, 1.35), 0.014, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    mb = mane()
    mane_obj = M.body_object('lion_mane', mb, (-0.5, -0.8, 0.45), (0.5, -0.2, 1.4), 0.014, target_tris=1100)
    M.paint(mane_obj, mb, PALETTE)
    roles['decal'].append(mane_obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.42 * s, -0.85, 0.26), (0.05, 0.062, 0.025))
    EYES.update(eyes)
    # 鼻・耳の内側・頬
    nose = M.decal('nose', b, (0, -0.84, 0.94), (0, -0.7, 0.72), (0.06, 0.045, 0.03), '#7A4038', sink=0.4,
                   up=(0, -0.6, 0.8))
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        inner = M.decal(f'ear_inner{s}', b, (0.19 * s, -0.6, 1.18), (0.1 * s, -1, 0.15), (0.05, 0.05, 0.015),
                        '#B8642E', sink=0.3, segments=10, rings=5)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.62 * s, -0.75, -0.2), (0.055, 0.04, 0.015), '#F4A7B5',
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
    # 口の中（暗い色）と、jaw の骨で開くあご
    mouth = M.primitive('sphere', 'mouth', M.look_matrix((0, -0.86, 0.83), (0, -1, -0.2), scale=(0.09, 0.05, 0.06)),
                        segments=10, rings=6)
    M.solid(mouth, '#6B2A2A')
    roles['rigid'].append((mouth, 'head'))
    chin = M.primitive('sphere', 'chin', M.look_matrix((0, -0.84, 0.8), (0, -1, -0.1), scale=(0.105, 0.065, 0.1)),
                       segments=12, rings=7)
    M.solid(chin, PALETTE['muzzle'])
    roles['rigid'].append((chin, 'jaw'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.36, 0.66), (0, 0.05, 0.68), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.68), (0, -0.2, 0.7), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 0.7), (0, -0.42, 0.78), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.42, 0.78), (0, -0.58, 0.92), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.58, 0.92), (0, -0.92, 0.95), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.72, 0.86), (0, -0.9, 0.8), 'head'),
        BoneSpec('ear_l', (0.15, -0.6, 1.12), (0.21, -0.6, 1.27), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], (0, 1.2, 0.6), 'tail_3', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2', 'tail_3', 'tail_4'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
