# flamingo から作成した ostrich の土台を、ダチョウの個別仕様に書き換えたもの。
"""ダチョウ: 黒いふわふわの大きな体、白い羽（翼としっぽ）、長くてはだかの首、小さな頭と大きな目、平たいくちばし、
太くて長い脚（関節は後ろへ曲がる）。

二足・鳥の体型（`bodyplan.Config(plan='biped')`）。首は3本の骨。
ふわふわの体は、胴の表面に小さな玉を並べた形（ヒツジのもこもこと同じ作り方）。
翼は wing_l / wing_r の骨に固定した白い羽の部品。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'ostrich'
BLACK = '#3A3436'
SKIN = '#E3B9AE'
PALETTE = {'body': BLACK, 'neck': SKIN, 'head': '#E8C1B5', 'beak': '#EBCB9D', 'leg': '#E0AE9F', 'thigh': '#E0AE9F',
           'foot': '#C99487', 'tail': '#FAF6EE'}
BLUSH = '#F38FA6'

LEG_X = 0.13
NECK = [(0, -0.26, 1.28), (0, -0.33, 1.56), (0, -0.31, 1.82), (0, -0.36, 1.98)]
HEAD_CENTER = (0, -0.42, 2.03)
TORSO = ((0, 0.05, 1.15), (0.3, 0.4, 0.27))


def _fib(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    theta = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


def body() -> Body:
    b = Body(floor=0.0)
    c, r = TORSO
    b.ellipsoid('torso', 'body', c, r)
    for i, d in enumerate(_fib(30)):
        if d[2] < -0.4:
            continue
        p = np.asarray(c) + d * np.asarray(r) * 0.9
        b.ellipsoid(f'fluff{i}', 'body', tuple(p), (0.08, 0.08, 0.08), blend=0.04)
    b.ellipsoid('tail', 'tail', (0, 0.42, 1.25), (0.16, 0.12, 0.13), blend=0.06)
    b.chain('neck', 'neck', NECK, [0.075, 0.055, 0.048, 0.045], blend=0.08)
    b.ellipsoid('head', 'head', HEAD_CENTER, (0.09, 0.11, 0.085), blend=0.04)
    b.ellipsoid('beak', 'beak', (0, -0.54, 2.0), (0.055, 0.075, 0.025), blend=0.03)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'thigh{s}', 'thigh', (x, 0.08, 0.86), (0.08, 0.1, 0.16), blend=0.06)
        b.cone(f'shin{s}', 'leg', (x, 0.1, 0.8), (x, 0.2, 0.55), 0.07, 0.05, blend=0.05)
        b.ellipsoid(f'knee{s}', 'leg', (x, 0.2, 0.55), (0.048, 0.05, 0.05), blend=0.02)
        b.cone(f'tarsus{s}', 'leg', (x, 0.2, 0.55), (x, 0.02, 0.07), 0.045, 0.04, blend=0.02)
        b.ellipsoid(f'foot{s}', 'foot', (x, -0.06, 0.03), (0.06, 0.11, 0.03), blend=0.03)
    return b


def wing(side: int):
    lr = 'l' if side > 0 else 'r'
    w = M.primitive('sphere', f'wing_{lr}', M.look_matrix((0.28 * side, 0.12, 1.2), (side, 0.15, 0.3),
                    up=(0, 1, 0.2), scale=(0.12, 0.26, 0.05)), segments=14, rings=8)
    M.solid(w, '#FAF6EE')
    return w


EYES: dict = {}


def build(target_tris: int = 4200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('ostrich_body', b, (-0.45, -0.65, 0.0), (0.45, 0.6, 2.2), 0.012, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.65 * s, -0.55, 0.3), (0.032, 0.04, 0.016))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.75 * s, -0.5, -0.3), (0.022, 0.016, 0.008), BLUSH, sink=0.5,
                        segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        roles['rigid'].append((wing(s), f'wing_{"l" if s > 0 else "r"}'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.1, 1.0), (0, 0.0, 1.15), 'root'),
        BoneSpec('spine_1', (0, 0.0, 1.15), (0, -0.14, 1.2), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.14, 1.2), (0, -0.26, 1.28), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('neck_3', NECK[2], NECK[3], 'neck_2', connect=True),
        BoneSpec('head', NECK[3], (0, -0.6, 2.0), 'neck_3', connect=True),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.36, 1.22), (0, 0.52, 1.26), 'hips'),
        BoneSpec('wing_l', (0.22, -0.08, 1.24), (0.32, 0.32, 1.16), 'spine_1'),
        BoneSpec('leg_upper_l', (x, 0.06, 1.0), (x, 0.2, 0.55), 'hips'),
        BoneSpec('leg_lower_l', (x, 0.2, 0.55), (x, 0.02, 0.07), 'leg_upper_l', connect=True),
        BoneSpec('leg_foot_l', (x, 0.02, 0.07), (x, -0.15, 0.02), 'leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'neck_3', 'head', 'tail_1'] + \
    [f'leg_{q}_{s}' for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
