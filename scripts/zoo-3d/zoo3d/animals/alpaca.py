# deer から作成した alpaca の土台を、アルパカの個別仕様に書き換えたもの。
"""アルパカ: 小さな玉を重ねた もこもこの毛（胴・首・頭のてっぺん）、まっすぐ上へのびる長い首、
小さな顔と短い鼻先、バナナのように立った耳、細い脚と黒いひづめ。毛の色は やわらかい うす茶色。

もこもこはヒツジと同じ作り方（胴・首の表面に小さな玉を並べ、少しだけなめらかにつなぐ）。骨格はシカと同じ。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'alpaca'
WOOL = '#DDBB8C'
PALETTE = {'wool': WOOL, 'body': WOOL, 'neck': WOOL, 'head': '#E9D0AA', 'muzzle': '#F4E6D0', 'ear': '#D8B486',
           'leg': '#D9BA8F', 'hoof': '#4A3A33', 'tail': WOOL, 'topknot': '#E7CBA0'}
BLUSH = '#F2A4B2'

LEG_X = 0.12
FRONT_Y = -0.3
HIND_Y = 0.32
JOINTS = {
    'front': {'top': (FRONT_Y, 0.78), 'mid': (FRONT_Y - 0.05, 0.42), 'low': (FRONT_Y, 0.1), 'toe': (FRONT_Y - 0.08, 0.025)},
    'hind': {'top': (HIND_Y, 0.78), 'mid': (HIND_Y + 0.07, 0.4), 'low': (HIND_Y, 0.1), 'toe': (HIND_Y - 0.08, 0.025)},
}
NECK = [(0, -0.34, 0.92), (0, -0.42, 1.18), (0, -0.47, 1.4)]
HEAD_CENTER = (0, -0.53, 1.47)
TORSO = ((0, 0.0, 0.86), (0.22, 0.4, 0.2))


def _fib(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    theta = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


def body() -> Body:
    b = Body(floor=0.0)
    c, r = TORSO
    b.ellipsoid('core', 'wool', c, r)
    # もこもこ: 胴の表面に小さな玉を並べる（おなかの下は省く）
    for i, d in enumerate(_fib(34)):
        if d[2] < -0.5:
            continue
        p = np.asarray(c) + d * np.asarray(r) * 0.9
        size = 0.075 + 0.018 * ((i * 7) % 3) / 2
        b.ellipsoid(f'puff{i}', 'wool', tuple(p), (size, size, size), blend=0.03)
    b.chain('neck', 'neck', NECK, [0.12, 0.105, 0.095], blend=0.08)
    # 首のもこもこ（前と横に玉を並べる）
    for k in range(4):
        t = k / 3
        p = np.asarray(NECK[0]) * (1 - t) + np.asarray(NECK[2]) * t
        for sx, sy in ((0, -1), (1, -0.3), (-1, -0.3)):
            b.ellipsoid(f'neckpuff{k}{sx}', 'neck', (p[0] + 0.07 * sx, p[1] + 0.07 * sy, p[2]), (0.06, 0.06, 0.06), blend=0.03)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, (0.105, 0.12, 0.1), blend=0.05)
    b.ellipsoid('snout', 'head', (0, -0.65, 1.42), (0.07, 0.08, 0.065), blend=0.05)
    b.ellipsoid('muzzle', 'muzzle', (0, -0.71, 1.4), (0.055, 0.04, 0.05), blend=0.03)
    # 頭のてっぺんの ふわふわの毛
    for k, (dx, dy, dz) in enumerate(((0, 0.0, 0.1), (0.055, 0.02, 0.085), (-0.055, 0.02, 0.085), (0, 0.06, 0.08), (0, -0.05, 0.08))):
        b.ellipsoid(f'topknot{k}', 'topknot', (dx, HEAD_CENTER[1] + dy, HEAD_CENTER[2] + dz), (0.055, 0.055, 0.05), blend=0.03)
    for s in (1, -1):
        # バナナのように立った耳
        b.ellipsoid(f'ear{s}', 'ear', (0.075 * s, -0.49, 1.62), (0.026, 0.022, 0.075), rot_deg=(8, 0, -12 * s), blend=0.025)
        x = LEG_X * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.ellipsoid(f'arm{s}', 'wool', (x, FRONT_Y + 0.02, 0.72), (0.085, 0.1, 0.15), blend=0.07)
        b.cone(f'fl_u{s}', 'leg', (x, FRONT_Y, 0.72), (x, *f['mid']), 0.06, 0.04, blend=0.05)
        b.cone(f'fl_l{s}', 'leg', (x, *f['mid']), (x, *f['low']), 0.036, 0.032, blend=0.02)
        b.ellipsoid(f'fhoof{s}', 'hoof', (x, FRONT_Y - 0.015, 0.045), (0.038, 0.048, 0.045), blend=0.02)
        b.ellipsoid(f'thigh{s}', 'wool', (x, HIND_Y, 0.72), (0.095, 0.13, 0.17), blend=0.07)
        b.cone(f'hl_u{s}', 'leg', (x, HIND_Y, 0.72), (x, *h['mid']), 0.065, 0.04, blend=0.05)
        b.cone(f'hl_l{s}', 'leg', (x, *h['mid']), (x, *h['low']), 0.036, 0.032, blend=0.02)
        b.ellipsoid(f'hhoof{s}', 'hoof', (x, HIND_Y - 0.015, 0.045), (0.038, 0.048, 0.045), blend=0.02)
    b.ellipsoid('tail', 'tail', (0, 0.42, 0.9), (0.06, 0.06, 0.08), blend=0.03)
    return b


EYES: dict = {}


def build(target_tris: int = 4200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('alpaca_body', b, (-0.36, -0.85, 0.0), (0.36, 0.56, 1.78), 0.011, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.62 * s, -0.7, 0.25), (0.034, 0.044, 0.018))
    EYES.update(eyes)
    nose = M.decal('nose', b, (0, -0.72, 1.42), (0, -1, 0.2), (0.022, 0.014, 0.009), '#5A4235', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    mouth = M.decal('mouth', b, (0, -0.71, 1.38), (0, -1, -0.35), (0.02, 0.005, 0.006), '#9A7A62', sink=0.4,
                    segments=8, rings=4)
    roles['rigid'].append((mouth, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, (0, -0.63, 1.43), (0.85 * s, -0.4, -0.15), (0.028, 0.02, 0.01), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        inner = M.decal(f'ear_inner{s}', b, (0.075 * s, -0.49, 1.63), (0.3 * s, -1, 0.1), (0.014, 0.05, 0.008),
                        '#D9B48E', sink=0.3, segments=8, rings=4)
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
        BoneSpec('hips', (0, 0.32, 0.86), (0, 0.03, 0.87), 'root'),
        BoneSpec('spine_1', (0, 0.03, 0.87), (0, -0.16, 0.88), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.16, 0.88), (0, -0.36, 0.88), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('head', NECK[-1], (0, -0.73, 1.41), 'neck_2', connect=True),
        BoneSpec('ear_l', (0.065, -0.49, 1.56), (0.085, -0.48, 1.69), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.38, 0.92), (0, 0.46, 0.88), 'hips'),
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
