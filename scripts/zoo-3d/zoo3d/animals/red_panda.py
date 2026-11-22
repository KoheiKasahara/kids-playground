# panda から作成した red_panda の土台を、レッサーパンダの個別仕様に書き換えたもの。
"""レッサーパンダ: 赤茶色の体、白い顔の模様（ほお・まゆ・耳のふち）と目の下の赤茶のすじ、黒茶色の脚とおなか、
しま模様のある長くふさふさのしっぽ。

しっぽの輪は、しっぽを少しふくらませた殻を板で切り出した別の形にする（トラのしまと同じ作り方）。
右前足の掌に、竹を持つ骨 hold_r（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body, Part, sd_ellipsoid, sd_round_cone

NAME = 'red_panda'
RED = '#C95B2C'
WHITE = '#FFF6EA'
DARK = '#4C2B22'
PALETTE = {'body': RED, 'head': '#CF6533', 'muzzle': WHITE, 'cheek': WHITE, 'ear': RED, 'leg': DARK, 'belly': DARK,
           'tail': '#D7743C', 'ring': '#8E3C1E'}
BLUSH = '#F49AAB'

S = 1.3
LEG_X = 0.1 * S
FRONT_Y = -0.17 * S
HIND_Y = 0.17 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.33 * S), 'mid': (FRONT_Y + 0.05 * S, 0.18 * S), 'low': (FRONT_Y, 0.045 * S),
              'toe': (FRONT_Y - 0.07 * S, 0.015 * S)},
    'hind': {'top': (HIND_Y, 0.33 * S), 'mid': (HIND_Y - 0.06 * S, 0.18 * S), 'low': (HIND_Y + 0.02 * S, 0.045 * S),
             'toe': (HIND_Y - 0.07 * S, 0.015 * S)},
}
HEAD_CENTER = (0, -0.3 * S, 0.47 * S)
TAIL = [(0, 0.26 * S, 0.37 * S), (0, 0.46 * S, 0.37 * S), (0, 0.64 * S, 0.33 * S), (0, 0.8 * S, 0.3 * S)]
TAIL_R = [0.06 * S, 0.075 * S, 0.07 * S, 0.055 * S]


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.02, 0.35)), _s((0.15, 0.25, 0.155)))
    b.ellipsoid('belly', 'belly', _s((0, -0.02, 0.24)), _s((0.12, 0.2, 0.08)), blend=0.05 * S)
    b.ellipsoid('chest', 'body', _s((0, -0.16, 0.37)), _s((0.14, 0.11, 0.14)), blend=0.06 * S)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, _s((0.14, 0.12, 0.12)), blend=0.06 * S)
    b.ellipsoid('muzzle', 'muzzle', _s((0, -0.41, 0.44)), _s((0.06, 0.05, 0.045)), blend=0.03 * S)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'cheek', _s((0.08 * s, -0.37, 0.44)), _s((0.06, 0.05, 0.05)), blend=0.03 * S)
        b.ellipsoid(f'ear{s}', 'ear', _s((0.11 * s, -0.27, 0.6)), _s((0.055, 0.025, 0.055)), rot_deg=(0, 25 * s, 0),
                    blend=0.025 * S)
        x = LEG_X / S * s
        for key, y in (('f', -0.17), ('h', 0.17)):
            b.cone(f'{key}leg{s}', 'leg', _s((x, y, 0.32)), _s((x, y, 0.05)), 0.06 * S, 0.048 * S, blend=0.05 * S)
            b.ellipsoid(f'{key}paw{s}', 'leg', _s((x, y - 0.04, 0.025)), _s((0.045, 0.06, 0.028)), blend=0.03 * S)
    b.chain('tail', 'tail', TAIL, TAIL_R, blend=0.05 * S)
    return b


def rings() -> Body:
    """しっぽの濃い輪: しっぽを 1cm ふくらませた殻を、しっぽに直交する板で切り出す。"""
    k = Body()
    for i in range(len(TAIL) - 1):
        k.add(Part(f'shell{i}', 'ring', (lambda a, bb, r1, r2: lambda p: sd_round_cone(p, a, bb, r1, r2))(
            TAIL[i], TAIL[i + 1], TAIL_R[i] + 0.01 * S, TAIL_R[i + 1] + 0.01 * S), 0.02))
    cuts = [(lambda c: lambda p: sd_ellipsoid(p, c, (0.2 * S, 0.028 * S, 0.2 * S)))((0, y * S, 0.35 * S))
            for y in (0.42, 0.56, 0.7, 0.83)]
    k.add(Part('cuts', 'ring', lambda p: np.min(np.stack([f(p) for f in cuts], axis=1), axis=1), 0.01,
               intersect=True))
    return k


EYES: dict = {}


def build(target_tris: int = 3400, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('red_panda_body', b, _s((-0.25, -0.5, 0.0)), _s((0.25, 0.92, 0.72)), 0.009,
                        target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    k = rings()
    ring_obj = M.body_object('red_panda_rings', k, _s((-0.15, 0.3, 0.15)), _s((0.15, 0.92, 0.5)), 0.008,
                             target_tris=700)
    M.paint(ring_obj, k, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    roles['decal'].append(ring_obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.5 * s, -0.8, 0.2), _s((0.025, 0.031, 0.013)))
    EYES.update(eyes)
    nose = M.decal('nose', b, _s((0, -0.44, 0.45)), (0, -1, 0.25), _s((0.022, 0.016, 0.01)), '#2A1D1A', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        # まゆの白い点、目の下から口へ下りる赤茶のすじ、耳の白いふち
        brow = M.decal(f'brow{s}', b, HEAD_CENTER, (0.42 * s, -0.75, 0.5), _s((0.025, 0.018, 0.008)), WHITE,
                       sink=0.4, segments=8, rings=4)
        roles['rigid'].append((brow, 'head'))
        tear = M.decal(f'tear{s}', b, HEAD_CENTER, (0.55 * s, -0.78, -0.1), _s((0.016, 0.04, 0.008)), '#9C3F1F',
                       sink=0.3, up=(0.4 * s, 0, 1), segments=8, rings=4)
        roles['rigid'].append((tear, 'head'))
        rim = M.decal(f'ear_rim{s}', b, _s((0.11 * s, -0.27, 0.6)), (0.2 * s, -1, 0.1), _s((0.045, 0.045, 0.008)),
                      WHITE, sink=0.3, segments=10, rings=5)
        roles['rigid'].append((rim, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.65 * s, -0.65, -0.3), _s((0.02, 0.015, 0.008)), BLUSH,
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
        BoneSpec('hips', _s((0, 0.17, 0.36)), _s((0, 0.02, 0.37)), 'root'),
        BoneSpec('spine_1', _s((0, 0.02, 0.37)), _s((0, -0.1, 0.38)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.1, 0.38)), _s((0, -0.2, 0.41)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.2, 0.41)), _s((0, -0.26, 0.45)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.26, 0.45)), _s((0, -0.45, 0.45)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.09, -0.27, 0.56)), _s((0.13, -0.27, 0.64)), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, FRONT_Y - 0.05 * S, 0.03 * S), (x, FRONT_Y - 0.1 * S, 0.03 * S), 'front_leg_foot_l',
                 deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2', 'tail_3'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
