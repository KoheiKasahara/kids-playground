# sheep から作成した deer の土台を、シカの個別仕様に書き換えたもの。
"""シカ（ニホンジカ）: 茶色のすらりとした体に白い点の模様、白いおしり、細く長い脚、大きな耳、枝分かれしたつの。

白い点は体の表面に沿うデカール（キリンのぶちと同じ作り方）。つのは head の骨に固定した別の部品。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'deer'
BROWN = '#B97A48'
PALETTE = {'body': BROWN, 'neck': BROWN, 'head': '#BF8350', 'muzzle': '#D9B08A', 'ear': '#B57646', 'leg': '#A86D40',
           'hoof': '#4A3A33', 'rump': '#FAF3E6', 'tail': '#FAF3E6'}
SPOT = '#F7EEDC'
BLUSH = '#F2A4B2'
ANTLER = '#E5D2AE'

LEG_X = 0.12
FRONT_Y = -0.3
HIND_Y = 0.32
JOINTS = {
    'front': {'top': (FRONT_Y, 0.78), 'mid': (FRONT_Y - 0.05, 0.42), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.08, 0.025)},
    'hind': {'top': (HIND_Y, 0.78), 'mid': (HIND_Y + 0.07, 0.4), 'low': (HIND_Y, 0.1), 'toe': (HIND_Y - 0.08, 0.025)},
}
NECK = [(0, -0.36, 0.88), (0, -0.47, 1.06), (0, -0.53, 1.2)]
HEAD_CENTER = (0, -0.6, 1.25)
TORSO = ((0, 0.0, 0.86), (0.22, 0.42, 0.21))


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', *TORSO)
    b.ellipsoid('chest', 'body', (0, -0.24, 0.88), (0.19, 0.2, 0.21), blend=0.1)
    b.ellipsoid('rump', 'rump', (0, 0.4, 0.88), (0.13, 0.06, 0.13), blend=0.06)
    b.chain('neck', 'neck', NECK, [0.11, 0.085, 0.08], blend=0.08)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.13, 0.15, 0.12), blend=0.06)
    b.ellipsoid('snout', 'head', (0, -0.77, 1.2), (0.08, 0.12, 0.08), blend=0.06)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.87, 1.18), (0.06, 0.05, 0.055), blend=0.03)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', (0.13 * s, -0.56, 1.33), (0.075, 0.025, 0.04), rot_deg=(0, -25 * s, 10 * s),
                    blend=0.03)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.ellipsoid(f'arm{s}', 'leg', (x, FRONT_Y + 0.02, 0.7), (0.08, 0.1, 0.15), blend=0.07)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 0.74), (x, *f['mid']), 0.06, 0.04, blend=0.05)
        b.cone(f'fl_l{s}', 'leg', (x, *f['mid']), (x, *f['low']), 0.035, 0.03, blend=0.02)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.015, 0.045), (0.035, 0.045, 0.045), blend=0.02)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.7), (0.09, 0.13, 0.17), blend=0.07)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.74), (x, *h['mid']), 0.065, 0.04, blend=0.05)
        b.cone(f'hl_l{s}', 'leg', (x, *h['mid']), (x, *h['low']), 0.035, 0.03, blend=0.02)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.015, 0.045), (0.035, 0.045, 0.045), blend=0.02)
    b.ellipsoid('tail', 'tail', (0, 0.43, 0.93), (0.04, 0.04, 0.06), blend=0.02)
    return b


def antler(side: int):
    """枝分かれしたつの（太い軸と2本の枝）。"""
    parts = []
    base = np.array((0.06 * side, -0.56, 1.33))
    tip = base + np.array((0.1 * side, 0.06, 0.26))
    for i, (a, bb, r) in enumerate([(base, tip, 0.022),
                                    (base + (tip - base) * 0.35, base + (tip - base) * 0.35 + np.array((0.0, -0.1, 0.1)), 0.016),
                                    (base + (tip - base) * 0.7, base + (tip - base) * 0.7 + np.array((0.05 * side, -0.07, 0.09)), 0.014)]):
        d = bb - a
        length = float(np.linalg.norm(d))
        o = M.primitive('cone', f'antler{side}{i}', M.look_matrix(tuple(a + d / 2), tuple(d), scale=(r, r, length)),
                        segments=6, radius1=1.0, radius2=0.45)
        M.solid(o, ANTLER)
        parts.append(o)
    return parts


EYES: dict = {}


def build(target_tris: int = 3800, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('deer_body', b, (-0.35, -0.95, 0.0), (0.35, 0.55, 1.45), 0.011, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    # 白い点: 背中の両わきに2列
    rng = np.random.default_rng(7)
    spots = []
    for i in range(18):
        s = 1 if i % 2 else -1
        y = -0.3 + 0.62 * rng.random()
        z = 0.2 + 0.5 * rng.random()
        spots.append((TORSO[0], (s * (0.8 - 0.3 * z), y * 1.7, z), 0.026 + 0.01 * rng.random()))
    C.spots(roles, b, spots, SPOT, seed=3)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.62 * s, -0.7, 0.3), (0.04, 0.05, 0.02))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.89, 1.19), (0, -1, 0.15), (0.025, 0.018, 0.01), '#3A2A24', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.72, 1.2), (0.85 * s, -0.4, -0.15), (0.028, 0.02, 0.01), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.13 * s, -0.56, 1.33), (0.3 * s, -1, 0.2), (0.05, 0.016, 0.008),
                        '#F4D6C9', sink=0.3, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        for o in antler(s):
            roles['rigid'].append((o, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.32, 0.86), (0, 0.03, 0.87), 'root'),
        BoneSpec('spine_1', (0, 0.03, 0.87), (0, -0.16, 0.88), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.16, 0.88), (0, -0.36, 0.88), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('head', NECK[-1], (0, -0.86, 1.18), 'neck_2', connect=True),
        BoneSpec('ear_l', (0.08, -0.56, 1.32), (0.2, -0.56, 1.36), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.4, 0.92), (0, 0.46, 0.88), 'hips'),
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
