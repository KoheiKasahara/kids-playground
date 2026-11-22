"""ワニ: 平たく長い緑の体、背中と尾のでこぼこ（うろこの列）、長い口に白い歯、頭の上に出た目、
体の横へ張り出した短い脚、長く太い尾。

下あごは別の部品にして jaw の骨へ固定し、「ぱくっ」と口を開け閉めする。
脚はひじ・ひざを体の外へ張り出す（`bodyplan.Config(pole_mirror=True)`）。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'crocodile'
GREEN = '#6FA65B'
PALETTE = {'body': GREEN, 'head': '#76AD61', 'snout': '#79B064', 'leg': '#689E55', 'tail': GREEN,
           'scute': '#558A45', 'belly': '#D9E4A4', 'brow': '#76AD61'}
BLUSH = '#F2A0B0'

LEG_X = 0.17
FRONT_Y = -0.3
HIND_Y = 0.36
JOINTS = {
    'front': {'top': (FRONT_Y, 0.2), 'mid': (FRONT_Y + 0.03, 0.15), 'low': (FRONT_Y - 0.02, 0.045),
              'toe': (FRONT_Y - 0.1, 0.015)},
    'hind': {'top': (HIND_Y, 0.2), 'mid': (HIND_Y - 0.04, 0.16), 'low': (HIND_Y + 0.03, 0.05),
             'toe': (HIND_Y - 0.08, 0.015)},
}
LEG_OUT = 0.13  # ひじ・ひざを体の外へ出す量
TAIL = [(0, 0.55, 0.22), (0, 0.9, 0.17), (0, 1.22, 0.12), (0, 1.5, 0.08), (0, 1.72, 0.06)]
HEAD_CENTER = (0, -0.55, 0.27)


def body() -> Body:
    b = Body(floor=0.0)
    b.ellipsoid('torso', 'body', (0, 0.05, 0.23), (0.25, 0.52, 0.15))
    b.ellipsoid('belly', 'belly', (0, 0.0, 0.14), (0.2, 0.44, 0.07), blend=0.08)
    b.ellipsoid('neck', 'body', (0, -0.42, 0.25), (0.19, 0.18, 0.13), blend=0.1)
    b.ellipsoid('head', 'head', HEAD_CENTER, (0.18, 0.2, 0.12), blend=0.08)
    b.ellipsoid('snout', 'snout', (0, -0.88, 0.22), (0.12, 0.3, 0.075), blend=0.08)
    b.ellipsoid('nose_tip', 'snout', (0, -1.15, 0.25), (0.06, 0.05, 0.04), blend=0.04)
    for s in (1, -1):
        b.ellipsoid(f'brow{s}', 'brow', (0.09 * s, -0.55, 0.37), (0.06, 0.06, 0.05), blend=0.04)
    b.chain('tail', 'tail', TAIL, [0.15, 0.11, 0.075, 0.05, 0.03], blend=0.08)
    # 背中と尾のでこぼこ（2列のうろこ）
    for i, y in enumerate(np.linspace(-0.3, 0.45, 7)):
        for s in (1, -1):
            b.ellipsoid(f'scute{i}{s}', 'scute', (0.08 * s, y, 0.37 - 0.02 * abs(y)), (0.035, 0.045, 0.03), blend=0.03)
    for i, t in enumerate(np.linspace(0.08, 0.85, 7)):
        k = t * (len(TAIL) - 1)
        a = np.asarray(TAIL[int(k)])
        bb = np.asarray(TAIL[min(int(k) + 1, len(TAIL) - 1)])
        p = a + (bb - a) * (k - int(k))
        r = 0.15 - 0.12 * t
        b.ellipsoid(f'tscute{i}', 'scute', (0, p[1], p[2] + r * 0.9), (0.025, 0.04, 0.03 * (1 - 0.5 * t)), blend=0.03)
    for s in (1, -1):
        x = LEG_X * s
        o = LEG_OUT * s
        f = JOINTS['front']
        h = JOINTS['hind']
        b.cone(f'fl_u{s}', 'leg', (x, f['top'][0], 0.2), (x + o, f['mid'][0], 0.15), 0.06, 0.05, blend=0.06)
        b.cone(f'fl_l{s}', 'leg', (x + o, f['mid'][0], 0.15), (x + o, f['low'][0], 0.05), 0.05, 0.042, blend=0.03)
        b.ellipsoid(f'fpaw{s}', 'leg', (x + o, f['low'][0] - 0.04, 0.025), (0.05, 0.065, 0.025), blend=0.03)
        b.cone(f'hl_u{s}', 'leg', (x, h['top'][0], 0.2), (x + o, h['mid'][0], 0.16), 0.075, 0.06, blend=0.06)
        b.cone(f'hl_l{s}', 'leg', (x + o, h['mid'][0], 0.16), (x + o, h['low'][0], 0.05), 0.055, 0.045, blend=0.03)
        b.ellipsoid(f'hpaw{s}', 'leg', (x + o, h['low'][0] - 0.05, 0.025), (0.055, 0.08, 0.025), blend=0.03)
    return b


EYES: dict = {}


def build(target_tris: int = 4200, shading: str = 'smooth'):
    b = body()
    obj = M.body_object('crocodile_body', b, (-0.5, -1.25, 0.0), (0.5, 1.82, 0.5), 0.012, target_tris=target_tris)
    M.paint(obj, b, PALETTE)
    roles = C.new_roles()
    roles['body'].append(obj)
    eyes = C.add_eyes(roles, b, (0, -0.55, 0.33), lambda s: (0.55 * s, -0.6, 0.55), (0.032, 0.04, 0.016))
    EYES.update(eyes)
    # 口の中（ピンク）と、jaw の骨で開く下あご・歯
    mouth = M.primitive('sphere', 'mouth', M.look_matrix((0, -0.86, 0.165), (0, -1, 0), scale=(0.1, 0.025, 0.27)),
                        segments=12, rings=8)
    M.solid(mouth, '#E68A98')
    roles['rigid'].append((mouth, 'head'))
    jaw = M.primitive('sphere', 'jaw_mesh', M.look_matrix((0, -0.84, 0.13), (0, -1, 0), scale=(0.11, 0.045, 0.3)),
                      segments=14, rings=8)
    M.solid(jaw, '#C9D98F')
    roles['rigid'].append((jaw, 'jaw'))
    for s in (1, -1):
        for i, y in enumerate(np.linspace(-0.66, -1.06, 5)):
            tooth = M.primitive('cone', f'tooth{s}{i}', M.look_matrix((0.095 * s - 0.012 * s * i, y, 0.155),
                                (0, 0, -1), scale=(0.014, 0.014, 0.03)), segments=5)
            M.solid(tooth, '#FFFDF5')
            roles['rigid'].append((tooth, 'head'))
        blush = M.decal(f'blush{s}', b, (0, -0.62, 0.26), (0.9 * s, -0.3, 0.0), (0.035, 0.025, 0.01), BLUSH, sink=0.5,
                        segments=10, rings=5)
        roles['rigid'].append((blush, 'head'))
        nostril = M.decal(f'nostril{s}', b, (0.03 * s, -1.15, 0.25), (0.25 * s, -0.3, 1), (0.014, 0.01, 0.008),
                          '#3D5A33', sink=0.3, segments=6, rings=3)
        roles['rigid'].append((nostril, 'head'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    o = LEG_OUT
    f = JOINTS['front']
    h = JOINTS['hind']
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.03)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.3, 0)),
        BoneSpec('hips', (0, 0.38, 0.22), (0, 0.05, 0.23), 'root'),
        BoneSpec('spine_1', (0, 0.05, 0.23), (0, -0.18, 0.24), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.18, 0.24), (0, -0.36, 0.25), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.36, 0.25), (0, -0.46, 0.26), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.46, 0.26), (0, -1.15, 0.24), 'neck', connect=True),
        BoneSpec('jaw', (0, -0.52, 0.16), (0, -1.12, 0.13), 'head'),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', TAIL[0], TAIL[1], 'hips'),
        BoneSpec('tail_2', TAIL[1], TAIL[2], 'tail_1', connect=True),
        BoneSpec('tail_3', TAIL[2], TAIL[3], 'tail_2', connect=True),
        BoneSpec('tail_4', TAIL[3], TAIL[4], 'tail_3', connect=True),
        BoneSpec('front_leg_upper_l', (x, f['top'][0], f['top'][1]), (x + o, *f['mid']), 'spine_2'),
        BoneSpec('front_leg_lower_l', (x + o, *f['mid']), (x + o, *f['low']), 'front_leg_upper_l', connect=True),
        BoneSpec('front_leg_foot_l', (x + o, *f['low']), (x + o, *f['toe']), 'front_leg_lower_l', connect=True),
        BoneSpec('back_leg_upper_l', (x, h['top'][0], h['top'][1]), (x + o, *h['mid']), 'hips'),
        BoneSpec('back_leg_lower_l', (x + o, *h['mid']), (x + o, *h['low']), 'back_leg_upper_l', connect=True),
        BoneSpec('back_leg_foot_l', (x + o, *h['low']), (x + o, *h['toe']), 'back_leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'tail_1', 'tail_2', 'tail_3', 'tail_4'] + \
    [f'{p}_leg_{q}_{s}' for p in ('front', 'back') for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
