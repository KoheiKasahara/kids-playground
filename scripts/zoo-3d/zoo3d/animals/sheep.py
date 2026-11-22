# zebra から作成した sheep の土台を、ヒツジの個別仕様に書き換えたもの。
"""ヒツジ: もこもこの白い毛（小さな玉をたくさん重ねた雲のような形）、クリーム色の顔と細い脚、横へたれた耳、
頭の上の毛のかたまり、黒いひづめ。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'sheep'
WOOL = '#FBF7EE'
FACE = '#F2DFC6'
PALETTE = {'wool': WOOL, 'body': WOOL, 'neck': WOOL, 'head': FACE, 'muzzle': '#EED5B8', 'ear': FACE, 'leg': FACE,
           'hoof': '#5B4A45', 'tail': WOOL}
BLUSH = '#F6A9B9'

LEG_X = 0.12
FRONT_Y = -0.26
HIND_Y = 0.28
JOINTS = {
    'front': {'top': (FRONT_Y, 0.55), 'mid': (FRONT_Y - 0.05, 0.3), 'low': (FRONT_Y, 0.08), 'toe': (FRONT_Y - 0.08, 0.02)},
    'hind': {'top': (HIND_Y, 0.55), 'mid': (HIND_Y + 0.06, 0.29), 'low': (HIND_Y, 0.08), 'toe': (HIND_Y - 0.08, 0.02)},
}
NECK = [(0, -0.3, 0.64), (0, -0.4, 0.74), (0, -0.46, 0.82)]
HEAD_CENTER = (0, -0.52, 0.86)
TORSO = ((0, 0.0, 0.62), (0.27, 0.38, 0.24))


def _fib(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    theta = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


def body() -> Body:
    b = Body(floor=0.0)
    c, r = TORSO
    b.ellipsoid('core', 'wool', c, r)
    # もこもこ: 胴の表面に小さな玉を並べ、少しだけなめらかにつなぐ
    for i, d in enumerate(_fib(42)):
        if d[2] < -0.55:
            continue
        p = np.asarray(c) + d * np.asarray(r) * 0.92
        size = 0.085 + 0.02 * ((i * 7) % 3) / 2
        b.ellipsoid(f'puff{i}', 'wool', tuple(p), (size, size, size), blend=0.035)
    b.chain('neck', 'neck', NECK, [0.13, 0.11, 0.1], blend=0.08)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.12, 0.14, 0.12), blend=0.06)
    b.ellipsoid('snout', 'head', (0, -0.66, 0.81), (0.085, 0.1, 0.085), blend=0.06)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.74, 0.79), (0.07, 0.05, 0.06), blend=0.03)
    for k, (dx, dz) in enumerate(((0, 0.1), (0.06, 0.08), (-0.06, 0.08), (0, 0.06))):
        b.ellipsoid(f'topknot{k}', 'wool', (dx, -0.5 + 0.02 * k, 0.93 + dz * 0.3), (0.06, 0.06, 0.05), blend=0.03)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.15 * s, -0.48, 0.88), (0.075, 0.03, 0.035), rot_deg=(0, -20 * s, 0),
                    blend=0.03)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 0.5), (x, *f['mid']), 0.05, 0.035, blend=0.04)
        b.cone(f'fl_l{s}', 'leg', (x, *f['mid']), (x, *f['low']), 0.035, 0.032, blend=0.02)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.015, 0.04), (0.04, 0.05, 0.04), blend=0.02)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.5), (x, *h['mid']), 0.055, 0.035, blend=0.04)
        b.cone(f'hl_l{s}', 'leg', (x, *h['mid']), (x, *h['low']), 0.035, 0.032, blend=0.02)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.015, 0.04), (0.04, 0.05, 0.04), blend=0.02)
    b.ellipsoid('tail', 'tail', (0, 0.41, 0.6), (0.06, 0.06, 0.07), blend=0.03)
    return b


EYES: dict = {}


def build(target_tris: int = 4600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('sheep_body', b, (-0.45, -0.85, 0.0), (0.45, 0.6, 1.1), 0.011, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.6 * s, -0.7, 0.3), (0.03, 0.038, 0.016))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.74, 0.8), (0, -1, 0.15), (0.03, 0.02, 0.01), '#C98F8A', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.64, 0.8), (0.85 * s, -0.4, -0.15), (0.03, 0.022, 0.01), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.15 * s, -0.48, 0.88), (0.3 * s, -0.4, -1), (0.05, 0.018, 0.01),
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
        BoneSpec('head', NECK[-1], (0, -0.76, 0.8), 'neck_2', connect=True),
        BoneSpec('ear_l', (0.1, -0.48, 0.88), (0.22, -0.48, 0.86), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.38, 0.62), (0, 0.45, 0.56), 'hips'),
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
