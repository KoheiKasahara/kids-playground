# tiger から作成した fox の土台を、キツネの個別仕様に書き換えたもの。
"""キツネ: オレンジ色のほっそりした体、白い胸・ほお・口元、とがった大きな耳（裏は黒）、細い鼻先、
黒いくつしたをはいたような脚、先の白いふさふさの大きなしっぽ。

骨の名前と並びは Mesh2Motion のキツネ（CC0）に近いので、座る・遠ぼえ・丸まって眠るをそのまま写せる。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'fox'
ORANGE = '#E8823A'
WHITE = '#FFF7EC'
DARK = '#3B2A26'
PALETTE = {'body': ORANGE, 'head': '#EB8B42', 'chest': WHITE, 'muzzle': WHITE, 'cheek': WHITE, 'ear': ORANGE,
           'leg': ORANGE, 'sock': DARK, 'tail': '#EA8840', 'tip': WHITE}
BLUSH = '#F49AAA'

S = 1.3
LEG_X = 0.075 * S
FRONT_Y = -0.2 * S
HIND_Y = 0.2 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.36 * S), 'mid': (FRONT_Y + 0.04 * S, 0.19 * S), 'low': (FRONT_Y, 0.045 * S),
              'toe': (FRONT_Y - 0.07 * S, 0.015 * S)},
    'hind': {'top': (HIND_Y, 0.36 * S), 'mid': (HIND_Y - 0.06 * S, 0.22 * S), 'low': (HIND_Y + 0.04 * S, 0.08 * S),
             'toe': (HIND_Y - 0.06 * S, 0.015 * S)},
}
HEAD_CENTER = (0, -0.36 * S, 0.53 * S)
TAIL = [(0, 0.3 * S, 0.42 * S), (0, 0.48 * S, 0.37 * S), (0, 0.64 * S, 0.3 * S), (0, 0.76 * S, 0.27 * S)]


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.02, 0.4)), _s((0.12, 0.28, 0.12)))
    b.ellipsoid('chest', 'chest', _s((0, -0.2, 0.39)), _s((0.1, 0.1, 0.12)), blend=0.05 * S)
    b.ellipsoid('neck', 'body', _s((0, -0.27, 0.46)), _s((0.09, 0.09, 0.1)), blend=0.05 * S)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, _s((0.12, 0.11, 0.105)), blend=0.05 * S)
    b.cone('snout', 'muzzle', _s((0, -0.44, 0.5)), _s((0, -0.58, 0.47)), 0.055 * S, 0.024 * S, blend=0.04 * S)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'cheek', _s((0.08 * s, -0.42, 0.49)), _s((0.05, 0.05, 0.045)), blend=0.03 * S)
        b.cone(f'ear{s}', 'ear', _s((0.065 * s, -0.33, 0.6)), _s((0.1 * s, -0.32, 0.76)), 0.05 * S, 0.01 * S,
               blend=0.03 * S)
        x = LEG_X / S * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.cone(f'fl_u{s}', 'leg', _s((x, -0.2, 0.36)), _s((x, -0.18, 0.18)), 0.04 * S, 0.03 * S, blend=0.04 * S)
        b.cone(f'fl_l{s}', 'sock', _s((x, -0.18, 0.18)), _s((x, -0.2, 0.04)), 0.028 * S, 0.026 * S, blend=0.02 * S)
        b.ellipsoid(f'fpaw{s}', 'sock', _s((x, -0.23, 0.02)), _s((0.03, 0.045, 0.022)), blend=0.02 * S)
        b.ellipsoid(f'thigh{s}', 'leg', _s((x, 0.18, 0.32)), _s((0.06, 0.09, 0.1)), blend=0.04 * S)
        b.cone(f'hl_l{s}', 'sock', _s((x, 0.15, 0.22)), _s((x, 0.24, 0.07)), 0.03 * S, 0.026 * S, blend=0.02 * S)
        b.cone(f'hl_m{s}', 'sock', _s((x, 0.24, 0.07)), _s((x, 0.18, 0.02)), 0.026 * S, 0.024 * S, blend=0.02 * S)
    b.chain('tail', 'tail', TAIL, [0.05 * S, 0.085 * S, 0.08 * S, 0.06 * S], blend=0.05 * S)
    b.ellipsoid('tip', 'tip', _s((0, 0.82, 0.26)), _s((0.055, 0.07, 0.055)), blend=0.03 * S)
    return b


EYES: dict = {}


def build(target_tris: int = 3400, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('fox_body', b, _s((-0.25, -0.65, 0.0)), _s((0.25, 0.92, 0.82)), 0.009, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.5 * s, -0.8, 0.25), _s((0.024, 0.032, 0.012)))
    EYES.update(eyes)
    nose = M.decal('nose', b, _s((0, -0.56, 0.475)), (0, -1, 0.2), _s((0.02, 0.016, 0.01)), '#2A1D1A', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        back = M.decal(f'ear_back{s}', b, _s((0.08 * s, -0.32, 0.69)), (0.2 * s, 1, 0.1), _s((0.03, 0.05, 0.008)),
                       DARK, sink=0.3, segments=8, rings=4)
        roles['rigid'].append((back, f'ear_{"l" if s > 0 else "r"}'))
        inner = M.decal(f'ear_inner{s}', b, _s((0.08 * s, -0.33, 0.67)), (0.2 * s, -1, 0.1), _s((0.025, 0.045, 0.008)),
                        WHITE, sink=0.3, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.68 * s, -0.6, -0.3), _s((0.02, 0.015, 0.008)), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), _s((0, 0.2, 0))),
        BoneSpec('hips', _s((0, 0.2, 0.4)), _s((0, 0.02, 0.41)), 'root'),
        BoneSpec('spine_1', _s((0, 0.02, 0.41)), _s((0, -0.12, 0.42)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.12, 0.42)), _s((0, -0.24, 0.45)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.24, 0.45)), _s((0, -0.32, 0.5)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.32, 0.5)), _s((0, -0.58, 0.47)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.06, -0.33, 0.59)), _s((0.1, -0.32, 0.76)), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], _s((0, 0.86, 0.25)), 'tail_3', connect=True),
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
