"""ペンギン: たまご形の体に黒い背中と頭、白いおなかと顔、オレンジのくちばしと足、平たいひれ（翼）。

二足・鳥の体型（`bodyplan.Config(plan='biped')`）。脚は leg_{upper,lower,foot}_{l,r}。
白いおなか・顔は、黒い体を少しふくらませた殻を前側の楕円で切り出した別の形にする（境目をなめらかに保つ）。
ひれは wing_l / wing_r の骨に固定した別の部品で、はばたき・バランスを取る動きに使う。
くちばしの先に、魚をくわえて運ぶための骨 beak_tip（変形には使わない）を置く。
座標は Blender の Z-up・前方 -Y・メートル。
"""

from __future__ import annotations

import numpy as np

from .. import creature as C
from .. import meshing as M
from ..rig import BoneSpec, with_mirrors
from ..sdf import Body

NAME = 'penguin'
BLACK = '#2E3442'
WHITE = '#FBFAF4'
ORANGE = '#F6A23C'
PALETTE = {'body': BLACK, 'head': BLACK, 'tail': BLACK, 'white': WHITE, 'beak': ORANGE, 'foot': ORANGE,
           'leg': '#E8913A'}
BLUSH = '#F7A9BD'

LEG_X = 0.095
BODY = ((0, 0.0, 0.46), (0.25, 0.23, 0.34))
CHEST = ((0, -0.04, 0.62), (0.21, 0.2, 0.22))
HEAD_CENTER = (0, -0.05, 0.86)
HEAD_R = (0.205, 0.195, 0.19)
FACE = (0, -0.12, 0.82)  # 白い顔の内側の点（目・頬を貼る起点）


def body() -> Body:
    """黒い部分: 体・頭・しっぽ（白い部分はこの上に重ねる）。"""
    b = Body(floor=None)
    b.ellipsoid('body', 'body', *BODY)
    b.ellipsoid('chest', 'body', *CHEST, blend=0.12)
    b.ellipsoid('head', 'head', HEAD_CENTER, HEAD_R, blend=0.12)
    b.cone('tail', 'tail', (0, 0.16, 0.2), (0, 0.25, 0.13), 0.06, 0.03, blend=0.06)
    b.cone('beak', 'beak', (0, -0.2, 0.83), (0, -0.35, 0.8), 0.055, 0.016, blend=0.03)
    return b


def white_parts() -> Body:
    """白いおなかと顔: 体を 1.4cm ふくらませた殻を、前側の楕円で切り出す。"""
    w = Body()
    g = 0.014
    w.ellipsoid('belly_shell', 'white', BODY[0], tuple(r + g for r in BODY[1]))
    w.ellipsoid('chest_shell', 'white', CHEST[0], tuple(r + g for r in CHEST[1]), blend=0.12)
    w.ellipsoid('face_shell', 'white', HEAD_CENTER, tuple(r + g for r in HEAD_R), blend=0.12)
    w.ellipsoid('cut', 'white', (0, -0.26, 0.52), (0.21, 0.27, 0.5), intersect=True, blend=0.03)
    return w


def legs() -> Body:
    """短い脚と、水かきのある平たい足。"""
    k = Body(floor=0.0)
    for s in (1, -1):
        x = LEG_X * s
        k.cone(f'leg{s}', 'leg', (x, 0.02, 0.22), (x, 0.0, 0.07), 0.045, 0.035, blend=0.03)
        k.ellipsoid(f'foot{s}', 'foot', (x, -0.06, 0.03), (0.07, 0.1, 0.03), blend=0.04)
        for dx in (-0.04, 0.0, 0.04):
            k.ellipsoid(f'toe{s}{dx}', 'foot', (x + dx, -0.14, 0.025), (0.026, 0.04, 0.022), blend=0.03)
    return k


def flipper(side: int):
    """平たいひれ（体の横から下へたれる）。"""
    o = M.primitive('sphere', f'flipper{side}', M.look_matrix((0.235 * side, 0.02, 0.5), (side, 0.15, 0.0),
                    up=(0.25 * side, 0.1, 1), scale=(0.075, 0.2, 0.03)), segments=14, rings=8)
    M.solid(o, BLACK)
    return o


EYES: dict = {}


def build(target_tris: int = 2600, shading: str = 'smooth'):
    b = body()
    black = M.body_object('penguin_body', b, (-0.4, -0.45, 0.05), (0.4, 0.4, 1.1), 0.012, target_tris=target_tris)
    M.paint(black, b, PALETTE)
    w = white_parts()
    white = M.body_object('penguin_white', w, (-0.35, -0.35, 0.05), (0.35, 0.1, 1.1), 0.012, target_tris=1500)
    M.paint(white, w, PALETTE)
    k = legs()
    feet = M.body_object('penguin_legs', k, (-0.25, -0.25, 0.0), (0.25, 0.1, 0.3), 0.01, target_tris=700)
    M.paint(feet, k, PALETTE)
    roles = C.new_roles()
    roles['body'] += [black, white, feet]
    eyes = C.add_eyes(roles, w, FACE, lambda s: (0.55 * s, -0.8, 0.3), (0.04, 0.05, 0.022))
    EYES.update(eyes)
    for s in (1, -1):
        blush = M.decal(f'blush{s}', w, FACE, (0.7 * s, -0.7, -0.05), (0.04, 0.03, 0.012), BLUSH, sink=0.5,
                        segments=12, rings=5)
        roles['rigid'].append((blush, 'head'))
        roles['rigid'].append((flipper(s), f'wing_{"l" if s > 0 else "r"}'))
    return C.assemble(NAME, roles, bones(), BODY_BONES, shading)


def bones():
    x = LEG_X
    eye_p, eye_n = EYES['l']
    eye_tail = tuple(np.asarray(eye_p) + np.asarray(eye_n) * 0.04)
    specs = [
        BoneSpec('root', (0, 0, 0), (0, 0.2, 0)),
        BoneSpec('hips', (0, 0.03, 0.26), (0, 0.0, 0.46), 'root'),
        BoneSpec('spine_1', (0, 0.0, 0.46), (0, -0.02, 0.62), 'hips', connect=True),
        BoneSpec('spine_2', (0, -0.02, 0.62), (0, -0.03, 0.72), 'spine_1', connect=True),
        BoneSpec('neck', (0, -0.03, 0.72), (0, -0.05, 0.8), 'spine_2', connect=True),
        BoneSpec('head', (0, -0.05, 0.8), (0, -0.32, 0.82), 'neck', connect=True),
        BoneSpec('beak_tip', (0, -0.33, 0.8), (0, -0.39, 0.8), 'head', deform=False),
        BoneSpec('eye_l', eye_p, eye_tail, 'head'),
        BoneSpec('tail_1', (0, 0.15, 0.22), (0, 0.26, 0.13), 'hips'),
        BoneSpec('wing_l', (0.21, 0.0, 0.64), (0.27, 0.04, 0.34), 'spine_2'),
        BoneSpec('leg_upper_l', (x, 0.03, 0.27), (x, -0.02, 0.16), 'hips'),
        BoneSpec('leg_lower_l', (x, -0.02, 0.16), (x, 0.01, 0.055), 'leg_upper_l', connect=True),
        BoneSpec('leg_foot_l', (x, 0.01, 0.055), (x, -0.12, 0.02), 'leg_lower_l', connect=True),
    ]
    return with_mirrors(specs)


BODY_BONES = ['hips', 'spine_1', 'spine_2', 'neck', 'head', 'tail_1'] + \
    [f'leg_{q}_{s}' for q in ('upper', 'lower', 'foot') for s in ('l', 'r')]
