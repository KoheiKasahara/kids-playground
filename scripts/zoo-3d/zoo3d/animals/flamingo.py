"""フラミンゴ: ピンクの小さな体、S字に曲がった長い首、細く長い脚（関節は後ろへ曲がる）、曲がったくちばし。

二足・鳥の体型（`bodyplan.Config(plan='biped')`）。首は3本の骨で S 字を作る。
翼は wing_l / wing_r の骨に固定した別の部品（たたむと体の横、広げると先の黒い羽が見える）。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'flamingo'
PINK = '#F59AB2'
PALE = '#F8B8C8'
PALETTE = {'body': PINK, 'neck': PINK, 'head': PALE, 'tail': '#EE8AA5', 'leg': '#EF8FA6', 'foot': '#E87F98',
           'beak': '#FBEDE2', 'beak_tip': '#2C2830'}
BLUSH = '#F17C9C'

LEG_X = 0.075
NECK = [(0, -0.13, 0.93), (0, -0.21, 1.08), (0, -0.15, 1.24), (0, -0.2, 1.38)]
HEAD_CENTER = (0, -0.25, 1.45)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('body', 'body', (0, 0.04, 0.88), (0.14, 0.25, 0.14))
    b.ellipsoid('breast', 'body', (0, -0.09, 0.9), (0.11, 0.12, 0.11), blend=0.08)
    b.cone('tail', 'tail', (0, 0.22, 0.9), (0, 0.33, 0.88), 0.07, 0.03, blend=0.06)
    b.chain('neck', 'neck', NECK, [0.048, 0.04, 0.036, 0.036], blend=0.07)
    b.ellipsoid('head', 'head', HEAD_CENTER, (0.074, 0.088, 0.07), blend=0.04)
    b.cone('beak', 'beak', (0, -0.31, 1.45), (0, -0.39, 1.41), 0.034, 0.025, blend=0.02)
    b.cone('beak_tip', 'beak_tip', (0, -0.39, 1.41), (0, -0.405, 1.33), 0.025, 0.01, blend=0.01)
    for s in (1, -1):
        x = LEG_X * s
        b.ellipsoid(f'thigh{s}', 'body', (x, 0.04, 0.8), (0.05, 0.07, 0.07), blend=0.05)
        b.cone(f'shin{s}', 'leg', (x, 0.03, 0.78), (x, 0.15, 0.42), 0.02, 0.016, blend=0.03)
        b.ellipsoid(f'knee{s}', 'leg', (x, 0.15, 0.42), (0.022, 0.024, 0.026), blend=0.015)
        b.cone(f'tarsus{s}', 'leg', (x, 0.15, 0.42), (x, 0.0, 0.06), 0.016, 0.014, blend=0.015)
        b.ellipsoid(f'foot{s}', 'foot', (x, -0.05, 0.016), (0.045, 0.07, 0.016), blend=0.02)
    return b


def wing(side: int):
    """たたんだ翼（体の横に沿う平たい楕円）と、先の黒い羽。"""
    lr = 'l' if side > 0 else 'r'
    w = M.primitive('sphere', f'wing_{lr}', M.look_matrix((0.12 * side, 0.08, 0.92), (side, 0.0, 0.25),
                    up=(0, 1, 0.1), scale=(0.07, 0.2, 0.03)), segments=14, rings=8)
    M.solid(w, '#F27E9F')
    tip = M.primitive('sphere', f'wing_tip_{lr}', M.look_matrix((0.125 * side, 0.24, 0.9), (side, 0.0, 0.25),
                      up=(0, 1, 0.1), scale=(0.045, 0.07, 0.025)), segments=10, rings=6)
    M.solid(tip, '#2C2830')
    return w, tip


EYES: dict = {}


def build(target_tris: int = 3200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('flamingo_body', b, (-0.25, -0.45, 0.0), (0.25, 0.42, 1.55), 0.008, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.7 * s, -0.55, 0.3), (0.02, 0.025, 0.011))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.75 * s, -0.55, -0.3), (0.018, 0.014, 0.007), BLUSH, sink=0.5,
                        segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        w, tip = wing(s)
        bone = f'wing_{"l" if s > 0 else "r"}'
        roles['rigid'] += [(w, bone), (tip, bone)]
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.02)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.2, 0)),
        BoneSpec('hips', (0, 0.06, 0.8), (0, 0.0, 0.9), 'root'),
        BoneSpec('spine_1', (0, 0.0, 0.9), (0, -0.07, 0.91), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.07, 0.91), (0, -0.13, 0.93), 'spine_1', connect=True),
        BoneSpec('neck_1', NECK[0], NECK[1], 'spine_2', connect=True),
        BoneSpec('neck_2', NECK[1], NECK[2], 'neck_1', connect=True),
        BoneSpec('neck_3', NECK[2], NECK[3], 'neck_2', connect=True),
        BoneSpec('head', NECK[3], (0, -0.4, 1.42), 'neck_3', connect=True),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.2, 0.9), (0, 0.33, 0.88), 'hips'),
        BoneSpec('wing_l', (0.1, -0.06, 0.95), (0.13, 0.22, 0.9), 'spine_1'),
        BoneSpec('leg_upper_l', (x, 0.04, 0.8), (x, 0.15, 0.42), 'hips'),
        BoneSpec('leg_lower_l', (x, 0.15, 0.42), (x, 0.0, 0.06), 'leg_upper_l', connect=True),
        BoneSpec('leg_foot_l', (x, 0.0, 0.06), (x, -0.11, 0.015), 'leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck_1', 'neck_2', 'neck_3', 'head', 'tail_1'] + \
    [f'leg_{q}_{s}' for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
