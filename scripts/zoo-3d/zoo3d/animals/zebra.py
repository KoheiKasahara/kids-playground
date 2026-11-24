# giraffe から作成した zebra の土台を、シマウマの個別仕様に書き換えたもの。
"""シマウマ: 馬の体型に白黒のしま、立った短いたてがみ、黒い鼻先、先に房のある尾、黒いひづめ。

しま模様はトラと同じく、体を少しふくらませた殻を細い板（楕円体）で切り出した別の形にする。
胴は縦じま、首は首の向きに直交する輪、脚は横じま、おしりは斜めのしまにする。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body, Part, rotation_matrix, sd_ellipsoid, sd_round_cone

NAME = 'zebra'
WHITE = '#F8F6F0'
BLACK = '#2B2B33'
PALETTE = {
    'body': WHITE, 'leg': WHITE, 'neck': WHITE, 'head': WHITE, 'muzzle': '#3A3A44', 'hoof': '#3B3036',
    'mane': WHITE, 'mane_dark': BLACK, 'ear': WHITE, 'tail': WHITE, 'tuft': BLACK, 'stripe': BLACK,
}
BLUSH = '#F6AFC1'

LEG_X = 0.17
FRONT_Y = -0.36
HIND_Y = 0.4
JOINTS = {
    'front': {'top': (FRONT_Y, 0.98), 'mid': (FRONT_Y - 0.07, 0.52), 'low': (FRONT_Y, 0.13), 'toe': (FRONT_Y - 0.11, 0.03)},
    'hind': {'top': (HIND_Y, 0.98), 'mid': (HIND_Y + 0.08, 0.5), 'low': (HIND_Y, 0.13), 'toe': (HIND_Y - 0.11, 0.03)},
}
NECK = [(0, -0.44, 1.16), (0, -0.57, 1.4), (0, -0.66, 1.6)]
HEAD_CENTER = (0, -0.76, 1.66)
TAIL = [(0, 0.62, 1.08), (0, 0.7, 0.84), (0, 0.72, 0.64)]
TORSO = [((0, 0.0, 1.0), (0.27, 0.55, 0.29)), ((0, -0.3, 1.04), (0.26, 0.3, 0.31)), ((0, 0.36, 1.0), (0.26, 0.28, 0.29))]


def body() -> Body:
    b = Body(floor=0.0)
    (c0, r0), (c1, r1), (c2, r2) = TORSO
    b.ellipsoid('torso', 'body', c0, r0)
    b.ellipsoid('chest', 'body', c1, r1, blend=0.14)
    b.ellipsoid('rump', 'body', c2, r2, blend=0.14)
    b.chain('neck', 'neck', NECK, [0.17, 0.135, 0.12], blend=0.13)
    # 立った短いたてがみ（白黒を交互に）
    for i, t in enumerate(np.linspace(0, 1, 7)):
        p = np.asarray(NECK[0]) * (1 - t) + np.asarray(NECK[-1]) * t + np.array([0, 0.11, 0.1 + 0.03 * t])
        b.ellipsoid(f'mane{i}', 'mane_dark' if i % 2 else 'mane', tuple(p + np.array([0, -0.03 * t, 0.04])),
                    (0.042, 0.07, 0.1), rot_deg=(-30, 0, 0), blend=0.03)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.17, 0.2, 0.18), blend=0.08)
    b.ellipsoid('snout', 'head', (0, -0.98, 1.57), (0.13, 0.17, 0.12), blend=0.1)
    b.ellipsoid('muzzle', 'muzzle', (0, -1.1, 1.53), (0.11, 0.085, 0.1), blend=0.05)
    for s in (1, -1):
        b.cone(f'ear{s}', 'ear', (0.085 * s, -0.7, 1.79), (0.15 * s, -0.68, 1.98), 0.055, 0.02, blend=0.04)
    for s in (1, -1):
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.ellipsoid(f'arm{s}', 'leg', (x, FRONT_Y + 0.02, 0.86), (0.11, 0.15, 0.2), blend=0.1)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 0.98), (x, FRONT_Y - 0.03, 0.52), 0.1, 0.07, blend=0.08)
        b.ellipsoid(f'fknee{s}', 'leg', (x, FRONT_Y - 0.03, 0.52), (0.065, 0.07, 0.075), blend=0.04)
        b.cone(f'fl_l{s}', 'leg', (x, FRONT_Y - 0.03, 0.52), (x, *f['low']), 0.06, 0.056, blend=0.04)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.02, 0.065), (0.075, 0.085, 0.07), blend=0.02)
        b.ellipsoid(f'thigh{s}', 'leg', (x, HIND_Y, 0.86), (0.12, 0.19, 0.22), blend=0.1)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.98), (x, HIND_Y + 0.05, 0.5), 0.1, 0.07, blend=0.08)
        b.ellipsoid(f'hock{s}', 'leg', (x, HIND_Y + 0.05, 0.5), (0.062, 0.075, 0.07), blend=0.04)
        b.cone(f'hl_l{s}', 'leg', (x, HIND_Y + 0.05, 0.5), (x, *h['low']), 0.058, 0.055, blend=0.04)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.02, 0.065), (0.074, 0.084, 0.07), blend=0.02)
    b.chain('tail', 'tail', TAIL, [0.035, 0.027, 0.022], blend=0.05)
    b.ellipsoid('tuft', 'tuft', (0, 0.72, 0.55), (0.05, 0.05, 0.11), blend=0.02)
    return b


def _ell(c, r, rot=None):
    return lambda p: sd_ellipsoid(p, c, r, rot)


def _cone(a, b, r1, r2):
    return lambda p: sd_round_cone(p, a, b, r1, r2)


def stripes() -> Body:
    """黒いしま: 胴・首・頭・脚を 1.2cm ふくらませた殻を、細い板の集まりで切り出す。"""
    k = Body(floor=0.0)
    g = 0.012
    for i, (c, r) in enumerate(TORSO):
        k.ellipsoid(f'shell{i}', 'stripe', c, tuple(v + g for v in r), blend=0.14)
    radii = [0.17, 0.135, 0.12]
    for i in range(len(NECK) - 1):
        k.add(Part(f'neck{i}', 'stripe', _cone(NECK[i], NECK[i + 1], radii[i] + g, radii[i + 1] + g), 0.13 if i == 0 else 0.02))
    k.ellipsoid('cranium', 'stripe', HEAD_CENTER, (0.17 + g, 0.2 + g, 0.18 + g), blend=0.08)
    k.ellipsoid('snout', 'stripe', (0, -0.98, 1.57), (0.13 + g, 0.17 + g, 0.12 + g), blend=0.1)
    for s in (1, -1):
        x = LEG_X * s
        k.ellipsoid(f'arm{s}', 'stripe', (x, FRONT_Y + 0.02, 0.86), (0.11 + g, 0.15 + g, 0.2 + g), blend=0.1)
        k.add(Part(f'fl_u{s}', 'stripe', _cone((x, FRONT_Y, 0.98), (x, FRONT_Y - 0.03, 0.52), 0.1 + g, 0.07 + g), 0.08))
        k.add(Part(f'fl_l{s}', 'stripe', _cone((x, FRONT_Y - 0.03, 0.52), (x, FRONT_Y, 0.2), 0.06 + g, 0.056 + g), 0.04))
        k.ellipsoid(f'thigh{s}', 'stripe', (x, HIND_Y, 0.86), (0.12 + g, 0.19 + g, 0.22 + g), blend=0.1)
        k.add(Part(f'hl_u{s}', 'stripe', _cone((x, HIND_Y, 0.98), (x, HIND_Y + 0.05, 0.5), 0.1 + g, 0.07 + g), 0.08))
        k.add(Part(f'hl_l{s}', 'stripe', _cone((x, HIND_Y + 0.05, 0.5), (x, HIND_Y, 0.2), 0.058 + g, 0.055 + g), 0.04))
    cuts = []
    # 胴の縦じま（背中から下へ、少し前へ傾ける）
    for i, y in enumerate(np.linspace(-0.4, 0.2, 6)):
        cuts.append(_ell((0, y, 1.06), (0.42, 0.028, 0.36), rotation_matrix((10 + 4 * (i % 2), 0, 0))))
    # おしりの斜めじま
    for i, y in enumerate((0.34, 0.46, 0.58)):
        cuts.append(_ell((0, y, 1.08), (0.42, 0.026, 0.34), rotation_matrix((-38 - 8 * i, 0, 0))))
    # 首の輪（首の向きに直交）
    for t in (0.5, 0.72, 0.93):
        p = np.asarray(NECK[0]) * (1 - t) + np.asarray(NECK[-1]) * t
        cuts.append(_ell(tuple(p), (0.19, 0.19, 0.024), rotation_matrix((28, 0, 0))))
    # 顔のしま（額から鼻へ）
    for y in (-0.7, -0.82, -0.94):
        cuts.append(_ell((0, y, 1.7), (0.3, 0.02, 0.3), rotation_matrix((25, 0, 0))))
    # 脚の横じま
    for z in (0.26, 0.38, 0.5, 0.62, 0.76):
        cuts.append(_ell((0, FRONT_Y, z), (0.4, 0.2, 0.022)))
        cuts.append(_ell((0, HIND_Y, z), (0.4, 0.25, 0.022)))
    k.add(Part('cuts', 'stripe', _union(cuts), 0.01, intersect=True))
    return k


def _union(shapes):
    def fn(p):
        return np.min(np.stack([f(p) for f in shapes], axis=1), axis=1)
    return fn


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('zebra_body', b, (-0.5, -1.25, 0.0), (0.5, 0.95, 2.1), 0.014, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    k = stripes()
    stripe_obj = M.body_object('zebra_stripes', k, (-0.45, -1.2, 0.15), (0.45, 0.8, 2.0), 0.011, target_tris=2600)
    M.paint(stripe_obj, k, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    # しまは細かい島の集まりで熱拡散のウェイトが解けないため、すぐ下の体の頂点からウェイトを写す
    roles['decal'].append(stripe_obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.55 * s, -0.75, 0.32), (0.05, 0.062, 0.026))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.95, 1.58), (0.8 * s, -0.4, -0.1), (0.045, 0.032, 0.014), BLUSH,
                        sink=0.5, segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
        nostril = M.decal(f'nostril{s}', b, (0, -1.08, 1.54), (0.35 * s, -1, 0.15), (0.022, 0.016, 0.01), '#1A1A20',
                          sink=0.5, segments=8, rings=4)
        roles['rigid'].append((nostril, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.11 * s, -0.7, 1.86), (0.15 * s, -1, 0.1), (0.028, 0.06, 0.012),
                        '#F3C6CF', sink=0.4, segments=10, rings=5)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.05)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.35, 0)),
        BoneSpec('hips', (0, 0.4, 1.0), (0, 0.05, 1.02), 'root'),
        BoneSpec('spine_1', (0, 0.05, 1.02), (0, -0.2, 1.05), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.2, 1.05), (0, -0.44, 1.16), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('head', NECK[-1], (0, -1.1, 1.55), 'neck_2', connect=True),
        BoneSpec('ear_l', (0.085, -0.7, 1.79), (0.15, -0.68, 1.98), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], (0, 0.72, 0.45), 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2',
              'tail_3'] + [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot')
                           for s in ('l', 'r')]
