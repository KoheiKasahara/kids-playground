# lion から作成した tiger の土台を、トラの個別仕様に書き換えたもの。
"""トラ: オレンジの体に黒いしま、白い鼻先・ほお・おなか、先の黒い長い尾。たてがみはない。

しま模様は面の塗り分けではなく、体を少しふくらませた殻を細い板（楕円体）で切り出した別の形にする
（パンダの肩の帯と同じ作り方。境目がなめらかで、どの向きから見てもしまが読める）。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body, Part, rotation_matrix, sd_ellipsoid, sd_round_cone

NAME = 'tiger'
ORANGE = '#F29A3A'
WHITE = '#FBF3E4'
STRIPE = '#33262A'
PALETTE = {
    'body': ORANGE, 'leg': ORANGE, 'head': '#F4A445', 'muzzle': WHITE, 'cheek': WHITE, 'belly': '#F8CB8C',
    'ear': ORANGE, 'paw': '#F7B565', 'tail': ORANGE, 'tip': STRIPE, 'stripe': STRIPE,
}
BLUSH = '#F6A9B8'

LEG_X = 0.17
FRONT_Y = -0.34
HIND_Y = 0.38
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 0.6), 'mid': (FRONT_Y + 0.08, 0.3), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.13, 0.03)},
    'hind': {'top': (HIND_Y, 0.58), 'mid': (HIND_Y - 0.1, 0.37), 'low': (HIND_Y + 0.06, 0.18), 'toe': (HIND_Y - 0.1, 0.03)},
}
HEAD_CENTER = (0, -0.7, 0.92)
TAIL = [(0, 0.54, 0.68), (0, 0.8, 0.6), (0, 1.02, 0.56), (0, 1.2, 0.66)]
TORSO = [((0, 0.03, 0.64), (0.26, 0.54, 0.25)), ((0, -0.26, 0.67), (0.26, 0.3, 0.28)), ((0, 0.34, 0.63), (0.24, 0.27, 0.25))]


def body() -> Body:
    b = Body(floor=0.0)
    (c0, r0), (c1, r1), (c2, r2) = TORSO
    b.ellipsoid('torso', 'body', c0, r0)
    b.ellipsoid('chest', 'body', c1, r1, blend=0.12)
    b.ellipsoid('rump', 'body', c2, r2, blend=0.12)
    b.ellipsoid('belly', 'belly', (0, -0.05, 0.5), (0.2, 0.46, 0.13), blend=0.1)
    b.ellipsoid('neck', 'body', (0, -0.5, 0.82), (0.18, 0.2, 0.19), blend=0.12)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.27, 0.245, 0.245), blend=0.1)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.89, 0.85), (0.13, 0.11, 0.1), blend=0.06)
    for s in (1, -1):
        # 白いほおの毛（顔の横へふくらむ）
        b.ellipsoid(f'cheek{s}', 'cheek', (0.17 * s, -0.78, 0.84), (0.11, 0.1, 0.1), rot_deg=(0, 0, 20 * s), blend=0.05)
        b.ellipsoid(f'ear{s}', 'ear', (0.17 * s, -0.66, 1.12), (0.075, 0.04, 0.075), rot_deg=(0, 0, 16 * s), blend=0.04)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'shoulder{s}', 'leg', (x, FRONT_Y + 0.03, 0.54), (0.12, 0.15, 0.17), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y + 0.02, 0.58), (x, FRONT_Y + 0.03, 0.3), 0.1, 0.088, blend=0.08)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y + 0.03, 0.3), (x, FRONT_Y, 0.1), 0.088, 0.08, blend=0.04)
        b.ellipsoid(f'fpaw{s}', 'paw', (x, FRONT_Y - 0.05, 0.065), (0.1, 0.12, 0.07), blend=0.04)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.5), (0.12, 0.17, 0.18), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y - 0.02, 0.48), (x, HIND_Y + 0.02, 0.3), 0.1, 0.075, blend=0.06)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y + 0.02, 0.3), (x, HIND_Y + 0.06, 0.16), 0.075, 0.065, blend=0.04)
        b.cone(f'hl_m{s}', 'leg', (x, HIND_Y + 0.06, 0.16), (x, HIND_Y - 0.03, 0.06), 0.065, 0.065, blend=0.04)
        b.ellipsoid(f'hpaw{s}', 'paw', (x, HIND_Y - 0.06, 0.055), (0.09, 0.11, 0.065), blend=0.04)
    b.chain('tail', 'tail', TAIL, [0.045, 0.036, 0.03, 0.028], blend=0.05)
    b.ellipsoid('tip', 'tip', (0, 1.24, 0.7), (0.034, 0.05, 0.05), blend=0.03)
    return b


def _union(shapes):
    def fn(p):
        return np.min(np.stack([f(p) for f in shapes], axis=1), axis=1)
    return fn


def stripes() -> Body:
    """黒いしま: 胴・もも・額・尾を 1.2cm ふくらませた殻を、細い板の集まりで切り出す。"""
    k = Body(floor=0.0)
    grow = 0.012
    for i, (c, r) in enumerate(TORSO):
        k.ellipsoid(f'shell{i}', 'stripe', c, tuple(v + grow for v in r), blend=0.12)
    for s in (1, -1):
        k.ellipsoid(f'thigh{s}', 'stripe', (LEG_X * s, HIND_Y, 0.5), (0.132, 0.182, 0.192), blend=0.1)
        k.ellipsoid(f'shoulder{s}', 'stripe', (LEG_X * s, FRONT_Y + 0.03, 0.54), (0.132, 0.162, 0.182), blend=0.1)
    k.ellipsoid('head', 'stripe', HEAD_CENTER, (0.282, 0.257, 0.257), blend=0.1)
    for i in range(len(TAIL) - 1):
        k.add(Part(f'tail{i}', 'stripe', (lambda a, b, r1, r2: lambda p: sd_round_cone(p, a, b, r1, r2))(
            TAIL[i], TAIL[i + 1], [0.057, 0.048, 0.042, 0.04][i], [0.057, 0.048, 0.042, 0.04][i + 1]), 0.02))
    cuts = []
    # 背中から体の横へ下りるしま（前後に少し傾け、先を細くする）
    for i, y in enumerate(np.linspace(-0.42, 0.5, 9)):
        tilt = 12 if i % 2 else -8
        rot = rotation_matrix((tilt, 0, 0))
        cuts.append((lambda c, rr, m: lambda p: sd_ellipsoid(p, c, rr, m))((0, y, 0.86), (0.42, 0.024, 0.2), rot))
    for s in (1, -1):
        for y in (HIND_Y - 0.06, HIND_Y + 0.07):
            cuts.append((lambda c, rr: lambda p: sd_ellipsoid(p, c, rr))((LEG_X * s + 0.1 * s, y, 0.52), (0.1, 0.02, 0.12)))
    # 額のしま（3本）
    for dx, h in ((0, 0.07), (0.07, 0.05), (-0.07, 0.05)):
        cuts.append((lambda c, rr: lambda p: sd_ellipsoid(p, c, rr))((dx, -0.86, 1.07), (0.018, 0.2, h)))
    # 尾の輪
    for t in (0.72, 0.9, 1.06):
        cuts.append((lambda c, rr: lambda p: sd_ellipsoid(p, c, rr))((0, t, 0.6), (0.2, 0.028, 0.2)))
    k.add(Part('cuts', 'stripe', _union(cuts), 0.012, intersect=True))
    return k


EYES: dict = {}


def build(target_tris: int = 3700, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('tiger_body', b, (-0.5, -1.05, 0.0), (0.5, 1.35, 1.3), 0.014, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    k = stripes()
    stripe_obj = M.body_object('tiger_stripes', k, (-0.5, -1.0, 0.3), (0.5, 1.3, 1.2), 0.011, target_tris=1700)
    M.paint(stripe_obj, k, PALETTE)
    roles = C.new_roles()
    roles['body'] += [obj, stripe_obj]
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.42 * s, -0.85, 0.24), (0.046, 0.058, 0.024))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.87, 0.88), (0, -0.7, 0.72), (0.055, 0.042, 0.03), '#D9707A', sink=0.4,
                   up=(0, -0.6, 0.8))
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        inner = M.decal(f'ear_inner{s}', b, (0.17 * s, -0.66, 1.1), (0.1 * s, -1, 0.15), (0.045, 0.045, 0.015),
                        '#F7E2CF', sink=0.3, segments=10, rings=5)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        back = M.decal(f'ear_back{s}', b, (0.17 * s, -0.64, 1.12), (0.1 * s, 1, 0.2), (0.05, 0.05, 0.015),
                       STRIPE, sink=0.3, segments=10, rings=5)
        roles['rigid'].append((back, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.6 * s, -0.75, -0.25), (0.045, 0.034, 0.014), BLUSH,
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
    # 口の中（暗い色）と、jaw の骨で開くあご
    mouth = M.primitive('sphere', 'mouth', M.look_matrix((0, -0.88, 0.78), (0, -1, -0.2), scale=(0.08, 0.045, 0.05)),
                        segments=10, rings=6)
    M.solid(mouth, '#6B2A2A')
    roles['rigid'].append((mouth, 'head'))
    chin = M.primitive('sphere', 'chin', M.look_matrix((0, -0.86, 0.76), (0, -1, -0.1), scale=(0.09, 0.06, 0.08)),
                       segments=12, rings=7)
    M.solid(chin, WHITE)
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
        BoneSpec('hips', (0, 0.38, 0.64), (0, 0.05, 0.66), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.66), (0, -0.22, 0.68), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.22, 0.68), (0, -0.44, 0.75), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.44, 0.75), (0, -0.6, 0.86), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.6, 0.86), (0, -0.95, 0.88), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.74, 0.8), (0, -0.92, 0.76), 'head'),
        BoneSpec('ear_l', (0.14, -0.66, 1.05), (0.2, -0.66, 1.18), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], (0, 1.28, 0.74), 'tail_3', connect=True),
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
