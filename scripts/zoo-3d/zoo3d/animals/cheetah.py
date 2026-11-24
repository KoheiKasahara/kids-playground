# tiger から作成した cheetah の土台を、チーターの個別仕様に書き換えたもの。
"""チーター: 小さくまるい頭、長くて細い脚、深い胸とくびれた腰、黄色い体に黒い点（デカール）、
目から口へ下りる黒い「なみだのすじ」、白い鼻先・ほお・おなか、先に黒い輪と白い先のある長い尾。

骨格はトラと同じ（あごは jaw の骨で開く）。脚が長いので、関節の位置を高くしている。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'cheetah'
GOLD = '#EDBD5E'
WHITE = '#FBF3E4'
SPOT = '#2E2624'
PALETTE = {
    'body': GOLD, 'leg': '#EFC167', 'head': '#F0C468', 'muzzle': WHITE, 'cheek': '#F7DC9C', 'belly': '#F7E6C1',
    'ear': GOLD, 'paw': '#F2CA7A', 'tail': GOLD, 'tip': WHITE,
}
BLUSH = '#F6A9B8'

LEG_X = 0.14
FRONT_Y = -0.36
HIND_Y = 0.38
JOINTS = {
    'front': {'top': (FRONT_Y + 0.02, 0.72), 'mid': (FRONT_Y + 0.07, 0.4), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.12, 0.03)},
    'hind': {'top': (HIND_Y, 0.7), 'mid': (HIND_Y - 0.1, 0.46), 'low': (HIND_Y + 0.06, 0.2), 'toe': (HIND_Y - 0.1, 0.03)},
}
HEAD_CENTER = (0, -0.68, 1.04)
TAIL = [(0, 0.55, 0.78), (0, 0.8, 0.66), (0, 1.04, 0.56), (0, 1.24, 0.6)]
TORSO = [((0, 0.02, 0.78), (0.19, 0.5, 0.19)), ((0, -0.26, 0.8), (0.2, 0.26, 0.25)), ((0, 0.33, 0.78), (0.18, 0.22, 0.2))]


def body() -> Body:
    b = Body(floor=0.0)
    (c0, r0), (c1, r1), (c2, r2) = TORSO
    b.ellipsoid('torso', 'body', c0, r0)
    b.ellipsoid('chest', 'body', c1, r1, blend=0.12)
    b.ellipsoid('rump', 'body', c2, r2, blend=0.12)
    b.ellipsoid('belly', 'belly', (0, -0.16, 0.64), (0.15, 0.3, 0.1), blend=0.08)
    b.ellipsoid('neck', 'body', (0, -0.5, 0.94), (0.13, 0.17, 0.15), blend=0.1)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.19, 0.18, 0.17), blend=0.08)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.82, 0.98), (0.1, 0.08, 0.075), blend=0.05)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'cheek', (0.12 * s, -0.74, 0.98), (0.08, 0.08, 0.075), rot_deg=(0, 0, 20 * s), blend=0.04)
        b.ellipsoid(f'ear{s}', 'ear', (0.13 * s, -0.62, 1.18), (0.055, 0.03, 0.055), rot_deg=(0, 0, 16 * s), blend=0.03)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'shoulder{s}', 'leg', (x, FRONT_Y + 0.03, 0.66), (0.1, 0.13, 0.16), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y + 0.02, 0.7), (x, FRONT_Y + 0.07, 0.4), 0.075, 0.06, blend=0.07)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y + 0.07, 0.4), (x, FRONT_Y, 0.1), 0.06, 0.05, blend=0.04)
        b.ellipsoid(f'fpaw{s}', 'paw', (x, FRONT_Y - 0.04, 0.055), (0.065, 0.085, 0.055), blend=0.035)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.62), (0.1, 0.15, 0.17), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y - 0.02, 0.6), (x, HIND_Y - 0.08, 0.44), 0.08, 0.06, blend=0.06)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y - 0.08, 0.44), (x, HIND_Y + 0.06, 0.2), 0.06, 0.05, blend=0.04)
        b.cone(f'hl_m{s}', 'leg', (x, HIND_Y + 0.06, 0.2), (x, HIND_Y - 0.03, 0.06), 0.05, 0.05, blend=0.04)
        b.ellipsoid(f'hpaw{s}', 'paw', (x, HIND_Y - 0.06, 0.05), (0.06, 0.08, 0.05), blend=0.035)
    b.chain('tail', 'tail', TAIL, [0.04, 0.034, 0.03, 0.03], blend=0.05)
    b.ellipsoid('tip', 'tip', (0, 1.28, 0.63), (0.034, 0.05, 0.045), blend=0.025)
    return b


EYES: dict = {}


def _spots() -> list[tuple]:
    """黒い点: 胴・肩・もも・脚・尾に散らす（体の中の点から、外へ向けた向き）。"""
    rng = np.random.default_rng(11)
    out = []
    for i in range(42):
        s = 1 if i % 2 else -1
        y = -0.42 + 0.84 * rng.random()
        z = -0.1 + 0.95 * rng.random()
        out.append(((0, y * 0.9, 0.78), (s * (1 - 0.6 * max(0.0, z)), 0.25 * (rng.random() - 0.5), z), 0.02 + 0.01 * rng.random()))
    for s in (1, -1):
        for k in range(5):
            out.append(((LEG_X * s, HIND_Y + 0.04 * (rng.random() - 0.5), 0.62 - 0.08 * k - 0.03 * rng.random()),
                        (s, -0.5 + rng.random(), 0.2 * (rng.random() - 0.5)), 0.018 + 0.006 * rng.random()))
            out.append(((LEG_X * s, FRONT_Y + 0.03, 0.66 - 0.09 * k - 0.03 * rng.random()),
                        (s, -0.5 + rng.random(), 0.2 * (rng.random() - 0.5)), 0.016 + 0.006 * rng.random()))
    # 尾の点と、先の黒い輪
    for y, z in ((0.66, 0.73), (0.78, 0.67), (0.9, 0.62)):
        out.append(((0, y, z), (0.2, 0.1, 1), 0.024))
    return out


def build(target_tris: int = 3300, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('cheetah_body', b, (-0.42, -0.95, 0.0), (0.42, 1.36, 1.3), 0.012, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    # 点はたくさんあるので、1つずつの形を軽くする（三角形数を抑える）
    rng = np.random.default_rng(5)
    for i, (origin, direction, size) in enumerate(_spots()):
        sx = size * (0.85 + 0.3 * rng.random())
        sy = size * (0.8 + 0.3 * rng.random())
        up = (rng.random() - 0.5, rng.random() - 0.5, 1.0)
        roles['decal'].append(M.decal(f'spot{i}', b, origin, direction, (sx, sy, 0.02), SPOT, sink=0.55, up=up,
                                      segments=7, rings=3))
    for y, z in ((1.12, 0.57), (1.2, 0.59)):
        ring = M.primitive('sphere', f'tail_ring{y}', M.look_matrix((0, y, z), (0, 1, 0.1), scale=(0.035, 0.035, 0.02)),
                           segments=10, rings=5)
        M.solid(ring, SPOT)
        roles['decal'].append(ring)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.4 * s, -0.86, 0.26), (0.036, 0.046, 0.02))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.86, 1.0), (0, -0.7, 0.72), (0.04, 0.03, 0.022), '#2A2224', sink=0.4,
                   up=(0, -0.6, 0.8))
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        # なみだのすじ: 目の内側から口の横へ下りる黒い線
        tear = M.decal(f'tear{s}', b, HEAD_CENTER, (0.36 * s, -0.9, -0.05), (0.011, 0.05, 0.008), SPOT, sink=0.45,
                       up=(0.05 * s, 0.15, 1), segments=8, rings=4)
        roles['rigid'].append((tear, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.13 * s, -0.62, 1.17), (0.1 * s, -1, 0.15), (0.032, 0.032, 0.012),
                        '#F7E2CF', sink=0.3, segments=10, rings=5)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        back = M.decal(f'ear_back{s}', b, (0.13 * s, -0.6, 1.18), (0.1 * s, 1, 0.2), (0.035, 0.035, 0.012),
                       SPOT, sink=0.3, segments=10, rings=5)
        roles['rigid'].append((back, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.62 * s, -0.72, -0.22), (0.032, 0.025, 0.012), BLUSH,
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
    # 口の中（暗い色）と、jaw の骨で開くあご
    mouth = M.primitive('sphere', 'mouth', M.look_matrix((0, -0.82, 0.93), (0, -1, -0.2), scale=(0.06, 0.035, 0.04)),
                        segments=10, rings=6)
    M.solid(mouth, '#6B2A2A')
    roles['rigid'].append((mouth, 'head'))
    chin = M.primitive('sphere', 'chin', M.look_matrix((0, -0.81, 0.915), (0, -1, -0.1), scale=(0.065, 0.045, 0.06)),
                       segments=12, rings=7)
    M.solid(chin, WHITE)
    roles['rigid'].append((chin, 'jaw'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.38, 0.76), (0, 0.05, 0.78), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.78), (0, -0.22, 0.8), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.22, 0.8), (0, -0.44, 0.86), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.44, 0.86), (0, -0.58, 0.98), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.58, 0.98), (0, -0.88, 0.98), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.7, 0.93), (0, -0.84, 0.9), 'head'),
        BoneSpec('ear_l', (0.12, -0.62, 1.13), (0.15, -0.62, 1.24), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], (0, 1.32, 0.66), 'tail_3', connect=True),
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
