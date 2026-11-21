"""キリン: 長い首と脚、小さな頭に2本のつの（オシコーン）、黄色い体に茶色のぶち。

座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'giraffe'
PALETTE = {
    'body': '#F7CD5D', 'leg': '#F7CD5D', 'neck': '#F7CD5D', 'head': '#F8D46C', 'muzzle': '#F6DDB0',
    'hoof': '#6E4B33', 'ossicone': '#EDB95A', 'ossicone_tip': '#8A5A2E', 'mane': '#C97A35', 'ear': '#F8D46C',
    'tail': '#F7CD5D', 'tuft': '#7A4A26',
}
SPOT = '#C97A35'
BELLY = '#FBE7B5'
BLUSH = '#F6AFC1'

LEG_X = 0.2
FRONT_Y = -0.36
HIND_Y = 0.42
JOINTS = {
    'front': {'top': (FRONT_Y, 1.62), 'mid': (FRONT_Y - 0.12, 0.85), 'low': (FRONT_Y, 0.14), 'toe': (FRONT_Y - 0.13, 0.03)},
    'hind': {'top': (HIND_Y, 1.62), 'mid': (HIND_Y + 0.12, 0.82), 'low': (HIND_Y, 0.14), 'toe': (HIND_Y - 0.13, 0.03)},
}
NECK = [(0, -0.42, 1.98), (0, -0.56, 2.34), (0, -0.7, 2.7), (0, -0.8, 3.0)]
HEAD_CENTER = (0, -0.9, 3.14)
TAIL = [(0, 0.6, 1.86), (0, 0.7, 1.5), (0, 0.72, 1.22)]


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.02, 1.78), (0.34, 0.6, 0.36))
    b.ellipsoid('chest', 'body', (0, -0.3, 1.86), (0.33, 0.36, 0.39), blend=0.15)
    b.ellipsoid('rump', 'body', (0, 0.38, 1.72), (0.3, 0.32, 0.33), blend=0.15)
    b.ellipsoid('withers', 'body', (0, -0.36, 2.02), (0.24, 0.28, 0.24), blend=0.12)
    b.chain('neck', 'neck', NECK, [0.21, 0.155, 0.13, 0.115], blend=0.14)
    for i, p in enumerate([(0, -0.33, 2.13), (0, -0.46, 2.45), (0, -0.6, 2.79), (0, -0.71, 3.07)]):
        b.ellipsoid(f'mane{i}', 'mane', p, (0.045, 0.1, 0.12), rot_deg=(-25, 0, 0), blend=0.03)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.19, 0.22, 0.2), blend=0.08)
    b.ellipsoid('snout', 'head', (0, -1.12, 3.08), (0.135, 0.18, 0.13), blend=0.1)
    b.ellipsoid('muzzle', 'muzzle', (0, -1.27, 3.05), (0.115, 0.085, 0.1), blend=0.05)
    for s in (1, -1):
        b.cone(f'ossicone{s}', 'ossicone', (0.065 * s, -0.86, 3.26), (0.08 * s, -0.84, 3.44), 0.034, 0.027, blend=0.04)
        b.ellipsoid(f'ossicone_tip{s}', 'ossicone_tip', (0.08 * s, -0.84, 3.46), (0.048, 0.048, 0.045), blend=0.01)
        b.cone(f'ear{s}', 'ear', (0.12 * s, -0.83, 3.24), (0.31 * s, -0.8, 3.27), 0.05, 0.022, blend=0.04)
    for s in (1, -1):
        x = LEG_X * s
        f = JOINTS['front']
        b.ellipsoid(f'arm{s}', 'leg', (x, FRONT_Y + 0.02, 1.45), (0.13, 0.17, 0.26), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 1.62), (x, FRONT_Y - 0.02, 0.85), 0.11, 0.08, blend=0.08)
        b.ellipsoid(f'fknee{s}', 'leg', (x, FRONT_Y - 0.02, 0.85), (0.075, 0.08, 0.085), blend=0.04)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y - 0.02, 0.85), (x, *f['low']), 0.068, 0.062, blend=0.04)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.02, 0.07), (0.082, 0.092, 0.075), blend=0.02)
        h = JOINTS['hind']
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 1.45), (0.13, 0.2, 0.27), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 1.62), (x, HIND_Y + 0.04, 0.84), 0.11, 0.08, blend=0.08)
        b.ellipsoid(f'hock{s}', 'leg', (x, HIND_Y + 0.04, 0.84), (0.072, 0.085, 0.08), blend=0.04)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y + 0.04, 0.84), (x, *h['low']), 0.066, 0.06, blend=0.04)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.02, 0.07), (0.08, 0.09, 0.075), blend=0.02)
    b.chain('tail', 'tail', TAIL, [0.035, 0.026, 0.02], blend=0.05)
    b.ellipsoid('tuft', 'tuft', (0, 0.72, 1.12), (0.05, 0.05, 0.11), blend=0.02)
    return b


def _fib(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    theta = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


EYES: dict = {}


def build(target_tris: int = 3800, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('giraffe_body', b, (-0.6, -1.45, 0.0), (0.6, 0.95, 3.6), 0.016, target_tris=target_tris)

    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    # ぶち模様: 胴体・首・もも
    spots = []
    for d in _fib(34):
        if d[2] < -0.35 or abs(d[1]) > 0.93:
            continue
        spots.append(((0, 0.02, 1.8), (d[0], d[1] * 1.6, d[2]), 0.1))
    for k, (p, r) in enumerate(zip(NECK[:-1], [0.07, 0.06, 0.05])):
        for a in (0.0, 1.6, 3.14, 4.7):
            spots.append((p, (np.cos(a + k), 0.25 * np.sin(a + k) + 0.15, np.sin(a + k) * 0.6), r))
    for s in (1, -1):
        spots.append(((LEG_X * s, FRONT_Y, 1.4), (s, -0.2, 0.2), 0.07))
        spots.append(((LEG_X * s, HIND_Y, 1.4), (s, 0.2, 0.2), 0.08))
    C.spots(roles, b, spots, SPOT)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.5 * s, -0.78, 0.36), (0.056, 0.07, 0.028))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -1.0, 3.08), (0.75 * s, -0.55, -0.1), (0.05, 0.035, 0.015), BLUSH,
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.35, 0)),
        BoneSpec('hips', (0, 0.42, 1.78), (0, 0.05, 1.8), 'root'),
        BoneSpec('spine_1', (0, 0.05, 1.8), (0, -0.2, 1.84), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 1.84), (0, -0.42, 1.98), 'spine_1', connect=True),
    ]
    parent = 'spine_2'
    for i in range(len(NECK) - 1):
        name = f'neck_{i + 1}'
        specs.append(BoneSpec(name, NECK[i], NECK[i + 1], parent, connect=True))
        parent = name
    specs += [
        BoneSpec('head', NECK[-1], (0, -1.22, 3.08), parent, connect=True),
        BoneSpec('ear_l', (0.12, -0.83, 3.24), (0.31, -0.8, 3.27), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], (0, 0.72, 1.02), 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'neck_3', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2',
              'tail_3'] + [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot')
                           for s in ('l', 'r')]
