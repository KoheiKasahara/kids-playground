"""ウサギ: まるい小さな体に大きな頭、長い耳（内側ピンク）、長い後ろ足、短い前足、まるいしっぽ。

四足だが、移動は後ろ足2本・前足2本がそろって着く跳ね（`bound`）。後ろ足は長い足先が地面につく。
耳は根元と先の2本の骨（ear_l → ear_2_l）で、ぴんと立てる・後ろへ倒す・先だけ揺れる、を表す。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'rabbit'
FUR = '#E9D2B0'
CREAM = '#FBF4E8'
PALETTE = {'body': FUR, 'head': FUR, 'ear': FUR, 'leg': FUR, 'muzzle': CREAM, 'belly': CREAM, 'paw': CREAM,
           'tail': '#FFFDF8'}
PINK = '#F5B8C4'
BLUSH = '#F7A6B9'

S = 1.3  # 全体の大きさ（ゲームで見分けやすいよう、実物より少し大きく）
LEG_X = 0.075 * S
FRONT_Y = -0.12 * S
HIND_Y = 0.12 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.21 * S), 'mid': (FRONT_Y + 0.04 * S, 0.12 * S), 'low': (FRONT_Y, 0.035 * S),
              'toe': (FRONT_Y - 0.05 * S, 0.012 * S)},
    'hind': {'top': (HIND_Y, 0.22 * S), 'mid': (HIND_Y - 0.09 * S, 0.13 * S), 'low': (HIND_Y + 0.06 * S, 0.045 * S),
             'toe': (HIND_Y - 0.1 * S, 0.014 * S)},
}
HEAD_CENTER = (0, -0.18 * S, 0.4 * S)


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.04, 0.22)), _s((0.15, 0.21, 0.165)))
    b.ellipsoid('belly', 'belly', _s((0, -0.02, 0.15)), _s((0.11, 0.15, 0.08)), blend=0.06 * S)
    b.ellipsoid('chest', 'body', _s((0, -0.09, 0.25)), _s((0.12, 0.12, 0.13)), blend=0.06 * S)
    b.ellipsoid('cranium', 'head', HEAD_CENTER, _s((0.135, 0.13, 0.12)), blend=0.06 * S)
    for s in (1, -1):
        b.ellipsoid(f'cheek{s}', 'muzzle', _s((0.055 * s, -0.27, 0.37)), _s((0.06, 0.05, 0.05)), blend=0.03 * S)
        # 長い耳（平たい楕円を少し外へ開く）
        b.ellipsoid(f'ear{s}', 'ear', _s((0.055 * s, -0.13, 0.63)), _s((0.045, 0.022, 0.15)),
                    rot_deg=(8, -9 * s, 0), blend=0.04 * S)
        b.ellipsoid(f'haunch{s}', 'body', _s((0.095 * s, 0.12, 0.17)), _s((0.075, 0.115, 0.1)), blend=0.05 * S)
        b.cone(f'fleg{s}', 'leg', _s((LEG_X / S * s, -0.12, 0.2)), _s((LEG_X / S * s, -0.125, 0.04)), 0.032 * S,
               0.028 * S, blend=0.04 * S)
        b.ellipsoid(f'fpaw{s}', 'paw', _s((LEG_X / S * s, -0.15, 0.022)), _s((0.033, 0.05, 0.024)), blend=0.03 * S)
        b.ellipsoid(f'hfoot{s}', 'paw', _s((0.095 * s, 0.07, 0.024)), _s((0.042, 0.11, 0.026)), blend=0.03 * S)
    b.ellipsoid('tail', 'tail', _s((0, 0.25, 0.22)), _s((0.055, 0.05, 0.055)), blend=0.03 * S)
    return b


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('rabbit_body', b, _s((-0.25, -0.4, 0.0)), _s((0.25, 0.35, 0.85)), 0.009, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, HEAD_CENTER, lambda s: (0.55 * s, -0.75, 0.25), _s((0.03, 0.038, 0.016)))
    EYES.update(eyes)
    nose = M.decal('nose', b, _s((0, -0.26, 0.39)), (0, -1, 0.1), _s((0.022, 0.016, 0.012)), '#E98A9E', sink=0.4)
    roles['rigid'].append((nose, 'head'))
    for s in (1, -1):
        inner = M.decal(f'ear_inner{s}', b, _s((0.055 * s, -0.12, 0.63)), (0.15 * s, -1, 0.0),
                        _s((0.028, 0.12, 0.01)), PINK, sink=0.3, segments=10, rings=6)
        roles['decal'].append(inner)
        blush = M.decal(f'blush{s}', b, HEAD_CENTER, (0.7 * s, -0.6, -0.25), _s((0.03, 0.022, 0.01)), BLUSH,
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
        BoneSpec('hips', _s((0, 0.14, 0.22)), _s((0, 0.0, 0.25)), 'root'),
        BoneSpec('spine_1', _s((0, 0.0, 0.25)), _s((0, -0.07, 0.27)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.07, 0.27)), _s((0, -0.12, 0.3)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.12, 0.3)), _s((0, -0.15, 0.36)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.15, 0.36)), _s((0, -0.3, 0.37)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.045, -0.14, 0.49)), _s((0.06, -0.13, 0.63)), 'head'),
        BoneSpec('ear_2_l', _s((0.06, -0.13, 0.63)), _s((0.07, -0.11, 0.78)), 'ear_l', connect=True),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', _s((0, 0.2, 0.22)), _s((0, 0.3, 0.24)), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'ear_2_l', 'ear_2_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
