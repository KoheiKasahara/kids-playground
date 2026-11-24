# sheep から作成した goat の土台を、ヤギの個別仕様に書き換えたもの。
"""ヤギ: すっきりした白い体（ヒツジのような もこもこはない）、長めの顔、うしろへ反った小さな2本のつの、
あごの白いひげ、横へ出た耳、ピンクの鼻、細い脚と黒いひづめ、上へ立った短いしっぽ。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'goat'
COAT = '#F7F3EA'
PALETTE = {'body': COAT, 'neck': COAT, 'head': '#F9F5EE', 'muzzle': '#F3E7DA', 'ear': COAT, 'leg': '#F1EADF',
           'hoof': '#5B4A45', 'tail': COAT, 'horn': '#B9AF9E', 'beard': '#FFFFFF'}
BLUSH = '#F6A9B9'

LEG_X = 0.12
FRONT_Y = -0.26
HIND_Y = 0.28
JOINTS = {
    'front': {'top': (FRONT_Y, 0.55), 'mid': (FRONT_Y - 0.05, 0.3), 'low': (FRONT_Y, 0.08), 'toe': (FRONT_Y - 0.08, 0.02)},
    'hind': {'top': (HIND_Y, 0.55), 'mid': (HIND_Y + 0.06, 0.29), 'low': (HIND_Y, 0.08), 'toe': (HIND_Y - 0.08, 0.02)},
}
NECK = [(0, -0.3, 0.64), (0, -0.4, 0.76), (0, -0.46, 0.86)]
HEAD_CENTER = (0, -0.52, 0.9)
TORSO = ((0, 0.0, 0.62), (0.19, 0.36, 0.18))


def _fib(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    theta = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


def body() -> Body:
    b = Body(floor=0.0)
    c, r = TORSO
    b.ellipsoid('torso', 'body', c, r)
    b.ellipsoid('chest', 'body', (0, -0.22, 0.64), (0.17, 0.16, 0.19), blend=0.1)
    b.ellipsoid('rump', 'body', (0, 0.24, 0.64), (0.17, 0.15, 0.17), blend=0.1)
    b.chain('neck', 'neck', NECK, [0.1, 0.085, 0.075], blend=0.07)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.115, 0.13, 0.115), blend=0.05)
    b.ellipsoid('snout', 'head', (0, -0.65, 0.84), (0.078, 0.1, 0.075), blend=0.05)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.73, 0.82), (0.058, 0.045, 0.05), blend=0.03)
    # あごの白いひげ
    b.cone('beard', 'beard', (0, -0.66, 0.78), (0, -0.66, 0.68), 0.03, 0.012, blend=0.02)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.13 * s, -0.47, 0.94), (0.07, 0.025, 0.032), rot_deg=(0, -12 * s, 0),
                    blend=0.03)
        # うしろへ反った小さなつの
        b.cone(f'horn{s}', 'horn', (0.045 * s, -0.5, 0.98), (0.06 * s, -0.42, 1.08), 0.024, 0.008, blend=0.015)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 0.5), (x, *f['mid']), 0.045, 0.032, blend=0.04)
        b.cone(f'fl_l{s}', 'leg', (x, *f['mid']), (x, *f['low']), 0.032, 0.03, blend=0.02)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.015, 0.04), (0.036, 0.046, 0.04), blend=0.02)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.5), (x, *h['mid']), 0.052, 0.032, blend=0.04)
        b.cone(f'hl_l{s}', 'leg', (x, *h['mid']), (x, *h['low']), 0.032, 0.03, blend=0.02)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.015, 0.04), (0.036, 0.046, 0.04), blend=0.02)
    # 上へ立った短いしっぽ
    b.cone('tail', 'tail', (0, 0.36, 0.7), (0, 0.42, 0.8), 0.035, 0.02, blend=0.03)
    return b


EYES: dict = {}


def build(target_tris: int = 4000, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('goat_body', b, (-0.4, -0.85, 0.0), (0.4, 0.6, 1.15), 0.01, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.6 * s, -0.7, 0.3), (0.027, 0.034, 0.014))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.73, 0.83), (0, -1, 0.15), (0.026, 0.018, 0.01), '#E39AA0', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.63, 0.84), (0.85 * s, -0.4, -0.15), (0.026, 0.02, 0.01), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.13 * s, -0.47, 0.94), (0.3 * s, -0.4, -1), (0.045, 0.015, 0.01),
                        '#F2B9BF', sink=0.3, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.28, 0.62), (0, 0.03, 0.63), 'root'),
        BoneSpec('spine_1', (0, 0.03, 0.63), (0, -0.14, 0.64), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.14, 0.64), (0, -0.3, 0.64), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('head', NECK[-1], (0, -0.76, 0.84), 'neck_2', connect=True),
        BoneSpec('ear_l', (0.09, -0.47, 0.94), (0.2, -0.47, 0.92), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.36, 0.68), (0, 0.42, 0.8), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'head', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
