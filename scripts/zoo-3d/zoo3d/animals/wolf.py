# fox から作成した wolf の土台を、オオカミの個別仕様に書き換えたもの。
"""オオカミ: キツネより大きくがっしりした灰色の体、白っぽいほお・口元・胸・おなか、首まわりのふさふさの毛、
三角の立った耳（裏は濃い灰色）、長い鼻先と黒い鼻、長い脚、先が黒い まっすぐなしっぽ。

骨の名前と並びはキツネと同じ（Mesh2Motion のキツネ（CC0）の遠ぼえ・座り姿勢をそのまま写せる）。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'wolf'
GREY = '#8E949D'
BACK = '#767C86'
LIGHT = '#ECE7DD'
DARK = '#4A4D55'
PALETTE = {'body': GREY, 'head': '#949AA3', 'chest': LIGHT, 'muzzle': LIGHT, 'cheek': LIGHT, 'ear': GREY,
           'leg': '#9DA2AA', 'ruff': '#B9BCC2', 'tail': BACK, 'tip': DARK}
BLUSH = '#F4A7B4'

S = 1.75
LEG_X = 0.08 * S
FRONT_Y = -0.2 * S
HIND_Y = 0.2 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.38 * S), 'mid': (FRONT_Y + 0.04 * S, 0.2 * S), 'low': (FRONT_Y, 0.045 * S),
              'toe': (FRONT_Y - 0.07 * S, 0.015 * S)},
    'hind': {'top': (HIND_Y, 0.38 * S), 'mid': (HIND_Y - 0.06 * S, 0.23 * S), 'low': (HIND_Y + 0.04 * S, 0.08 * S),
             'toe': (HIND_Y - 0.06 * S, 0.015 * S)},
}
HEAD_CENTER = (0, -0.37 * S, 0.56 * S)
TAIL = [(0, 0.3 * S, 0.44 * S), (0, 0.42 * S, 0.37 * S), (0, 0.52 * S, 0.3 * S), (0, 0.6 * S, 0.24 * S)]


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.02, 0.42)), _s((0.12, 0.28, 0.12)))
    b.ellipsoid('chest', 'chest', _s((0, -0.21, 0.41)), _s((0.105, 0.1, 0.13)), blend=0.05 * S)
    # 首まわりのふさふさの毛
    b.ellipsoid('ruff', 'ruff', _s((0, -0.27, 0.49)), _s((0.12, 0.1, 0.12)), blend=0.05 * S)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, _s((0.11, 0.11, 0.1)), blend=0.05 * S)
    # 鼻先は上が灰色、あごと口のまわりが白い
    b.cone('snout', 'head', _s((0, -0.45, 0.535)), _s((0, -0.585, 0.505)), 0.055 * S, 0.034 * S, blend=0.04 * S)
    b.ellipsoid('chin', 'muzzle', _s((0, -0.51, 0.49)), _s((0.048, 0.075, 0.035)), blend=0.03 * S)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'cheek', _s((0.075 * s, -0.43, 0.51)), _s((0.05, 0.05, 0.045)), blend=0.03 * S)
        b.cone(f'ear{s}', 'ear', _s((0.06 * s, -0.34, 0.62)), _s((0.08 * s, -0.33, 0.75)), 0.045 * S, 0.01 * S,
               blend=0.03 * S)
        x = LEG_X / S * s
        b.cone(f'fl_u{s}', 'leg', _s((x, -0.2, 0.38)), _s((x, -0.18, 0.2)), 0.042 * S, 0.032 * S, blend=0.04 * S)
        b.cone(f'fl_l{s}', 'leg', _s((x, -0.18, 0.2)), _s((x, -0.2, 0.045)), 0.03 * S, 0.028 * S, blend=0.02 * S)
        b.ellipsoid(f'fpaw{s}', 'leg', _s((x, -0.23, 0.022)), _s((0.033, 0.048, 0.024)), blend=0.02 * S)
        b.ellipsoid(f'thigh{s}', 'leg', _s((x, 0.18, 0.34)), _s((0.062, 0.095, 0.11)), blend=0.04 * S)
        b.cone(f'hl_l{s}', 'leg', _s((x, 0.15, 0.24)), _s((x, 0.24, 0.08)), 0.032 * S, 0.027 * S, blend=0.02 * S)
        b.cone(f'hl_m{s}', 'leg', _s((x, 0.24, 0.08)), _s((x, 0.18, 0.022)), 0.027 * S, 0.026 * S, blend=0.02 * S)
    b.chain('tail', 'tail', TAIL, [0.045 * S, 0.06 * S, 0.055 * S, 0.045 * S], blend=0.04 * S)
    b.ellipsoid('tip', 'tip', _s((0, 0.64, 0.22)), _s((0.04, 0.05, 0.04)), blend=0.025 * S)
    return b


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('wolf_body', b, _s((-0.26, -0.66, 0.0)), _s((0.26, 0.74, 0.82)), 0.011, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.5 * s, -0.8, 0.28), _s((0.022, 0.03, 0.011)))
    EYES.update(eyes)
    nose = M.decal('nose', b, _s((0, -0.575, 0.51)), (0, -1, 0.25), _s((0.024, 0.018, 0.011)), '#24242A', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    mouth = M.decal('mouth', b, _s((0, -0.55, 0.485)), (0, -0.8, -0.7), _s((0.018, 0.004, 0.006)), '#6A6E75', sink=0.4,
                    segments=8, rings=4)
    roles['rigid'].append((mouth, 'head'))
    for s in (1, -1):
        back = M.decal(f'ear_back{s}', b, _s((0.07 * s, -0.33, 0.68)), (0.2 * s, 1, 0.1), _s((0.028, 0.045, 0.008)),
                       DARK, sink=0.3, segments=8, rings=4)
        roles['rigid'].append((back, f'ear_{"l" if s > 0 else "r"}'))
        inner = M.decal(f'ear_inner{s}', b, _s((0.07 * s, -0.345, 0.665)), (0.2 * s, -1, 0.1), _s((0.022, 0.04, 0.008)),
                        LIGHT, sink=0.3, segments=8, rings=4)
        roles['rigid'].append((inner, f'ear_{"l" if s > 0 else "r"}'))
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.66 * s, -0.62, -0.3), _s((0.02, 0.015, 0.008)), BLUSH,
                        sink=0.5, segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        # 目の上の白いまゆ（オオカミらしい顔つき）
        brow = M.decal(f'brow{s}', b, HEAD_CENTER, (0.45 * s, -0.75, 0.48), _s((0.022, 0.012, 0.007)), LIGHT,
                       sink=0.45, segments=8, rings=4)
        roles['rigid'].append((brow, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), _s((0, 0.2, 0))),
        BoneSpec('hips', _s((0, 0.2, 0.42)), _s((0, 0.02, 0.43)), 'root'),
        BoneSpec('spine_1', _s((0, 0.02, 0.43)), _s((0, -0.12, 0.44)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.12, 0.44)), _s((0, -0.24, 0.47)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.24, 0.47)), _s((0, -0.33, 0.53)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.33, 0.53)), _s((0, -0.6, 0.5)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.055, -0.34, 0.61)), _s((0.08, -0.33, 0.75)), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], _s((0, 0.67, 0.2)), 'tail_3', connect=True),
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
