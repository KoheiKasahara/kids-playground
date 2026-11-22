# panda から作成した monkey の土台を、ニホンザルの個別仕様に書き換えたもの。
"""ニホンザル: 灰色がかった茶色の毛、赤い顔と赤いおしり、長い腕（前足）、短いしっぽ。

赤い顔は、頭を少しふくらませた殻を前側の楕円で切り出した別の形にする（ペンギンの白いおなかと同じ作り方）。
四足で歩き、座って手（前足）を使う。右手の掌に、食べ物を持つ骨 hold_r（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'monkey'
FUR = '#B18F72'
FACE = '#EE8F8C'
PALETTE = {'body': FUR, 'head': FUR, 'leg': FUR, 'arm': FUR, 'tail': '#9E8268', 'face': FACE, 'hand': '#D9A08C',
           'ear': '#E2A094', 'belly': '#C9B29A'}
BLUSH = '#F07A86'

S = 1.35  # ゲームで見分けやすいよう、実物より少し大きく
LEG_X = 0.11 * S
FRONT_Y = -0.15 * S
HIND_Y = 0.17 * S
JOINTS = {
    'front': {'top': (FRONT_Y, 0.46 * S), 'mid': (FRONT_Y + 0.06 * S, 0.25 * S), 'low': (FRONT_Y, 0.055 * S),
              'toe': (FRONT_Y - 0.06 * S, 0.02 * S)},
    'hind': {'top': (HIND_Y, 0.42 * S), 'mid': (HIND_Y - 0.1 * S, 0.24 * S), 'low': (HIND_Y + 0.04 * S, 0.06 * S),
             'toe': (HIND_Y - 0.08 * S, 0.02 * S)},
}
HEAD = ((0, -0.32 * S, 0.63 * S), (0.16 * S, 0.15 * S, 0.15 * S))


def _s(v):
    return tuple(c * S for c in v)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', _s((0, 0.02, 0.45)), _s((0.16, 0.22, 0.16)))
    b.ellipsoid('chest', 'body', _s((0, -0.13, 0.48)), _s((0.15, 0.13, 0.15)), blend=0.07 * S)
    b.ellipsoid('belly', 'belly', _s((0, -0.02, 0.37)), _s((0.1, 0.15, 0.07)), blend=0.05 * S)
    b.ellipsoid('cranium', 'head', *HEAD, blend=0.07 * S)
    for s in (1, -1):
        b.ellipsoid(f'ear{s}', 'ear', _s((0.155 * s, -0.31, 0.64)), _s((0.03, 0.035, 0.045)), blend=0.02 * S)
        x = LEG_X / S * s
        b.cone(f'arm_u{s}', 'arm', _s((x, -0.15, 0.46)), _s((x, -0.09, 0.25)), 0.06 * S, 0.05 * S, blend=0.05 * S)
        b.cone(f'arm_l{s}', 'arm', _s((x, -0.09, 0.25)), _s((x, -0.15, 0.055)), 0.05 * S, 0.042 * S, blend=0.03 * S)
        b.ellipsoid(f'hand{s}', 'hand', _s((x, -0.19, 0.03)), _s((0.04, 0.055, 0.03)), blend=0.03 * S)
        b.ellipsoid(f'thigh{s}', 'leg', _s((x, 0.15, 0.36)), _s((0.07, 0.1, 0.11)), blend=0.05 * S)
        b.cone(f'shin{s}', 'leg', _s((x, 0.07, 0.24)), _s((x, 0.21, 0.06)), 0.048 * S, 0.04 * S, blend=0.03 * S)
        b.ellipsoid(f'foot{s}', 'hand', _s((x, 0.13, 0.025)), _s((0.04, 0.08, 0.028)), blend=0.03 * S)
    b.cone('tail', 'tail', _s((0, 0.24, 0.48)), _s((0, 0.32, 0.47)), 0.035 * S, 0.025 * S, blend=0.03 * S)
    return b


def face() -> Body:
    """赤い顔: 頭を 1cm ふくらませた殻を、前側のハート形に近い楕円で切り出す。"""
    f = Body()
    c, r = HEAD
    f.ellipsoid('face_shell', 'face', c, tuple(v + 0.01 * S for v in r))
    f.ellipsoid('muzzle', 'face', _s((0, -0.44, 0.585)), _s((0.07, 0.05, 0.05)), blend=0.03 * S)
    f.ellipsoid('cut', 'face', _s((0, -0.44, 0.61)), _s((0.11, 0.14, 0.11)), intersect=True, blend=0.02 * S)
    return f


EYES: dict = {}


def build(target_tris: int = 3600, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('monkey_body', b, _s((-0.3, -0.55, 0.0)), _s((0.3, 0.42, 0.85)), 0.01, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    fb = face()
    face_obj = M.body_object('monkey_face', fb, _s((-0.2, -0.55, 0.45)), _s((0.2, -0.2, 0.8)), 0.008,
                             target_tris=900)
    M.paint(face_obj, fb, PALETTE)
    roles = C.new_roles()
    roles['body'] += [obj]
    roles['rigid'].append((face_obj, 'head'))
    eyes = C.add_eyes(roles, fb, _s((0, -0.4, 0.62)), lambda s: (0.45 * s, -0.85, 0.2), _s((0.026, 0.032, 0.014)))
    EYES.update(eyes)
    nose = M.decal('nose', fb, _s((0, -0.42, 0.59)), (0, -1, 0.1), _s((0.018, 0.01, 0.008)), '#B5605E', sink=0.4,
                   segments=8, rings=4)
    roles['rigid'].append((nose, 'head'))
    rump = M.decal('rump', b, _s((0, 0.12, 0.4)), (0, 1, -0.35), _s((0.075, 0.055, 0.012)), FACE, sink=0.4,
                   segments=12, rings=5)
    roles['decal'].append(rump)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', fb, _s((0, -0.4, 0.6)), (0.7 * s, -0.6, -0.2), _s((0.022, 0.016, 0.008)), BLUSH,
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
        BoneSpec('hips', _s((0, 0.17, 0.44)), _s((0, 0.02, 0.46)), 'root'),
        BoneSpec('spine_1', _s((0, 0.02, 0.46)), _s((0, -0.08, 0.48)), 'hips', connect=True),
        BoneSpec('spine_2', _s((0, -0.08, 0.48)), _s((0, -0.18, 0.52)), 'spine_1', connect=True),
        BoneSpec('neck', _s((0, -0.18, 0.52)), _s((0, -0.26, 0.58)), 'spine_2', connect=True),
        BoneSpec('head', _s((0, -0.26, 0.58)), _s((0, -0.48, 0.6)), 'neck', connect=True),
        BoneSpec('ear_l', _s((0.13, -0.31, 0.6)), _s((0.17, -0.31, 0.67)), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', _s((0, 0.22, 0.48)), _s((0, 0.33, 0.47)), 'hips'),
        BoneSpec('front_leg_upper_l', (x, *f['top']), (x, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x, *f['mid']), (x, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x, *f['low']), (x, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('hold_l', (x, FRONT_Y - 0.06 * S, 0.03 * S), (x, FRONT_Y - 0.11 * S, 0.03 * S), 'front_leg_foot_l',
                 deform=False),
        BoneSpec('back_leg_upper_l', (x, *h['top']), (x, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x, *h['mid']), (x, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x, *h['low']), (x, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'ear_l', 'ear_r', 'tail_1'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
