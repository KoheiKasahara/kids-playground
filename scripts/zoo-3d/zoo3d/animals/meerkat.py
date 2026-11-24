# red_panda から作成した meerkat の土台を、ミーアキャットの個別仕様に書き換えたもの。
"""ミーアキャット: ほっそりした うす茶色の体と明るいおなか、目のまわりの黒い もよう（サングラスのよう）、
小さくまるい黒い耳、とがった鼻先と黒い鼻、細く長いしっぽ（先が黒い）、細い脚。
後ろ足で立って見はりをするので、前足の掌に物を持つ骨 hold_l / hold_r を置く（レッサーパンダと同じ骨格）。

ゲームで見分けやすいよう、実物より大きめにしている（S）。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'meerkat'
TAN = '#CBA77B'
CREAM = '#F1E1C4'
DARK = '#3A2C26'
PALETTE = {'body': TAN, 'head': '#D2AF84', 'muzzle': '#E6CDA6', 'ear': DARK, 'leg': '#C49F72', 'belly': CREAM,
           'tail': '#C29E73', 'tip': DARK}
BLUSH = '#F2A2AE'

S = 1.15
LEG_X = 0.08 * S
FRONT_Y = -0.15 * S
HIND_Y = 0.15 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.3 * S), 'mid': (FRONT_Y + 0.045 * S, 0.165 * S), 'low': (FRONT_Y, 0.04 * S),
              'toe': (FRONT_Y - 0.06 * S, 0.013 * S)},
    'hind': {'top': (HIND_Y, 0.3 * S), 'mid': (HIND_Y - 0.055 * S, 0.165 * S), 'low': (HIND_Y + 0.02 * S, 0.04 * S),
             'toe': (HIND_Y - 0.06 * S, 0.013 * S)},
}
HEAD_CENTER = (0, -0.27 * S, 0.42 * S)
TAIL = [(0, 0.24 * S, 0.32 * S), (0, 0.4 * S, 0.27 * S), (0, 0.56 * S, 0.22 * S), (0, 0.7 * S, 0.2 * S)]
TAIL_R = [0.032 * S, 0.026 * S, 0.021 * S, 0.016 * S]


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.02, 0.32)), _s((0.1, 0.23, 0.11)))
    b.ellipsoid('belly', 'belly', _s((0, -0.04, 0.25)), _s((0.08, 0.17, 0.06)), blend=0.04 * S)
    b.ellipsoid('chest', 'belly', _s((0, -0.14, 0.32)), _s((0.085, 0.08, 0.1)), blend=0.05 * S)
    b.ellipsoid('neck', 'body', _s((0, -0.2, 0.38)), _s((0.07, 0.07, 0.07)), blend=0.04 * S)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, _s((0.095, 0.095, 0.085)), blend=0.04 * S)
    b.cone('snout', 'muzzle', _s((0, -0.33, 0.405)), _s((0, -0.4, 0.39)), 0.045 * S, 0.02 * S, blend=0.03 * S)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', _s((0.075 * s, -0.24, 0.47)), _s((0.025, 0.018, 0.025)), blend=0.015 * S)
        x = LEG_X / S * s
        for key, y in (('f', -0.15), ('h', 0.15)):
            b.cone(f'{key}leg{s}', 'leg', _s((x, y, 0.3)), _s((x, y, 0.045)), 0.04 * S, 0.028 * S, blend=0.04 * S)
            b.ellipsoid(f'{key}paw{s}', 'leg', _s((x, y - 0.03, 0.02)), _s((0.03, 0.045, 0.022)), blend=0.02 * S)
    b.chain('tail', 'tail', TAIL, TAIL_R, blend=0.03 * S)
    b.ellipsoid('tip', 'tip', _s((0, 0.74, 0.2)), _s((0.017, 0.04, 0.017)), blend=0.015 * S)
    return b


EYES: dict = {}


def build(target_tris: int = 3200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('meerkat_body', b, _s((-0.2, -0.46, 0.0)), _s((0.2, 0.82, 0.56)), 0.008,
                        target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    for s in (1, -1):
        # 目のまわりの黒いもよう（目の後ろに敷く）
        patch = M.decal(f'eye_patch{s}', b, HEAD_CENTER, (0.5 * s, -0.8, 0.22), _s((0.032, 0.026, 0.01)), DARK,
                        sink=0.45, up=(0.3 * s, 0, 1), segments=10, rings=5)
        roles['rigid'].append((patch, 'head'))
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.5 * s, -0.8, 0.22), _s((0.02, 0.025, 0.011)),
                      sclera='#F7F2EA')
    EYES.update(eyes)
    nose = M.decal('nose', b, _s((0, -0.395, 0.395)), (0, -1, 0.25), _s((0.016, 0.012, 0.008)), '#241A16', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.68 * s, -0.62, -0.32), _s((0.016, 0.012, 0.007)), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.025)
    specs = [
        BoneSpec('root', (0, 0, 0), _s((0, 0.2, 0))),
        BoneSpec('hips', _s((0, 0.15, 0.32)), _s((0, 0.02, 0.33)), 'root'),
        BoneSpec('spine_1', _s((0, 0.02, 0.33)), _s((0, -0.09, 0.34)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.09, 0.34)), _s((0, -0.18, 0.37)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.18, 0.37)), _s((0, -0.23, 0.41)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.23, 0.41)), _s((0, -0.41, 0.39)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.065, -0.24, 0.45)), _s((0.09, -0.24, 0.5)), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, FRONT_Y - 0.04 * S, 0.025 * S), (x, FRONT_Y - 0.08 * S, 0.025 * S), 'front_leg_foot_l',
                 deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1', 'tail_2', 'tail_3'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
